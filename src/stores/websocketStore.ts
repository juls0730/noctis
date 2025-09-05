import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export enum WebSocketMessageType {
    // room messages
    CREATE_ROOM = "create",
    JOIN_ROOM = "join",

    // response messages
    ROOM_CREATED = "created",
    ROOM_JOINED = "joined",
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
    | RoomCreatedMessage
    | RoomJoinedMessage
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

interface RoomCreatedMessage {
    type: WebSocketMessageType.ROOM_CREATED;
    data: string;
}

interface RoomJoinedMessage {
    type: WebSocketMessageType.ROOM_JOINED;
    roomId: string;
}

interface RoomReadyMessage {
    type: WebSocketMessageType.ROOM_READY;
    data: {
        isInitiator: boolean;
        roomKey: {
            key: JsonWebKey;
        };
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

export class Socket {
    private ws: WebSocket;

    public addEventListener: typeof WebSocket.prototype.addEventListener;
    public removeEventListener: typeof WebSocket.prototype.removeEventListener;
    public dispatchEvent: typeof WebSocket.prototype.dispatchEvent;
    public close: typeof WebSocket.prototype.close;

    constructor(public url: string, public protocols?: string | string[] | undefined) {
        this.ws = new WebSocket(url, protocols);

        this.ws.addEventListener("open", () => {
            console.log("WebSocket opened");
        });

        this.addEventListener = this.ws.addEventListener.bind(this.ws);
        this.removeEventListener = this.ws.removeEventListener.bind(this.ws);
        this.dispatchEvent = this.ws.dispatchEvent.bind(this.ws);
        this.close = this.ws.close.bind(this.ws);
    }

    public send(message: WebSocketMessage) {
        console.log("Sending message:", message);

        this.ws.send(JSON.stringify(message));
    }
}

let socket: Socket | null = null;
export const webSocketConnected = writable(false);

function createSocket(): Socket {
    if (!browser) {
        return null;
    }

    if (socket) {
        return socket;
    }

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new Socket(`${protocol}//${location.host}/`);

    socket.addEventListener('open', () => {
        webSocketConnected.set(true);
        console.log('Connected to websocket server');
    });

    socket.addEventListener('close', () => {
        webSocketConnected.set(false);
        socket = null;
        console.log('Disconnected from websocket server, reconnecting...');
        setTimeout(() => {
            ws.set(createSocket());
        }, 1000);
    });

    return socket;
}

export const ws = writable(createSocket());
