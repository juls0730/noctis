export enum ConnectionState {
    CONNECTING,
    RECONNECTING,
    CONNECTED,
    DISCONNECTED,
}

export interface Room {
    id: string | null;
    participants: number;
    connectionState: ConnectionState;
}

export enum WebSocketMessageType {
    // room messages
    CREATE_ROOM = "create",
    JOIN_ROOM = "join",
    LEAVE_ROOM = "leave",

    // response messages
    ROOM_CREATED = "created",
    ROOM_JOINED = "joined",
    ROOM_LEFT = "left",
    ROOM_READY = "ready",

    // webrtc messages
    WEBRTC_OFFER = "offer",
    WERTC_ANSWER = "answer",
    WEBRTC_ICE_CANDIDATE = "ice-candidate",

    ERROR = "error",
}

export type WebSocketMessage =
    | CreateRoomMessage
    | JoinRoomMessage
    | LeaveRoomMessage
    | RoomCreatedMessage
    | RoomJoinedMessage
    | RoomLeftMessage
    | RoomReadyMessage
    | OfferMessage
    | AnswerMessage
    | IceCandidateMessage
    | ErrorMessage;

interface ErrorMessage {
    type: WebSocketMessageType.ERROR;
    data: string;
}

interface CreateRoomMessage {
    type: WebSocketMessageType.CREATE_ROOM;
}

interface JoinRoomMessage {
    type: WebSocketMessageType.JOIN_ROOM;
    roomId: string;
}

interface LeaveRoomMessage {
    type: WebSocketMessageType.LEAVE_ROOM;
    roomId: string;
}

interface RoomCreatedMessage {
    type: WebSocketMessageType.ROOM_CREATED;
    data: string;
}

interface RoomJoinedMessage {
    type: WebSocketMessageType.ROOM_JOINED;
    roomId: string;
    participants: number;
}

interface RoomLeftMessage {
    type: WebSocketMessageType.ROOM_LEFT;
    roomId: string;
}

interface RoomReadyMessage {
    type: WebSocketMessageType.ROOM_READY;
    data: {
        isInitiator: boolean;
    };
}

interface OfferMessage {
    type: WebSocketMessageType.WEBRTC_OFFER;
    data: {
        roomId: string;
        sdp: RTCSessionDescriptionInit;
    };
}

interface AnswerMessage {
    type: WebSocketMessageType.WERTC_ANSWER;
    data: {
        roomId: string;
        sdp: RTCSessionDescriptionInit;
    };
}

interface IceCandidateMessage {
    type: WebSocketMessageType.WEBRTC_ICE_CANDIDATE;
    data: {
        roomId: string;
        candidate: RTCIceCandidateInit;
    };
}

export interface SocketCallbacks {
    onOpen: () => void;
    onClose: () => void;
}

export class Socket {
    public ws: WebSocket;

    public addEventListener: typeof WebSocket.prototype.addEventListener;
    public removeEventListener: typeof WebSocket.prototype.removeEventListener;
    public close: typeof WebSocket.prototype.close;

    constructor(webSocket: WebSocket) {
        this.ws = webSocket;

        this.ws.addEventListener("open", () => {
            console.log("WebSocket opened");
        });

        this.addEventListener = this.ws.addEventListener.bind(this.ws);
        this.removeEventListener = this.ws.removeEventListener.bind(this.ws);
        this.close = this.ws.close.bind(this.ws);
    }

    public send(message: WebSocketMessage) {
        console.log("Sending message:", message);

        this.ws.send(JSON.stringify(message));
    }
}