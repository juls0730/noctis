import { writable, get, type Writable } from "svelte/store";
import { WebRTCPeer } from "$lib/webrtc";
import { WebRTCPacketType } from "../types/webrtc";
import { room } from "../stores/roomStore";
import { ConnectionState, type Room } from "../types/websocket";
import { messages } from "../stores/messageStore";
import { MessageType, type Message } from "../types/message";
import { WebSocketMessageType, type WebSocketMessage } from "../types/websocket";

export const error: Writable<string | null> = writable(null);
export let peer: Writable<WebRTCPeer | null> = writable(null);
export let isRTCConnected: Writable<boolean> = writable(false);
export let dataChannelReady: Writable<boolean> = writable(false);
export let keyExchangeDone: Writable<boolean> = writable(false);

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
    console.log("Message received:", event.data, typeof event.data);
    const message: WebSocketMessage = JSON.parse(event.data);

    switch (message.type) {
        case WebSocketMessageType.ROOM_CREATED:
            console.log("Room created:", message.data);
            room.update((room) => ({ ...room, id: message.data, connectionState: ConnectionState.CONNECTED, participants: 1 }));
            return;
        case WebSocketMessageType.JOIN_ROOM:
            console.log("new client joined room");
            room.update((room) => ({ ...room, participants: room.participants + 1 }));
            return;
        case WebSocketMessageType.ROOM_JOINED:
            // TODO: if a client disconnects, somehow prove the identity of the client that left if they return. Perhaps
            // TODO: use a key derived from client's public key so that the room can only be used by clients that initiated
            // TODO: the connection
            room.update((room) => ({ ...room, connectionState: ConnectionState.CONNECTED, participants: message.participants }));
            console.log("Joined room");
            return;
        case WebSocketMessageType.ROOM_LEFT:
            room.update((room) => ({ ...room, participants: room.participants - 1 }));
            console.log("Participant left room");
            return;
        case WebSocketMessageType.ERROR:
            console.error("Error:", message.data);
            error.set(message.data);
            return;
        case WebSocketMessageType.ROOM_READY:
            let roomId = get(room).id;

            if (roomId === null) {
                console.error("Room not set");
                return;
            }

            peer.set(new WebRTCPeer(
                roomId,
                message.data.isInitiator,
                callbacks,
            ));
            await get(peer)?.initialize();
            return;
    }

    if (!get(peer)) {
        console.error("Unknown message type:", message.type);
        return;
    }

    switch (message.type) {
        case WebSocketMessageType.WEBRTC_OFFER:
            console.log("Received offer");
            await get(peer)?.setRemoteDescription(
                new RTCSessionDescription(message.data.sdp),
            );
            await get(peer)?.createAnswer();
            return;
        case WebSocketMessageType.WERTC_ANSWER:
            console.log("Received answer");
            await get(peer)?.setRemoteDescription(
                new RTCSessionDescription(message.data.sdp),
            );
            return;
        case WebSocketMessageType.WEBRTC_ICE_CANDIDATE:
            console.log("Received ICE candidate");
            await get(peer)?.addIceCandidate(message.data.candidate);
            return;
        default:
            console.warn(
                `Unknown message type: ${message.type} from ${get(room).id}`,
            );
    }
}
