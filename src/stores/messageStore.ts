import { writable, type Writable } from "svelte/store";
import type { Message } from "../types/message";

export let messages: Writable<Message[]> = writable([]);