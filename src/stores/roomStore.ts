import { writable, type Writable } from 'svelte/store';
import { RoomConnectionState } from '$types/websocket';
import { browser } from '$app/environment';

export interface Room {
    id: string | null;
    host: boolean | null;
    RTCConnectionReady: boolean;
    participants: number;
    connectionState: RoomConnectionState;
}

export const room: Writable<Room> = writable({
    id: null,
    host: null,
    RTCConnectionReady: false,
    participants: 0,
    connectionState: RoomConnectionState.DISCONNECTED,
});