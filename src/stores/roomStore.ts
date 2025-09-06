import { writable, type Writable } from 'svelte/store';
import { ConnectionState } from '../types/websocket';
import { browser } from '$app/environment';

export interface Room {
    id: string | null;
    participants: number;
    connectionState: ConnectionState;
}

export const room: Writable<Room> = writable({
    id: null,
    participants: 0,
    connectionState: ConnectionState.DISCONNECTED,
    key: null,
});