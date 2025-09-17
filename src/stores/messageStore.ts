import { writable, type Writable } from "svelte/store";
import type { Message } from "$types/message";

export let messages: Writable<Message[]> = writable([]);
export let advertisedOffers = writable(new Map<bigint, File>());
export let receivedOffers = writable(new Map<bigint, { name: string, size: bigint, type: string }>());
// maps request id to received file id
export let fileRequestIds: Writable<Map<bigint, { saveToDisk: boolean, offerId: bigint }>> = writable(new Map());
// maps offer id to file bytes
export let incompleteAutoDownloadedFiles: Map<bigint, Blob> = new Map();

export let downloadedImageFiles: Writable<Map<bigint, Blob>> = writable(new Map());