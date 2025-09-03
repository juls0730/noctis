import { get } from 'svelte/store';
import { ws } from '../stores/websocketStore';
import { roomKey } from '../utils/webrtcUtil';
import { WebRTCPacketType, type KeyStore, type WebRTCPeerCallbacks } from '../types/webrtc';

export class WebRTCPeer {
    private peer: RTCPeerConnection | null = null;
    private dataChannel: RTCDataChannel | null = null;
    private isInitiator: boolean;
    private roomId: string;
    private callbacks: WebRTCPeerCallbacks;
    private keys: KeyStore = {
        localKeys: null,
        peersPublicKey: null,
    };

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
    }

    private sendIceCandidate(candidate: RTCIceCandidate) {
        get(ws).send(JSON.stringify({
            type: 'ice-candidate',
            data: {
                roomId: this.roomId,
                candidate: candidate,
            },
        }))
    }

    public async initialize() {
        // dont initialize twice
        if (this.peer) return;

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

            try {
                if (this.isInitiator) {
                    await this.startKeyExchange();
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
            const encrypted = (data[0] >> 7) & 1;
            const type = data[0] & 0b01111111;
            data = data.slice(1);

            console.log("parsed data", data, encrypted, type);

            if (type == WebRTCPacketType.KEY_EXCHANGE) {
                if (this.keys.peersPublicKey) {
                    console.error("Key exchange already done");
                    return;
                }

                console.log("Received key exchange", data.buffer);

                // let textDecoder = new TextDecoder();
                // let dataString = textDecoder.decode(data.buffer);

                // console.log("Received key exchange", dataString);

                // let json = JSON.parse(dataString);

                let unwrappingKey = get(roomKey);
                if (!unwrappingKey.key) throw new Error("Room key not set");

                this.keys.peersPublicKey = await window.crypto.subtle.unwrapKey(
                    "jwk",
                    data,
                    unwrappingKey.key,
                    {
                        name: "AES-KW",
                        length: 256,
                    },
                    {
                        name: "RSA-OAEP",
                        modulusLength: 4096,
                        publicExponent: new Uint8Array([1, 0, 1]),
                        hash: "SHA-256",
                    },
                    true,
                    ["encrypt"],
                );

                // if our keys are not generated, start the reponding side of the key exchange
                if (!this.keys.localKeys) {
                    await this.startKeyExchange();
                }

                // by this point, both peers should have exchanged their keys
                this.callbacks.onKeyExchangeDone();
                return;
            }

            if (encrypted) {
                data = new Uint8Array(await this.decrypt(data.buffer));
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

            get(ws).send(JSON.stringify({
                type: 'offer',
                data: {
                    roomId: this.roomId,
                    sdp: offer,
                },
            }));
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

            get(ws).send(JSON.stringify({
                type: 'answer',
                data: {
                    roomId: this.roomId,
                    sdp: answer,
                },
            }));

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
        console.log("Generating key pair");
        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: "RSA-OAEP",
                modulusLength: 4096,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: "SHA-256",
            },
            true,
            ["encrypt", "decrypt"],
        );

        if (keyPair instanceof CryptoKey) {
            throw new Error("Key pair not generated");
        }

        this.keys.localKeys = keyPair;
    }

    private async startKeyExchange() {
        console.log("Starting key exchange");
        await this.generateKeyPair();
        if (!this.keys.localKeys) throw new Error("Key pair not generated");

        let wrappingKey = get(roomKey);
        if (!wrappingKey.key) throw new Error("Room key not set");


        console.log("wrapping key", this.keys.localKeys.publicKey, wrappingKey.key);
        const exported = await window.crypto.subtle.wrapKey(
            "jwk",
            this.keys.localKeys.publicKey,
            wrappingKey.key,
            {
                name: "AES-KW",
                length: 256,
            },
        );

        console.log("wrapping key exported", exported);

        const exportedKeyBuffer = exported;

        console.log("exported key buffer", exportedKeyBuffer);

        this.send(exportedKeyBuffer, WebRTCPacketType.KEY_EXCHANGE);
    }

    private async encrypt(data: ArrayBuffer): Promise<ArrayBuffer> {
        if (!this.keys.peersPublicKey) throw new Error("Peer's public key not set");

        return await window.crypto.subtle.encrypt(
            {
                name: "RSA-OAEP",
            },
            this.keys.peersPublicKey,
            data,
        );
    }

    private async decrypt(data: ArrayBuffer): Promise<ArrayBuffer> {
        if (!this.keys.localKeys) throw new Error("Local keypair not generated");

        return await window.crypto.subtle.decrypt(
            {
                name: "RSA-OAEP",
            },
            this.keys.localKeys.privateKey,
            data,
        );
    }

    public async send(data: ArrayBuffer, type: WebRTCPacketType) {
        console.log("Sending message of type", type, "with data", data);

        if (!this.dataChannel || this.dataChannel.readyState !== 'open') throw new Error('Data channel not initialized');

        console.log(this.keys)
        let header = (type & 0x7F);

        // the key exchange is done, encrypt the message
        if (this.keys.peersPublicKey && type != WebRTCPacketType.KEY_EXCHANGE) {
            console.log("Sending encrypted message", data);

            let encryptedData = await this.encrypt(data);

            console.log("Encrypted data", encryptedData);

            header |= 1 << 7;

            let buf = new Uint8Array(encryptedData.byteLength + 1);
            buf[0] = header;
            buf.subarray(1).set(new Uint8Array(encryptedData));

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