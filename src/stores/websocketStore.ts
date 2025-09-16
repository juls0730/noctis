import { get, writable, type Readable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import { Socket, WebSocketMessageType, type WebSocketMessage } from '$types/websocket';
import { handleMessage } from '../lib/webrtcUtil';

export enum WebsocketConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    RECONNECTING
}

interface WebSocketStoreValue {
    status: WebsocketConnectionState;
    socket: Socket | null;
}

export type MessageHandler = (event: MessageEvent) => void;

interface WebSocketStore extends Readable<WebSocketStoreValue> {
    connect: () => void;
    disconnect: () => void;
    send: (message: WebSocketMessage) => void;
    handleEvent<T extends WebSocketMessageType>(messageType: T, func: (message: WebSocketMessage & { type: T }) => void): () => void;
}

// TODO: handle reconnection logic to room elsewhere (not implemented here)
function createWebSocketStore(messageHandler: MessageHandler): WebSocketStore {
    const { subscribe, set, update } = writable<WebSocketStoreValue>({ status: WebsocketConnectionState.DISCONNECTED, socket: null });

    let reconnectTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;

    const send = (message: WebSocketMessage) => {
        let currentState = get({ subscribe });
        if (currentState.socket?.readyState === WebSocket.OPEN) {
            currentState.socket.send(message);
        } else {
            console.error("Socket not connected");
        }
    };

    const disconnect = () => {
        let currentState = get({ subscribe });
        if (currentState.socket) {
            currentState.socket.close();
            set({ status: WebsocketConnectionState.DISCONNECTED, socket: null });
        }
    };

    const connect = () => {
        if (!browser) {
            return;
        }

        const currentState = get({ subscribe });
        if (currentState.socket || currentState.status === WebsocketConnectionState.CONNECTING) {
            // already connected/connecting
            return;
        }

        update(s => ({ ...s, status: WebsocketConnectionState.CONNECTING }));

        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new Socket(new WebSocket(`${protocol}//${location.host}/`));

        socket.addEventListener('open', () => {
            console.log('Connected to websocket server');
            reconnectAttempts = 0;
            update(s => ({ ...s, status: WebsocketConnectionState.CONNECTED, socket }));
        });

        socket.addEventListener('message', messageHandler);

        socket.addEventListener('close', () => {
            console.log('Disconnected from websocket server,');
            update(s => ({ ...s, socket: null }));

            // exponential backoff
            const timeout = Math.min(Math.pow(2, reconnectAttempts) * 1000, 30000);
            reconnectAttempts++;

            console.log(`Reconnecting in ${timeout / 1000}s...`);
            update(s => ({ ...s, status: WebsocketConnectionState.RECONNECTING }));

            reconnectTimeout = setTimeout(() => {
                connect();
            }, timeout);
        });

        socket.addEventListener('error', () => {
            console.error('Error connecting to websocket server');
            socket.close();
            // close will trigger a reconnect
        });
    };

    function handleEvent<T extends WebSocketMessageType>(messageType: T, func: (message: WebSocketMessage & { type: T }) => void) {
        let socket = get({ subscribe }).socket;
        if (!socket) {
            return () => { };
        }

        // TODO: why does the typescript compiler think this is invalid?
        return socket.handleEvent<T>(messageType, func)
    }


    return {
        subscribe,
        connect,
        disconnect,
        send,
        handleEvent,
    };
}

export const ws = createWebSocketStore(handleMessage);