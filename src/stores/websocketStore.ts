import { writable } from 'svelte/store';
import { browser } from '$app/environment';

let socket: WebSocket | null = null;
export const connected = writable(false);

function createSocket(): WebSocket {
    if (!browser) {
        return null;
    }

    if (socket) {
        return socket;
    }

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${location.host}/`);

    socket.addEventListener('open', () => {
        connected.set(true);
        console.log('Connected to websocket server');
    });

    socket.addEventListener('close', () => {
        connected.set(false);
        console.log('Disconnected from websocket server');
    });

    return socket;
}

export const ws = writable(createSocket());
