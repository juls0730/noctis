import { writable, get, type Writable } from "svelte/store";
import { WebRTCPeer } from "$lib/webrtc";
import { WebRTCPacketType } from "../types/webrtc";
import { room, connectionState } from "../stores/roomStore";
import { ConnectionState } from "../types/websocket";
import { messages } from "../stores/messageStore";
import { MessageType, type Message } from "../types/message";

export const error = writable(null);
export let peer: Writable<WebRTCPeer | null> = writable(null);
export let isRTCConnected: Writable<boolean> = writable(false);
export let dataChannelReady: Writable<boolean> = writable(false);
export let keyExchangeDone: Writable<boolean> = writable(false);
export let roomKey: Writable<{ key: CryptoKey | null }> = writable({ key: null });

const callbacks = {
    onConnected: () => {
        console.log("Connected to peer");
        isRTCConnected.set(true);
    },
    //! TODO: come up with a more complex room system. This is largely for testing purposes
    onMessage: (message: { type: WebRTCPacketType, data: ArrayBuffer }) => {
        // onMessage: (message: string | ArrayBuffer) => {
        console.log("WebRTC Received message:", message);
        // if (typeof message === 'object' && message instanceof Blob) {
        //     // download the file
        //     const url = URL.createObjectURL(message);
        //     const a = document.createElement('a');
        //     a.href = url;
        //     a.download = message.name;
        //     document.body.appendChild(a);
        //     a.click();
        //     setTimeout(() => {
        //         document.body.removeChild(a);
        //         window.URL.revokeObjectURL(url);
        //     }, 100);
        // }

        console.log("Received message:", message);

        // TODO: fixup
        if (message.type === WebRTCPacketType.MESSAGE) {
            let textDecoder = new TextDecoder();
            let json: Message = JSON.parse(textDecoder.decode(message.data));
            json.initiator = false;
            messages.set([...get(messages), json]);
        }
    },
    onDataChannelOpen: () => {
        console.log("Data channel open");
        dataChannelReady.set(true);
    },
    onKeyExchangeDone: async () => {
        console.log("Key exchange done");
        keyExchangeDone.set(true);
    },
    onNegotiationNeeded: async () => {
        console.log("Negotiation needed");
        await get(peer)?.createOffer();
    },
    onError: (error: any) => {
        console.error("Error:", error);
        messages.set([...get(messages), { initiator: false, type: MessageType.ERROR, data: error }]);
    },
};

export async function handleMessage(event: MessageEvent) {
    console.log("Message received:", event.data);
    const message = JSON.parse(event.data);

    switch (message.type) {
        case "created":
            connectionState.set(ConnectionState.CONNECTED);
            console.log("Room created:", message.data);
            room.set(message.data);
            return;
        case "join":
            console.log("new client joined room", message.data);
            return;
        case "joined":
            connectionState.set(ConnectionState.CONNECTED);
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

            try {
                // let iv = new ArrayBuffer(message.data.roomKey.iv)

                let importedRoomKey = await window.crypto.subtle.importKey(
                    "jwk",
                    message.data.roomKey.key,
                    {
                        name: "AES-KW",
                        length: 256,
                    },
                    true,
                    ["wrapKey", "unwrapKey"],
                )
                roomKey.set({ key: importedRoomKey });
            } catch (e) {
                console.error("Error importing room key:", e);
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
