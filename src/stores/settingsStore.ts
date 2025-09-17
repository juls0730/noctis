import { writable, type Writable } from "svelte/store";

export type Settings = {
    autoDownloadImages: boolean;
    maxAutoDownloadSize: number;
};

export const settingsStore: Writable<Settings> = writable({
    autoDownloadImages: false,
    maxAutoDownloadSize: 1024 * 1024 * 10, // 10 mb
});