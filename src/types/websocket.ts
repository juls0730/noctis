export enum ConnectionState {
    CONNECTING,
    CONNECTED,
    DISCONNECTED,
}

export enum SocketMessageType {
    // requests
    CREATE_ROOM = 'create',
    JOIN_ROOM = 'join',

    // responses
    ROOM_CREATED = 'created',
    ROOM_JOINED = 'joined',
    ROOM_READY = 'ready',

    // webrtc
    ICE_CANDIDATE = 'ice-candidate',
    OFFER = 'offer',
    ANSWER = 'answer',

    ERROR = 'error',
}

type SocketMessageBase = {
    type: SocketMessageType;
};

export interface SocketMessageCreateRoom extends SocketMessageBase {
    type: SocketMessageType.CREATE_ROOM;
}

export interface SocketMessageJoinRoom extends SocketMessageBase {
    type: SocketMessageType.JOIN_ROOM;
    roomId: string;
}

export interface SocketMessageRoomCreated extends SocketMessageBase {
    type: SocketMessageType.ROOM_CREATED;
    data: {
        roomId: string;
    };
}

export interface SocketMessageRoomJoined extends SocketMessageBase {
    type: SocketMessageType.ROOM_JOINED;
    roomId: string;
}

export interface SocketMessageRoomReady extends SocketMessageBase {
    type: SocketMessageType.ROOM_READY;
    data: {
        roomId: string;
        isInitiator: boolean;
    };
}

export interface SocketMessageIceCandidate extends SocketMessageBase {
    type: SocketMessageType.ICE_CANDIDATE;
    data: {
        roomId: string;
        candidate: RTCIceCandidate;
    };
}

export interface SocketMessageOffer extends SocketMessageBase {
    type: SocketMessageType.OFFER;
    data: {
        roomId: string;
        sdp: RTCSessionDescription;
    };
}

export interface SocketMessageAnswer extends SocketMessageBase {
    type: SocketMessageType.ANSWER;
    data: {
        roomId: string;
        sdp: RTCSessionDescription;
    };
}

export interface SocketMessageError extends SocketMessageBase {
    type: SocketMessageType.ERROR;
    data: string;
}

export type SocketMessage =
    | SocketMessageCreateRoom
    | SocketMessageJoinRoom
    | SocketMessageRoomCreated
    | SocketMessageRoomJoined
    | SocketMessageRoomReady
    | SocketMessageIceCandidate
    | SocketMessageOffer
    | SocketMessageAnswer
    | SocketMessageError;
