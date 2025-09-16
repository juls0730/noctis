import { writable, get, type Writable } from "svelte/store";
import { WebRTCPeer } from "$lib/webrtc";
import { WebRTCPacketType } from "$types/webrtc";
import { room } from "$stores/roomStore";
import { RoomConnectionState, type Room } from "$types/websocket";
import { advertisedOffers, fileRequestIds, messages, receivedOffers } from "$stores/messageStore";
import { MessageType, type Message } from "$types/message";
import { WebSocketMessageType, type WebSocketMessage } from "$types/websocket";
import { WebBuffer } from "./buffer";
import { goto } from "$app/navigation";

export const error: Writable<string | null> = writable(null);
export let peer: Writable<WebRTCPeer | null> = writable(null);
export let isRTCConnected: Writable<boolean> = writable(false);
export let dataChannelReady: Writable<boolean> = writable(false);
export let keyExchangeDone: Writable<boolean> = writable(false);

let downloadStream: WritableStream<Uint8Array> | undefined;
let downloadWriter: WritableStreamDefaultWriter<Uint8Array<ArrayBufferLike>> | undefined;

let fileAck: Map<bigint, Writable<boolean>> = new Map();

function beforeUnload(event: BeforeUnloadEvent) {
    event.preventDefault();
    event.returnValue = true;
}

function onPageHide(event: PageTransitionEvent) {
    if (event.persisted) {
        // page is frozen, but not closed
        return;
    }
    if (downloadWriter && !downloadWriter.closed) {
        downloadWriter.abort();
    }
    if (downloadStream) {
        downloadStream.getWriter().abort();
    }
    downloadStream = undefined;
    downloadWriter = undefined;

}

const callbacks = {
    onConnected: () => {
        console.log("Connected to peer");
        isRTCConnected.set(true);
    },
    //! TODO: come up with a more complex room system. This is largely for testing purposes
    onMessage: async (message: { type: WebRTCPacketType, data: ArrayBuffer }, webRtcPeer: WebRTCPeer) => {
        console.log("WebRTC Received message:", message);
        if (message.type !== WebRTCPacketType.MESSAGE) {
            return;
        }

        console.log("Received message:", message.type, new Uint8Array(message.data));

        let messageBuf = new WebBuffer(message.data);
        console.log("manually extracted type:", messageBuf[0]);

        let messageType = messageBuf[0] as MessageType;
        let messageData = messageBuf.slice(1);
        let textDecoder = new TextDecoder();

        console.log("Received message:", messageType, messageData);

        switch (messageType) {
            case MessageType.TEXT:
                messages.set([...get(messages), {
                    initiator: false,
                    type: messageType,
                    data: textDecoder.decode(messageData.buffer),
                }]);
                break;
            case MessageType.FILE_OFFER:
                let fileSize = messageData.readBigInt64LE();
                let fileNameSize = messageData.readInt16LE();
                let fileName = messageData.readString(fileNameSize);
                let id = messageData.readBigInt64LE();

                get(receivedOffers).set(id, { name: fileName, size: fileSize });

                messages.set([...get(messages), {
                    initiator: false,
                    type: messageType,
                    data: {
                        fileSize,
                        fileNameSize,
                        fileName,
                        id,
                        text: messageData.peek() ? messageData.readString() : null,
                    }
                }]);
                break;
            case MessageType.FILE_REQUEST:
                // the id that coresponds to our file offer
                let offerId = messageData.readBigInt64LE();
                if (!get(advertisedOffers).has(offerId)) {
                    console.error("Unknown file offer id:", offerId);
                    return;
                }

                let targetFile = get(advertisedOffers).get(offerId)!;
                let fileStream = targetFile.stream();
                let fileReader = fileStream.getReader();

                let idleTimeout = setTimeout(() => {
                    console.error("Timed out waiting for file ack");
                    fileReader.cancel();
                }, 30000);

                // the id we send the file data with
                let fileRequestId = messageData.readBigInt64LE();
                let fileChunk = await fileReader.read();

                // reactive variable to track if the peer received the chunk
                fileAck.set(fileRequestId, writable(false));

                function sendChunk() {
                    if (!fileChunk.value) {
                        clearTimeout(idleTimeout);
                        fileReader.cancel();
                        console.error("Chunk not set");
                        return;
                    }

                    // header + id + data
                    let fileBuf = new WebBuffer(new Uint8Array(1 + 8 + fileChunk.value.byteLength).buffer);

                    fileBuf.writeInt8(MessageType.FILE);
                    fileBuf.writeBigInt64LE(fileRequestId);
                    fileBuf.write(fileChunk.value);
                    webRtcPeer.send(fileBuf.buffer, WebRTCPacketType.MESSAGE);
                }

                sendChunk();

                let unsubscribe = fileAck.get(fileRequestId)!.subscribe(async (value) => {
                    if (!value) {
                        return;
                    }

                    fileChunk = await fileReader.read();

                    if (fileChunk.done) {
                        // send the done message
                        let fileDoneBuf = new WebBuffer(new ArrayBuffer(1 + 8));
                        fileDoneBuf.writeInt8(MessageType.FILE_DONE);
                        fileDoneBuf.writeBigInt64LE(fileRequestId);
                        webRtcPeer.send(fileDoneBuf.buffer, WebRTCPacketType.MESSAGE);

                        // cleanup
                        fileReader.cancel();
                        fileAck.delete(fileRequestId);
                        clearTimeout(idleTimeout);
                        unsubscribe();
                        return;
                    }

                    sendChunk();
                    fileAck.get(fileRequestId)!.set(false);
                    clearTimeout(idleTimeout);
                    idleTimeout = setTimeout(() => {
                        console.error("Timed out waiting for file ack");
                        fileReader.cancel();
                    }, 30000);
                });


                console.log("Received file request");
                break;
            case MessageType.FILE:
                let requestId = messageData.readBigInt64LE();
                let receivedOffserId = get(fileRequestIds).get(requestId);
                if (!receivedOffserId) {
                    console.error("Received file message for unknown file id:", requestId);
                    return;
                }

                let file = get(receivedOffers).get(receivedOffserId);
                if (!file) {
                    console.error("Unknown file id:", requestId);
                    return;
                }

                if (downloadStream === undefined) {
                    window.addEventListener("pagehide", onPageHide);
                    window.addEventListener("beforeunload", beforeUnload);

                    // @ts-ignore
                    downloadStream = window.streamSaver.createWriteStream(file.name, { size: Number(file.size) });
                    downloadWriter = downloadStream!.getWriter();
                }

                await downloadWriter!.write(new Uint8Array(messageData.read()));

                let fileAckBuf = new WebBuffer(new ArrayBuffer(1 + 8));
                fileAckBuf.writeInt8(MessageType.FILE_ACK);
                fileAckBuf.writeBigInt64LE(requestId);
                webRtcPeer.send(fileAckBuf.buffer, WebRTCPacketType.MESSAGE);

                break;
            case MessageType.FILE_DONE:
                console.log("Received file done");
                let fileDoneId = messageData.readBigInt64LE();
                if (!get(fileRequestIds).has(fileDoneId)) {
                    console.error("Unknown file done id:", fileDoneId);
                    return;
                }

                window.removeEventListener("pagehide", onPageHide);
                window.removeEventListener("beforeunload", beforeUnload);

                if (downloadWriter) {
                    downloadWriter.close();
                    downloadWriter = undefined;
                    downloadStream = undefined;
                }

                break;
            case MessageType.FILE_ACK:
                console.log("Received file ack");
                let fileAckId = messageData.readBigInt64LE();
                if (!fileAck.has(fileAckId)) {
                    console.error("Unknown file ack id:", fileAckId);
                    return;
                }

                fileAck.get(fileAckId)!.set(true);
                break;
            default:
                console.warn("Unhandled message type:", messageType);
                break;
        }
    },
    onDataChannelStateChange: (state: boolean) => {
        console.log(`Data channel ${state ? "open" : "closed"}`);
        dataChannelReady.set(state);
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
            room.set({ id: message.data, host: true, RTCConnectionReady: false, connectionState: RoomConnectionState.CONNECTED, participants: 1 });
            goto(`/${message.data}`);
            return;
        case WebSocketMessageType.JOIN_ROOM:
            console.log("new client joined room");
            room.update((room) => ({ ...room, participants: room.participants + 1 }));
            return;
        case WebSocketMessageType.ROOM_JOINED:
            // TODO: if a client disconnects, we need to resync the room state

            room.set({ host: false, id: message.roomId, RTCConnectionReady: false, connectionState: RoomConnectionState.CONNECTED, participants: message.participants });
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

            room.update(r => ({ ...r, RTCConnectionReady: true }));

            console.log("Creating peer");
            peer.set(new WebRTCPeer(
                roomId,
                message.data.isInitiator,
                callbacks,
            ));

            await get(peer)!.initialize();
            return;
    }

    if (!get(peer)) {
        console.debug("Unhandled message type:", message.type);
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
            console.debug(
                `Unknown message type: ${message.type} from ${get(room).id}`,
            );
    }
}
