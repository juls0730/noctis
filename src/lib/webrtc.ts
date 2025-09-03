import { get } from 'svelte/store';
import { ws } from '../stores/websocketStore';

interface WebRTCPeerCallbacks {
    onConnected: () => void;
    onMessage: (message: string | ArrayBuffer) => void;
    onDataChannelOpen: () => void;
    onNegotiationNeeded: () => void;
    onError: (error: any) => void;
}

export class WebRTCPeer {
    private peer: RTCPeerConnection | null = null;
    private dataChannel: RTCDataChannel | null = null;
    private isInitiator: boolean;
    private roomId: string;
    private callbacks: WebRTCPeerCallbacks;

    private iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
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
        channel.onopen = () => {
            console.log('data channel open');
            this.callbacks.onDataChannelOpen();
        };

        channel.onmessage = (event) => {
            console.log('data channel message:', event.data);
            this.callbacks.onMessage(event.data);
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
            const offer = await this.peer.createOffer();
            await this.peer.setLocalDescription(offer);

            get(ws).send(JSON.stringify({
                type: 'offer',
                data: {
                    roomId: this.roomId,
                    sdp: offer,
                },
            }));

        } catch (error) {
            console.error('Error creating offer:', error);
            this.callbacks.onError(error);
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

    public send(data: string | ArrayBuffer) {
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') throw new Error('Data channel not initialized');
        this.dataChannel.send(data);
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