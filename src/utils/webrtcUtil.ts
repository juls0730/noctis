import { onDestroy, onMount } from "svelte";
import { writable, get, type Writable } from "svelte/store";
import { WebRTCPeer } from "$lib/webrtc";
import { connected, ws } from "../stores/websocketStore";
import { room } from "../stores/roomStore";

export const error = writable(null);
export let peer: Writable<WebRTCPeer | null> = writable(null);
export let messages: Writable<string[]> = writable([]);
export let isRTCConnected: Writable<boolean> = writable(false);
export let dataChannelReady: Writable<boolean> = writable(false);

const callbacks = {
    onConnected: () => {
        console.log("Connected to peer");
        isRTCConnected.set(true);
    },
    onMessage: (message: string | ArrayBuffer) => {
        console.log("Received message:", message);
        messages.set([...get(messages), `Peer: ${message}`]);
    },
    onDataChannelOpen: () => {
        console.log("Data channel open");
        dataChannelReady.set(true);
    },
    onNegotiationNeeded: async () => {
        console.log("Negotiation needed");
        await get(peer)?.createOffer();
    },
    onError: (error: any) => {
        console.error("Error:", error);
        messages.set([...get(messages), `Error: ${error}`]);
    },
};

export async function handleMessage(event: MessageEvent) {
    console.log("Message received:", event.data);
    const message = JSON.parse(event.data);

    switch (message.type) {
        case "created":
            console.log("Room created:", message.data);
            room.set(message.data);
            return;
        case "joined":
            console.log("Joined room:", message.data);
            return;
        case "error":
            console.error("Error:", message.data);
            error.set(message.data);
            return;
        case "ready":
            const roomId = get(room);

            if (!roomId) {
                console.error("Room not set");
                return;
            }

            peer.set(new WebRTCPeer(
                roomId,
                message.data.isInitiator,
                callbacks,
            ));
            await get(peer)?.initialize();
            if (message.data.isInitiator) {
                await get(peer)?.createOffer();
            }
            return;
        default:
            console.warn(`Unknown message type: ${message.type}`);
    }

    if (!get(peer)) {
        console.error("Unknown message type:", message.type);
        return;
    }

    switch (message.type) {
        case "offer":
            console.log("Received offer");
            await get(peer)?.setRemoteDescription(
                new RTCSessionDescription(message.data.sdp),
            );
            await get(peer)?.createAnswer();
            return;
        case "answer":
            console.log("Received answer");
            await get(peer)?.setRemoteDescription(
                new RTCSessionDescription(message.data.sdp),
            );
            return;
        case "ice-candidate":
            console.log("Received ICE candidate");
            await get(peer)?.addIceCandidate(message.data.candidate);
            return;
        default:
            console.warn(
                `Unknown message type: ${message.type} from ${get(room)}`,
            );
    }
}
