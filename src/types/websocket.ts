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

export interface Challenge {
    // the answer is the sha256(additionalData + target + nonce)
    target: string;
    nonce: string;
}

export enum WebSocketRequestType {
    CREATE_ROOM = "create-room",
    ROOM_JOIN = "join-room",
    ROOM_LEAVE = "leave-room",
    ROOM_STATUS = "get-room-status",
    CHALLENGE_REQUEST = "get-challenge",
}

export enum WebSocketResponseType {
    ROOM_CREATED = "room-created",
    ROOM_JOINED = "room-joined",
    ROOM_LEFT = "room-left",
    ROOM_STATUS = "room-status",
    CHALLENGE_RESPONSE = "challenge",
}

// messages sent to room participants providing information about the room
export enum WebSocketRoomMessageType {
    PARTICIPANT_LEFT = "peer-left",
    ROOM_READY = "room-ready",
    PARTICIPANT_JOINED = "peer-joined",
}

export enum WebSocketWebRtcMessageType {
    OFFER = "offer",
    ANSWER = "answer",
    ICE_CANDIDATE = "ice-candidate",
}

export enum WebSocketErrorType {
    ERROR = "error",
}

export type WebSocketMessageType = WebSocketRequestType | WebSocketResponseType | WebSocketRoomMessageType | WebSocketWebRtcMessageType | WebSocketErrorType;

// TODO: name the interfaces better
export type WebSocketMessage =
    // request messages
    | CreateRoomRequest
    | JoinRoomRequest
    | LeaveRoomRequest
    | RoomStatusRequest
    | ChallengeRequest
    // response messages
    | RoomCreatedResponse
    | RoomJoinedResponse
    | RoomLeftResponse
    | RoomStatusResponse
    | ChallengeResponse
    // room messages
    | ParticipantJoinedMessage
    | ParticipantLeftMessage
    | RoomReadyMessage
    // webrtc messages
    | WebRTCOfferMessage
    | WebRTCAnswerMessage
    | WebRTCIceCandidateMessage
    // errors
    | Error;

interface Error {
    type: WebSocketErrorType.ERROR;
    data: string;
}

// ====== Query Messages ======
interface CreateRoomRequest {
    type: WebSocketRequestType.CREATE_ROOM;
    roomName?: string;
    challenge: Challenge;
}

interface JoinRoomRequest {
    type: WebSocketRequestType.ROOM_JOIN;
    roomId: string;
    challenge: Challenge;
}

interface LeaveRoomRequest {
    type: WebSocketRequestType.ROOM_LEAVE;
    roomId: string;
}

interface RoomStatusRequest {
    type: WebSocketRequestType.ROOM_STATUS;
    roomId: string;
    challenge: Challenge;
}

interface ChallengeRequest {
    type: WebSocketRequestType.CHALLENGE_REQUEST;
}

// ====== Response Messages ======
interface RoomCreatedResponse {
    type: WebSocketResponseType.ROOM_CREATED;
    data: string;
}

interface RoomJoinedResponse {
    type: WebSocketResponseType.ROOM_JOINED;
    roomId: string;
    participants: number;
}

interface RoomLeftResponse {
    type: WebSocketResponseType.ROOM_LEFT;
    roomId: string;
}

interface RoomStatusRequest {
    type: WebSocketRequestType.ROOM_STATUS;
    roomId: string;
}

export enum RoomStatusType {
    OPEN = "open",
    FULL = "full",
    NOT_FOUND = "not-found",
}

interface RoomStatusResponse {
    type: WebSocketResponseType.ROOM_STATUS;
    roomId: string;
    status: RoomStatusType;
}

interface ChallengeResponse {
    type: WebSocketResponseType.CHALLENGE_RESPONSE;
    target: string;
    difficulty: number;
}

// ====== Room messages ======
interface ParticipantJoinedMessage {
    type: WebSocketRoomMessageType.PARTICIPANT_JOINED;
    roomId: string;
    participants: number;
}

interface ParticipantLeftMessage {
    type: WebSocketRoomMessageType.PARTICIPANT_LEFT;
    roomId: string;
    participants: number;
}

interface RoomReadyMessage {
    type: WebSocketRoomMessageType.ROOM_READY;
    data: {
        isInitiator: boolean;
        roomId: string;
        participants: number;
    };
}

// ====== WebRTC signaling messages ======
// as the server, we dont do anything with these messages other than relay them to the other peers in the room
interface WebRTCOfferMessage {
    type: WebSocketWebRtcMessageType.OFFER;
    data: {
        roomId: string;
        sdp: RTCSessionDescriptionInit;
    };
}

interface WebRTCAnswerMessage {
    type: WebSocketWebRtcMessageType.ANSWER;
    data: {
        roomId: string;
        sdp: RTCSessionDescriptionInit;
    };
}

interface WebRTCIceCandidateMessage {
    type: WebSocketWebRtcMessageType.ICE_CANDIDATE;
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