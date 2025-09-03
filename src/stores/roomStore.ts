import { writable, type Writable } from 'svelte/store';
import { ConnectionState } from '../types/websocket';

export let room: Writable<string | null> = writable(null);
export let connectionState: Writable<ConnectionState> = writable(ConnectionState.DISCONNECTED);
