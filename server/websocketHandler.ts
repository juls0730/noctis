import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import { SocketMessageType, type SocketMessage } from "../src/types/websocket";

// TODO: remove stale rooms somehow
const rooms = new Map<string, WebSocket[]>();

async function createRoom(socket: WebSocket): Promise<string> {
    let roomId = Math.random().toString(36).substring(2, 10);
    rooms.set(roomId, []);

    socket.send(JSON.stringify({ type: SocketMessageType.ROOM_CREATED, data: roomId }));

    await joinRoom(roomId, socket);

    return roomId;
}

async function joinRoom(roomId: string, socket: WebSocket) {
    let room = rooms.get(roomId);
    console.log(room?.length);

    // should be unreachable
    if (!room) {
        throw new Error(`Room ${roomId} does not exist`);
    }

    if (room.length == 2) {
        socket.send(JSON.stringify({ type: SocketMessageType.ERROR, data: 'Room is full' }));
        return;
    }

    // notify all clients in the room of the new client, except the client itself
    room.forEach(client => {
        client.send(JSON.stringify({ type: SocketMessageType.JOIN_ROOM, data: roomId }));
    });
    room.push(socket);

    socket.addEventListener('close', (ev) => {
        room = rooms.get(roomId)
        if (!room) {
            return;
        }

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
            deleteRoom(roomId);
            return;
        }

        rooms.set(roomId, room.filter(client => client !== ev.target));
    });

    // TODO: consider letting rooms get larger than 2 clients
    if (room.length == 2) {
        room.forEach(async client => {
            // announce the room is ready, and tell each peer if they are the initiator
            client.send(JSON.stringify({ type: SocketMessageType.ROOM_READY, data: { isInitiator: client !== socket } }));
        });
    }

    console.log("Room created:", roomId, room.length);
}

function deleteRoom(roomId: string) {
    rooms.delete(roomId);
}

export function confgiureWebsocketServer(ws: WebSocketServer) {
    ws.on('connection', socket => {
        // Handle messages from the client
        socket.on('message', async event => {
            let message: SocketMessage | undefined = undefined;

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
                socket.send(JSON.stringify({ type: SocketMessageType.ERROR, data: 'Invalid message' }));
                return;
            }

            switch (message.type) {
                case SocketMessageType.CREATE_ROOM:
                    // else, create a new room
                    await createRoom(socket);
                    break;
                case SocketMessageType.JOIN_ROOM:
                    // if join message has a roomId, join the room
                    if (!message.roomId) {
                        socket.send(JSON.stringify({ type: SocketMessageType.ERROR, data: 'Invalid message' }));
                        return;
                    }

                    // if the user tries to join a room that doesnt exist, send an error message
                    if (rooms.get(message.roomId) == undefined) {
                        socket.send(JSON.stringify({ type: SocketMessageType.ERROR, data: 'Invalid roomId' }));
                        return;
                    }

                    await joinRoom(message.roomId, socket);

                    // the client is now in the room and the peer knows about it
                    socket.send(JSON.stringify({ type: SocketMessageType.ROOM_JOINED, roomId: message.roomId }));
                    break;
                case SocketMessageType.OFFER:
                case SocketMessageType.ANSWER:
                case SocketMessageType.ICE_CANDIDATE:
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
                    console.warn(`Unknown message type: ${message.type}`);
                    socket.send(JSON.stringify({ type: SocketMessageType.ERROR, data: 'Unknown message type' }));
                    break;
            }
        });
    });
}