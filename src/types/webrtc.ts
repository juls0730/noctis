import type { WebRTCPeer } from "$lib/webrtc";

export interface WebRTCPeerCallbacks {
    onConnected: () => void;
    onMessage: (message: { type: WebRTCPacketType, data: ArrayBuffer }, webRtcPeer: WebRTCPeer) => void;
    onDataChannelStateChange: (state: boolean) => void;
    onKeyExchangeDone: () => void;
    onNegotiationNeeded: () => void;
    onError: (error: any) => void;
}

// max 7 bits for the type
export enum WebRTCPacketType {
    // all bits set
    KEY_PACKAGE = 127,
    WELCOME = 126,
    GROUP_OPEN = 125,

    MESSAGE = 0,
}

export const CHUNK_SIZE = 16 * 1024 * 1024;

export interface WebRTCPacket {
    encrypted: boolean; // 1 bit
    type: WebRTCPacketType; // 7 bits

    data: ArrayBuffer;
}

export interface KeyStore {
    localKeys: CryptoKeyPair | null;
    peersPublicKey: CryptoKey | null;
}