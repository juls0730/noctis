import { get, writable } from 'svelte/store';
import { browser } from '$app/environment';
import { room } from './roomStore';
import { ConnectionState, Socket, WebSocketMessageType } from '../types/websocket';

let socket: Socket | null = null;
export const webSocketConnected = writable(false);

function createSocket(): Socket {
    if (!browser) {
        // this only occurs on the server, which we dont care about because its not a client that can actually connect to the websocket server
        // @ts-ignore
        return null;
    }

    if (socket) {
        return socket;
    }

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new Socket(new WebSocket(`${protocol}//${location.host}/`));

    socket.addEventListener('open', () => {
        webSocketConnected.set(true);
        console.log('Connected to websocket server');
    });

    socket.addEventListener('close', () => {
        // TODO: massively rework the reconnection logic, currently it only works if one client disconnects, if the
        // TODO: other client disconnects after the other client has diconnected at least once, everything explodes
        if (get(webSocketConnected) && get(room)?.connectionState === ConnectionState.CONNECTED) {
            room.update((room) => ({ ...room, connectionState: ConnectionState.RECONNECTING }));

            setTimeout(() => {
                ws.set(createSocket());

                // attempt to rejoin the room if we were previously connected
                get(ws).addEventListener('open', () => {
                    let oldRoomId = get(room)?.id;
                    if (oldRoomId) {
                        get(ws).send({ type: WebSocketMessageType.JOIN_ROOM, roomId: oldRoomId });
                        room.update((room) => ({ ...room, connectionState: ConnectionState.CONNECTED }));
                    }
                });
            }, 1000);
        }
        webSocketConnected.set(false);
        socket = null;
        console.log('Disconnected from websocket server, reconnecting...');
    });

    return socket;
}

export const ws = writable(createSocket());
