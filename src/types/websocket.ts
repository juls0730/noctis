export enum RoomConnectionState {
    CONNECTING,
    RECONNECTING,
    CONNECTED,
    DISCONNECTED,
}

export interface Room {
    id: string | null;
    participants: number;
    connectionState: RoomConnectionState;
}

export enum WebSocketMessageType {
    // room messages
    CREATE_ROOM = "create",
    JOIN_ROOM = "join",
    LEAVE_ROOM = "leave",
    CHECK_ROOM_EXISTS = "check",
    REQUEST_CHALLENGE = "request-challenge",

    // response messages
    ROOM_CREATED = "created",
    ROOM_JOINED = "joined",
    ROOM_LEFT = "left",
    ROOM_READY = "ready",
    ROOM_STATUS = "status",
    CHALLENGE = "challenge",

    // webrtc messages
    WEBRTC_OFFER = "offer",
    WERTC_ANSWER = "answer",
    WEBRTC_ICE_CANDIDATE = "ice-candidate",

    ERROR = "error",
}

// TODO: name the interfaces better
export type WebSocketMessage =
    | CreateRoomMessage
    | JoinRoomMessage
    | LeaveRoomMessage
    | CheckRoomExistsMessage
    | RequestChallengeMessage
    | RoomCreatedMessage
    | RoomJoinedMessage
    | RoomLeftMessage
    | RoomStatusMessage
    | RoomReadyMessage
    | ChallengeMessage
    | OfferMessage
    | AnswerMessage
    | IceCandidateMessage
    | ErrorMessage;

interface ErrorMessage {
    type: WebSocketMessageType.ERROR;
    data: string;
}

// ====== Query Messages ======
interface CreateRoomMessage {
    type: WebSocketMessageType.CREATE_ROOM;
    roomName?: string;
    nonce: string;
    challenge: string;
}

// TODO: this is used as a query message, but it's also used as a response message
interface JoinRoomMessage {
    type: WebSocketMessageType.JOIN_ROOM;
    roomId: string;
    nonce?: string;
    challenge?: string;
}

interface LeaveRoomMessage {
    type: WebSocketMessageType.LEAVE_ROOM;
    roomId: string;
}

interface CheckRoomExistsMessage {
    type: WebSocketMessageType.CHECK_ROOM_EXISTS;
    // if sha256(roomId + challenge + nonce) has a certain number of leading zeros, then we can give the status to the user
    roomId: string;
    nonce: string;
    challenge: string;
}

interface RequestChallengeMessage {
    type: WebSocketMessageType.REQUEST_CHALLENGE;
}

// ====== Response Messages ======

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

interface RoomStatusMessage {
    type: WebSocketMessageType.ROOM_STATUS;
    roomId: string;
    status: 'found' | 'not-found';
}

interface RoomReadyMessage {
    type: WebSocketMessageType.ROOM_READY;
    data: {
        isInitiator: boolean;
    };
}

interface ChallengeMessage {
    type: WebSocketMessageType.CHALLENGE;
    challenge: string;
    difficulty: number;
}

// ====== WebRTC signaling messages ======
// as the server, we dont do anything with these messages other than relay them to the other peers in the room
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
    // maps WebSocketMessageType to an array of functions that handle that message
    // this allows for consumbers to subscribe to a specific message type and handle it themselves
    private functionStack: Map<WebSocketMessageType, Function[]>;

    constructor(webSocket: WebSocket) {
        this.ws = webSocket;

        this.ws.addEventListener("open", () => {
            console.log("WebSocket opened");
        });

        this.functionStack = new Map();

        this.ws.addEventListener("message", async (event) => {
            console.log("WebSocket received message:", event.data);
            const message: WebSocketMessage = JSON.parse(event.data);

            if (this.functionStack.has(message.type)) {
                for (let func of this.functionStack.get(message.type)!) {
                    func(message);
                }
            }
        });

        this.addEventListener = this.ws.addEventListener.bind(this.ws);
        this.removeEventListener = this.ws.removeEventListener.bind(this.ws);
        this.close = this.ws.close.bind(this.ws);
    }

    get readyState(): number {
        return this.ws.readyState;
    }

    public send(message: WebSocketMessage) {
        console.log("Sending message:", message);

        this.ws.send(JSON.stringify(message));
    }

    public handleEvent<T extends WebSocketMessageType>(messageType: T, func: (message: WebSocketMessage & { type: T }) => void): () => void {
        if (!this.functionStack.has(messageType)) {
            this.functionStack.set(messageType, []);
        }

        this.functionStack.get(messageType)!.push(func);
        return () => {
            this.functionStack.get(messageType)!.splice(this.functionStack.get(messageType)!.indexOf(func), 1);
        }
    }
}