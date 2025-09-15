import { WebSocketServer } from "ws";
import { Socket, WebSocketMessageType, type WebSocketMessage } from "../src/types/websocket";
import { LiveMap } from '../src/utils/liveMap.ts';

export class ServerRoom {
    private clients: Socket[] = [];

    constructor(clients?: Socket[]) {
        if (clients) {
            this.clients = clients;
        }
    }

    notifyAll(message: WebSocketMessage) {
        this.clients.forEach(client => {
            client.send(message);
        });
    }

    get length(): number {
        return this.clients.length;
    }

    push(client: Socket) {
        this.clients.push(client);
    }

    set(clients: Socket[]) {
        this.clients = clients;
    }

    filter(callback: (client: Socket) => boolean): Socket[] {
        return this.clients.filter(callback);
    }

    forEachClient(callback: (client: Socket) => void) {
        this.clients.forEach(callback);
    }
}

const rooms = new LiveMap<string, ServerRoom>();

async function createRoom(socket: Socket): Promise<string> {
    let roomId = Math.random().toString(36).substring(2, 10);
    let room = rooms.set(roomId, new ServerRoom());

    socket.send({ type: WebSocketMessageType.ROOM_CREATED, data: room.key });

    try {
        await joinRoom(room.key, socket);
    } catch (e: any) {
        throw e;
    }

    return roomId;
}

async function joinRoom(roomId: string, socket: Socket): Promise<ServerRoom | undefined> {
    let room = rooms.get(roomId);
    console.log(room?.length);

    // should be unreachable
    if (!room) {
        socket.send({ type: WebSocketMessageType.ERROR, data: `Room ${roomId} does not exist` });
        return undefined;
    }

    if (room.length == 2) {
        socket.send({ type: WebSocketMessageType.ERROR, data: "Room is full" });
        return undefined;
    }

    // notify all clients in the room of the new client, except the client itself
    room.notifyAll({ type: WebSocketMessageType.JOIN_ROOM, roomId });
    room.push(socket);

    socket.addEventListener('close', (ev) => {
        room.notifyAll({ type: WebSocketMessageType.ROOM_LEFT, roomId });

        // for some reason, when you filter the array when the length is 1 it stays at 1, but we *know* that if its 1
        // then when this client disconnects, the room should be deleted since the room is empty
        if (room.length === 1) {
            // give a 5 second grace period before deleting the room
            setTimeout(() => {
                if (rooms.get(roomId)?.length === 1) {
                    console.log("Room is empty, deleting");
                    deleteRoom(roomId);
                }
            }, 5000)
            return;
        }

        room.set(room.filter(client => client.ws !== ev.target));
    });

    // TODO: consider letting rooms get larger than 2 clients
    if (room.length == 2) {
        room.forEachClient(client => client.send({ type: WebSocketMessageType.ROOM_READY, data: { isInitiator: client !== socket } }));
    }

    console.log("Room created:", roomId, room.length);

    return room;
}

function leaveRoom(roomId: string, socket: Socket): ServerRoom | undefined {
    let room = rooms.get(roomId);
    console.log(room?.length);

    // should be unreachable
    if (!room) {
        socket.send({ type: WebSocketMessageType.ERROR, data: `Room ${roomId} does not exist` });
        return undefined;
    }

    if (room.length == 1) {
        // give a 5 second grace period before deleting the room
        setTimeout(() => {
            if (rooms.get(roomId)?.length === 1) {
                console.log("Room is empty, deleting");
                deleteRoom(roomId);
            }
        }, 5000)
        return;
    }

    room.set(room.filter(client => client !== socket));

    socket.send({ type: WebSocketMessageType.ROOM_LEFT, roomId });

    return room;
}

function deleteRoom(roomId: string) {
    rooms.delete(roomId);
}

export function confgiureWebsocketServer(wss: WebSocketServer) {
    wss.on('connection', ws => {
        // complains about dispatchEvent being undefined
        // @ts-ignore
        let socket = new Socket(ws);

        // Handle messages from the client
        ws.on('message', async event => {
            let message: WebSocketMessage | undefined = undefined;

            if (event instanceof Buffer) { // Assuming JSON is sent as a string
                try {
                    message = JSON.parse(Buffer.from(event).toString());
                } catch (e) {
                    console.error("Error parsing JSON:", e);
                }
            }

            if (message === undefined) {
                console.log("Received non-JSON message:", event);
                // If the message is not JSON, send an error message
                socket.send({ type: WebSocketMessageType.ERROR, data: 'Invalid message' });
                return;
            }

            let room: ServerRoom | undefined = undefined;

            switch (message.type) {
                case WebSocketMessageType.CREATE_ROOM:
                    // else, create a new room
                    try {
                        await createRoom(socket);
                    } catch (e: any) {
                        socket.send({ type: WebSocketMessageType.ERROR, data: e.message });
                        throw e;
                    }
                    break;
                case WebSocketMessageType.JOIN_ROOM:
                    if (!message.roomId) {
                        socket.send({ type: WebSocketMessageType.ERROR, data: 'Invalid message' });
                        return;
                    }

                    if (rooms.get(message.roomId) == undefined) {
                        socket.send({ type: WebSocketMessageType.ERROR, data: 'Invalid roomId' });
                        return;
                    }

                    room = await joinRoom(message.roomId, socket);
                    if (!room) return;

                    // the client is now in the room and the peer knows about it
                    socket.send({ type: WebSocketMessageType.ROOM_JOINED, roomId: message.roomId, participants: room.length });
                    break;
                case WebSocketMessageType.LEAVE_ROOM:
                    if (!message.roomId) {
                        socket.send({ type: WebSocketMessageType.ERROR, data: 'Invalid message' });
                        return;
                    }

                    if (rooms.get(message.roomId) == undefined) {
                        socket.send({ type: WebSocketMessageType.ERROR, data: 'Invalid roomId' });
                        return;
                    }

                    room = await leaveRoom(message.roomId, socket);
                    if (!room) return;

                    break;
                case WebSocketMessageType.WEBRTC_OFFER:
                case WebSocketMessageType.WERTC_ANSWER:
                case WebSocketMessageType.WEBRTC_ICE_CANDIDATE:
                    // relay these messages to the other peers in the room
                    room = rooms.get(message.data.roomId);

                    if (room) {
                        room.forEachClient(client => {
                            if (client !== socket) {
                                client.send(message);
                            }
                        });
                    }
                    break;
                default:
                    console.warn(`Unknown message type: ${message.type}`);
                    socket.send({ type: WebSocketMessageType.ERROR, data: 'Unknown message type' });
                    break;
            }
        });
    });
}