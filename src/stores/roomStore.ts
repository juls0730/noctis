import { writable, type Writable } from 'svelte/store';
import { ConnectionState } from '../types/websocket';

export interface Room {
    id: string | null;
    connectionState: ConnectionState;
}

export const room: Writable<Room> = writable({
    id: null,
    connectionState: ConnectionState.DISCONNECTED,
    key: null,
});