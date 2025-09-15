import { writable, type Writable } from "svelte/store";
import type { Message } from "../types/message";

export let messages: Writable<Message[]> = writable([]);
export let advertisedOffers = writable(new Map<bigint, File>());
export let receivedOffers = writable(new Map<bigint, { name: string, size: bigint }>());
// maps request id to received file id
export let fileRequestIds: Writable<Map<bigint, bigint>> = writable(new Map());
