export interface WebRTCPeerCallbacks {
    onConnected: () => void;
    onMessage: (message: { type: WebRTCPacketType, data: ArrayBuffer }) => void;
    onDataChannelOpen: () => void;
    onKeyExchangeDone: () => void;
    onNegotiationNeeded: () => void;
    onError: (error: any) => void;
}

// max 7 bits for the type
export enum WebRTCPacketType {
    // all bits set
    KEY_EXCHANGE = 127,
    MESSAGE = 0,
}

export interface WebRTCPacket {
    encrypted: boolean; // 1 bit
    type: WebRTCPacketType; // 7 bits

    data: ArrayBuffer;
}

export interface KeyStore {
    localKeys: CryptoKeyPair | null;
    peersPublicKey: CryptoKey | null;
}