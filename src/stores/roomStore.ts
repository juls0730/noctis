import { writable, type Writable } from 'svelte/store';

export let room: Writable<string | null> = writable(null);