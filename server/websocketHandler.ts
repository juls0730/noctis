import { json } from "@sveltejs/kit";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";

// TODO: remove stale rooms somehow
const rooms = new Map<string, WebSocket[]>();

enum MessageType {
    CREATE_ROOM = 'create',
    JOIN_ROOM = 'join',
    ROOM_CREATED = 'created',
    ROOM_JOINED = 'joined',
    ROOM_READY = 'ready',
    ICE_CANDIDATE = 'ice-candidate',
    OFFER = 'offer',
    ANSWER = 'answer',
    ERROR = 'error',
}

type Message = {
    type: MessageType;
    data: any;
};

function createRoom(socket: WebSocket): string {
    let roomId = Math.random().toString(36).substring(2, 10);
    rooms.set(roomId, [socket]);

    return roomId;
}

function joinRoom(roomId: string, socket: WebSocket) {
    const room = rooms.get(roomId);

    // should be unreachable
    if (!room) {
        throw new Error(`Room ${roomId} does not exist`);
    }

    // notify all clients in the room of the new client, except the client itself
    room.forEach(client => {
        client.send(JSON.stringify({ type: MessageType.JOIN_ROOM, data: roomId }));
    });
    room.push(socket);

    // the client is now in the room and the peer knows about it
    socket.send(JSON.stringify({ type: MessageType.ROOM_JOINED, data: null }));

    // TODO: consider letting rooms get larger than 2 clients
    if (room.length == 2) {
        room.forEach(client => {
            // announce the room is ready, and tell each peer if they are the initiator
            client.send(JSON.stringify({ type: MessageType.ROOM_READY, data: { isInitiator: client !== socket } }));
        });
    }
}

function deleteRoom(roomId: string) {
    rooms.delete(roomId);
}

export function confgiureWebsocketServer(ws: WebSocketServer) {
    ws.on('connection', socket => {
        // Handle messages from the client
        socket.on('message', event => {
            console.log(event, typeof event);

            let message;

            if (event instanceof Buffer) { // Assuming JSON is sent as a string
                try {
                    const jsonObject = JSON.parse(Buffer.from(event).toString());
                    // TODO: validate the message
                    message = jsonObject as Message;
                } catch (e) {
                    console.error("Error parsing JSON:", e);
                }
            }

            if (!message) {
                console.log("Received non-JSON message:", event);
                // If the message is not JSON, send an error message
                socket.send(JSON.stringify({ type: MessageType.ERROR, data: 'Invalid message' }));
                return;
            }

            let { type } = message;

            // coerce type to a MessageType enum
            type = type as MessageType;

            switch (type) {
                case MessageType.CREATE_ROOM:
                    // else, create a new room
                    const roomId = createRoom(socket);
                    socket.send(JSON.stringify({ type: MessageType.ROOM_CREATED, data: roomId }));
                    break;
                case MessageType.JOIN_ROOM:
                    // if join message has a roomId, join the room
                    if (!message.data) {
                        socket.send(JSON.stringify({ type: MessageType.ERROR, data: 'Invalid message' }));
                        return;
                    }

                    // if the user tries to join a room that doesnt exist, send an error message
                    if (rooms.get(message.data) == undefined) {
                        socket.send(JSON.stringify({ type: MessageType.ERROR, data: 'Invalid roomId' }));
                        return;
                    }

                    joinRoom(message.data, socket);
                    break;
                case MessageType.OFFER:
                case MessageType.ANSWER:
                case MessageType.ICE_CANDIDATE:
                    // relay these messages to the other peers in the room
                    const room = rooms.get(message.data.roomId);

                    if (room) {
                        room.forEach(client => {
                            if (client !== socket) {
                                client.send(JSON.stringify(message));
                            }
                        });
                    }
                    break;
                default:
                    console.warn(`Unknown message type: ${type}`);
                    socket.send(JSON.stringify({ type: MessageType.ERROR, data: 'Unknown message type' }));
                    break;
            }
        });

        // Handle client disconnection
        socket.on('close', () => {
            // TODO: if this client was in a room, remove them from the room
        });
    });
}