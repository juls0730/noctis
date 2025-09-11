
import { get } from 'svelte/store';
import { ws } from '../stores/websocketStore';
import { WebSocketMessageType } from '../types/websocket';
import { WebRTCPacketType, type WebRTCPeerCallbacks } from '../types/webrtc';
import { browser } from '$app/environment';
import { createApplicationMessage, createCommit, createGroup, decodeMlsMessage, defaultCapabilities, defaultLifetime, emptyPskIndex, encodeMlsMessage, generateKeyPackage, getCiphersuiteFromName, getCiphersuiteImpl, joinGroup, processPrivateMessage, type CiphersuiteImpl, type ClientState, type Credential, type GroupContext, type KeyPackage, type PrivateKeyPackage, type Proposal } from 'ts-mls';

export class WebRTCPeer {
    private peer: RTCPeerConnection | null = null;
    private dataChannel: RTCDataChannel | null = null;
    private isInitiator: boolean;
    private roomId: string;
    private callbacks: WebRTCPeerCallbacks;
    private credential: Credential;
    private clientState: ClientState | undefined;
    private cipherSuite: CiphersuiteImpl | undefined;
    private keyPackage: { publicPackage: KeyPackage, privatePackage: PrivateKeyPackage } | undefined;
    private encyptionReady: boolean = false;

    private iceServers = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun.l.google.com:5349" },
        { urls: "stun:stun1.l.google.com:3478" },
        { urls: "stun:stun1.l.google.com:5349" },
    ];

    constructor(roomId: string, isInitiator: boolean, callbacks: WebRTCPeerCallbacks) {
        this.roomId = roomId;
        this.isInitiator = isInitiator;
        this.callbacks = callbacks;

        const id = crypto.getRandomValues(new Uint8Array(32));
        this.credential = { credentialType: "basic", identity: id };
    }

    private sendIceCandidate(candidate: RTCIceCandidate) {
        get(ws).send({
            type: WebSocketMessageType.WEBRTC_ICE_CANDIDATE,
            data: {
                roomId: this.roomId,
                candidate: candidate,
            },
        })
    }

    public async initialize() {
        if (!browser) throw new Error("Cannot initialize WebRTCPeer in non-browser environment");

        // dont initialize twice
        if (this.peer) return;

        console.log("Initializing peer");
        this.peer = new RTCPeerConnection({
            iceServers: this.iceServers,
        });

        // 1. Initialize ICE candidates
        this.peer.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendIceCandidate(event.candidate);
            }
        }

        this.peer.oniceconnectionstatechange = () => {
            console.log('ICE connection state changed to:', this.peer?.iceConnectionState);
            if (this.peer?.iceConnectionState === 'connected' || this.peer?.iceConnectionState === 'completed') {
                this.callbacks.onConnected();
            } else if (this.peer?.iceConnectionState === 'failed') {
                this.callbacks.onError('ICE connection failed');
            }
        };

        this.peer.onnegotiationneeded = () => {
            this.callbacks.onNegotiationNeeded();
        };

        // 2. Create data channel
        if (this.isInitiator) {
            this.dataChannel = this.peer.createDataChannel('data-channel');
            this.setupDataChannelEvents(this.dataChannel);
            console.log('created data channel');
        } else {
            this.peer.ondatachannel = (event) => {
                this.dataChannel = event.channel;
                this.setupDataChannelEvents(this.dataChannel);
                console.log('received data channel');
            };
        }
    }

    private setupDataChannelEvents(channel: RTCDataChannel) {
        channel.binaryType = "arraybuffer";

        channel.onopen = async () => {
            console.log('data channel open');
            this.callbacks.onDataChannelOpen();
            this.callbacks.onKeyExchangeDone();

            await this.generateKeyPair();

            try {
                if (this.isInitiator) {
                    let groupId = crypto.getRandomValues(new Uint8Array(24));
                    this.clientState = await createGroup(groupId, this.keyPackage!.publicPackage, this.keyPackage!.privatePackage, [], this.cipherSuite!);

                    this.send(new TextEncoder().encode("group-open").buffer, WebRTCPacketType.GROUP_OPEN);
                } else {
                    // the peer needs to send the initiator their keypackage first so that the initiator can commit it
                    // to the group state then inform the peer
                    // await this.startKeyExchange();

                }
            } catch (e) {
                console.error("Error starting key exchange:", e);
                this.callbacks.onError(e);
            }
        };

        channel.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
            console.log('data channel message:', event.data);
            // event is binary data, we need to parse it, convert it into a WebRTCMessage, and then decrypt it if
            // necessary
            let data = new Uint8Array(event.data);
            if (data.length < 2) return;

            const encrypted = (data[0]! >> 7) & 1;
            const type = data[0]! & 0b01111111;
            data = data.slice(1);

            if (this.encyptionReady && !encrypted) {
                console.log("Received unencrypted message after encryption is ready, ignoring");
                return;
            }

            console.log("parsed data", data, encrypted, type);

            if (type === WebRTCPacketType.GROUP_OPEN) {
                await this.startKeyExchange();
                return;
            }

            if (type === WebRTCPacketType.KEY_PACKAGE) {
                if (!this.cipherSuite) throw new Error("Cipher suite not set");
                if (!this.clientState) throw new Error("Client state not set");

                console.log("Received key package", data);
                const decodedPeerKeyPackage = decodeMlsMessage(data, 0)![0];

                if (decodedPeerKeyPackage.wireformat != "mls_key_package") throw new Error("Invalid key package");

                const addPeerProposal: Proposal = {
                    proposalType: `add`,
                    add: {
                        keyPackage: decodedPeerKeyPackage.keyPackage,
                    }
                }

                const commitResult = await createCommit(
                    this.clientState,
                    emptyPskIndex,
                    true,
                    [addPeerProposal],
                    this.cipherSuite,
                    true,
                )

                console.log("Commit result", commitResult);
                this.clientState = commitResult.newState;

                console.log("sending welcome to peer");
                const encodedWelcome = encodeMlsMessage({
                    welcome: commitResult.welcome!,
                    wireformat: "mls_welcome",
                    version: "mls10",
                });
                const encodedWelcomeBuf = new ArrayBuffer(encodedWelcome.byteLength);
                new Uint8Array(encodedWelcomeBuf).set(encodedWelcome);

                this.send(encodedWelcomeBuf, WebRTCPacketType.WELCOME);
                this.encyptionReady = true;

                return;
            }

            if (type === WebRTCPacketType.WELCOME) {
                if (!this.keyPackage) throw new Error("Key package not set");
                if (!this.cipherSuite) throw new Error("Cipher suite not set");

                console.log("Received welcome", data);
                const decodedWelcome = decodeMlsMessage(data, 0)![0];

                if (decodedWelcome.wireformat != "mls_welcome") throw new Error("Invalid welcome");

                this.clientState = await joinGroup(
                    decodedWelcome.welcome,
                    this.keyPackage.publicPackage,
                    this.keyPackage.privatePackage,
                    emptyPskIndex,
                    this.cipherSuite,
                );

                console.log("Joined group", this.clientState);
                this.encyptionReady = true;
                return;
            }

            if (encrypted) {
                if (!this.cipherSuite) throw new Error("Cipher suite not set");
                if (!this.clientState) throw new Error("Client state not set");

                const decodedPrivateMessage = decodeMlsMessage(data, 0)![0];
                if (decodedPrivateMessage.wireformat != "mls_private_message") throw new Error("Invalid private message");

                const processMessageResult = await processPrivateMessage(
                    this.clientState,
                    decodedPrivateMessage.privateMessage,
                    emptyPskIndex,
                    this.cipherSuite,
                );

                this.clientState = processMessageResult.newState;

                if (processMessageResult.kind === "newState") throw new Error("Expected application message");

                data = new Uint8Array(processMessageResult.message);
            }

            let message = {
                type: type as WebRTCPacketType,
                data: data.buffer,
            };

            this.callbacks.onMessage(message);
        };

        channel.onclose = () => {
            console.log('data channel closed');
        };

        channel.onerror = (error) => {
            console.error('data channel error:', error);
            this.callbacks.onError(error);
        };
    }

    // SDP exchange
    public async createOffer() {
        if (!this.peer) throw new Error('Peer not initialized');

        try {
            const offer = await this.peer.createOffer()

            console.log("Sending offer", offer);

            await this.peer.setLocalDescription(offer)

            get(ws).send({
                type: WebSocketMessageType.WEBRTC_OFFER,
                data: {
                    roomId: this.roomId,
                    sdp: offer,
                },
            });
        } catch (error) {
            console.info('Error creating offer:', error);
            // should trigger re-negotiation
        }
    }

    // both peers call this to set the remote SDP
    public async setRemoteDescription(sdp: RTCSessionDescriptionInit) {
        if (!this.peer) throw new Error('Peer not initialized');

        try {
            await this.peer.setRemoteDescription(sdp);
        } catch (error) {
            console.error('Error setting remote description:', error);
            this.callbacks.onError(error);
        }
    }

    public async createAnswer() {
        if (!this.peer) throw new Error('Peer not initialized');

        try {
            const answer = await this.peer.createAnswer();
            await this.peer.setLocalDescription(answer);

            console.log("Sending answer", answer);

            get(ws).send({
                type: WebSocketMessageType.WERTC_ANSWER,
                data: {
                    roomId: this.roomId,
                    sdp: answer,
                },
            });

        } catch (error) {
            console.error('Error creating answer:', error);
            this.callbacks.onError(error);
        }
    }

    public async addIceCandidate(candidate: RTCIceCandidateInit) {
        if (!this.peer) throw new Error('Peer not initialized');

        try {
            await this.peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
            this.callbacks.onError(error);
        }
    }

    private async generateKeyPair() {
        try {
            console.log("getting cipher suite");
            this.cipherSuite = await getCiphersuiteImpl(getCiphersuiteFromName("MLS_256_XWING_CHACHA20POLY1305_SHA512_Ed25519"))

            console.log("generating credential");

            // genreate an random id and format it in hex
            // const genRandHex = (size: number) => '0x' + [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');

            console.log("Generating key package");
            this.keyPackage = await generateKeyPackage(this.credential, defaultCapabilities(), defaultLifetime, [], this.cipherSuite);
        } catch (e) {
            console.error("Error generating key package:", e);
            this.callbacks.onError(e);
        }
    }

    private async startKeyExchange() {
        if (!this.keyPackage) throw new Error("Key package not set");

        console.log("Starting key exchange");
        const keyPackageMessage = encodeMlsMessage({
            keyPackage: this.keyPackage.publicPackage,
            wireformat: "mls_key_package",
            version: "mls10",
        });

        const keyPackageMessageBuf = new ArrayBuffer(keyPackageMessage.byteLength);
        new Uint8Array(keyPackageMessageBuf).set(keyPackageMessage);

        this.send(keyPackageMessageBuf, WebRTCPacketType.KEY_PACKAGE);
    }

    public async send(data: ArrayBuffer, type: WebRTCPacketType) {
        console.log("Sending message of type", type, "with data", data);

        if (!this.dataChannel || this.dataChannel.readyState !== 'open') throw new Error('Data channel not initialized');

        // console.log(this.keys)
        let header = (type & 0x7F);

        console.log(this.encyptionReady);

        // the key exchange is done, encrypt the message
        if (this.encyptionReady) {
            if (!this.clientState) throw new Error("Client state not set");
            if (!this.cipherSuite) throw new Error("Cipher suite not set");

            console.log("Sending encrypted message", data);

            const createMessageResult = await createApplicationMessage(
                this.clientState,
                new Uint8Array(data),
                this.cipherSuite,
            );

            this.clientState = createMessageResult.newState;

            const encodedPrivateMessage = encodeMlsMessage({
                privateMessage: createMessageResult.privateMessage,
                wireformat: "mls_private_message",
                version: "mls10",
            });

            header |= 1 << 7;

            let buf = new Uint8Array(encodedPrivateMessage.byteLength + 1);
            buf[0] = header;
            buf.subarray(1).set(encodedPrivateMessage);

            console.log("Sending encrypted message", buf);

            this.dataChannel.send(buf.buffer);
        } else {
            console.log("Sending unencrypted message", data);
            // the key exchange is not done yet, send the message unencrypted

            let buf = new Uint8Array(data.byteLength + 1);
            buf[0] = header;
            buf.subarray(1).set(new Uint8Array(data));

            this.dataChannel.send(buf.buffer);
        }
    }

    public close() {
        if (this.dataChannel) {
            this.dataChannel.close();
        }

        if (this.peer) {
            this.peer.close();
        }

        this.peer = null;
        this.dataChannel = null;
    }
}