<script lang="ts">
    import { derived, get, writable, type Writable } from "svelte/store";
    import { WebsocketConnectionState, ws } from "$stores/websocketStore";
    import { isRTCConnected, dataChannelReady, peer, keyExchangeDone } from "$lib/webrtcUtil";
    import {
        advertisedOffers,
        downloadedImageFiles,
        fileRequestIds,
        messages,
        receivedOffers,
    } from "$stores/messageStore";
    import { WebRTCPacketType } from "$types/webrtc";
    import { RoomConnectionState, type Room } from "$types/websocket";
    import { MessageType } from "$types/message";
    import { fade } from "svelte/transition";
    import { WebBuffer } from "../lib/buffer";
    import { onDestroy } from "svelte";
    import { settingsStore } from "$stores/settingsStore";
    import LoadingSpinner from "./LoadingSpinner.svelte";

    let inputMessage: Writable<string> = writable("");
    let inputFile: Writable<FileList | null | undefined> = writable(null);
    let inputFileElement: HTMLInputElement | null = $state(null);
    let initialConnectionComplete = writable(false);

    const { room }: { room: Writable<Room> } = $props();

    room.subscribe((newRoom) => {
        console.log("Room changed:", newRoom);
        if (newRoom.id !== $room?.id) {
            messages.set([]);
            isRTCConnected.set(false);
            dataChannelReady.set(false);
            keyExchangeDone.set(false);
        }
    });

    onDestroy(() => {
        initialConnectionComplete.set(false);
    });

    downloadedImageFiles.subscribe(() => {
        console.log("Auto downloaded files:", $downloadedImageFiles);
    });

    function sendMessage() {
        if (!$peer) {
            console.error("Peer not initialized");
            return;
        }

        let messageBuf: Uint8Array<ArrayBuffer> | undefined = undefined;

        if (!$inputFile && !$inputMessage.trim()) {
            return;
        }

        if ($inputFile != null && $inputFile[0] !== undefined) {
            // fileSize + fileNameSize + fileTypeLen + id + textLen + header
            let messageLen =
                1 + 8 + ($inputFile[0].name.length + 1) + ($inputFile[0].type.length + 1) + 8;
            if ($inputMessage.length > 0) {
                messageLen += $inputMessage.length + 1;
            }
            let messageBuf = new WebBuffer(new ArrayBuffer(messageLen));

            let fileId = new WebBuffer(
                crypto.getRandomValues(new Uint8Array(8)).buffer,
            ).readBigInt64LE();
            $advertisedOffers.set(fileId, $inputFile[0]);

            console.log(
                "Advertised file:",
                fileId,
                $inputFile[0].size,
                $inputFile[0].name,
                $inputFile[0].name.length,
            );

            messageBuf.writeInt8(MessageType.FILE_OFFER);
            messageBuf.writeBigInt64LE(BigInt($inputFile[0].size));
            messageBuf.writeString($inputFile[0].name);
            messageBuf.writeString($inputFile[0].type);
            messageBuf.writeBigInt64LE(fileId);
            if ($inputMessage.length > 0) {
                messageBuf.writeString($inputMessage);
            }

            console.log("Sending file offer", new Uint8Array(messageBuf.buffer));

            $messages = [
                ...$messages,
                {
                    initiator: true,
                    type: MessageType.FILE_OFFER,
                    data: {
                        fileSize: BigInt($inputFile[0].size),
                        fileName: $inputFile[0].name,
                        fileType: $inputFile[0].type,
                        id: fileId,
                        text: $inputMessage === "" ? null : $inputMessage,
                    },
                },
            ];

            $inputFile = null;
            $inputMessage = "";

            $peer.send(messageBuf.buffer, WebRTCPacketType.MESSAGE);
            return;
        }

        if ($inputMessage) {
            $messages = [
                ...$messages,
                {
                    initiator: true,
                    type: MessageType.TEXT,
                    data: $inputMessage,
                },
            ];

            let newMessageBuf = new ArrayBuffer(1 + $inputMessage.length);
            messageBuf = new Uint8Array(newMessageBuf);

            messageBuf[0] = MessageType.TEXT;
            messageBuf.set(new TextEncoder().encode($inputMessage), 1);

            $inputMessage = "";
        }

        if (!messageBuf) {
            return;
        }

        $peer.send(messageBuf.buffer, WebRTCPacketType.MESSAGE);
    }

    function downloadFile(id: bigint, messageIdx: number, saveToDisk: boolean = true) {
        if (!$peer) {
            console.error("Peer not initialized");
            return;
        }

        if ($messages[messageIdx].type !== MessageType.FILE_OFFER) {
            console.error("Message is not a file offer");
            return;
        }

        let file = $receivedOffers.get(id);
        if (!file) {
            console.error("Unknown file id:", id);
            return;
        }

        let requesterId = new WebBuffer(
            crypto.getRandomValues(new Uint8Array(8)).buffer,
        ).readBigInt64LE();
        let fileRequestBuf = new WebBuffer(new ArrayBuffer(1 + 8 + 8));
        fileRequestBuf.writeInt8(MessageType.FILE_REQUEST);
        fileRequestBuf.writeBigInt64LE(id);
        fileRequestBuf.writeBigInt64LE(requesterId);

        $fileRequestIds.set(requesterId, { saveToDisk, offerId: id });

        messages.update((messages) => {
            if (messages[messageIdx].type !== MessageType.FILE_OFFER) {
                console.error("Message is not a file offer");
                return messages;
            }

            messages[messageIdx].data.downloading = saveToDisk ? "downloading" : "preview";
            return messages;
        });

        $peer.send(fileRequestBuf.buffer, WebRTCPacketType.MESSAGE);
    }

    let canCloseLoadingOverlay = writable(false);
    keyExchangeDone.subscribe((value) => {
        console.log("Key exchange done:", value, $keyExchangeDone);
        if (value) {
            initialConnectionComplete.set(true);
            // provide a grace period for the user to see that the connection is established
            setTimeout(() => {
                canCloseLoadingOverlay.set(true);
            }, 1000);
        }
    });

    function pickFile() {
        if (!inputFileElement) return;

        inputFileElement.click();
    }

    function autogrow(node: HTMLElement) {
        function resize() {
            // 1. Temporarily reset height to calculate the new scrollHeight
            node.style.height = "0px";
            // 2. Set the height to the scrollHeight, which represents the full content height
            node.style.height = `${node.scrollHeight}px`;
        }

        // Call resize initially in case the textarea already has content
        resize();

        // Add an event listener to resize on every input
        node.addEventListener("input", resize);

        // Return a destroy method to clean up the event listener when the component is unmounted
        return {
            update: resize,
            destroy() {
                node.removeEventListener("input", resize);
            },
        };
    }
</script>

<!-- <p>
    {$room?.id}
    ({$room?.participants}) - {RoomConnectionState[$room?.connectionState]} - {WebsocketConnectionState[
        $ws.status
    ]} - {$isRTCConnected} - {$dataChannelReady} - {$keyExchangeDone}
    - Initial connection {$initialConnectionComplete ? "complete" : "incomplete"}
</p> -->

<!-- If we are in a room, connected to the websocket server, and have been informed that we are connected to the room -->
{#if ($room !== null && $ws.status === WebsocketConnectionState.CONNECTED && $room.connectionState === RoomConnectionState.CONNECTED) || $room.connectionState === RoomConnectionState.RECONNECTING}
    <div class="flex flex-col w-full h-[calc(100vh-72px)]">
        <div
            class="flex-grow flex flex-col overflow-y-auto mb-4 p-2 bg-surface rounded relative whitespace-break-spaces wrap-anywhere">
            {#if !$initialConnectionComplete || $room.connectionState === RoomConnectionState.RECONNECTING || $room.participants !== 2 || $dataChannelReady === false || !$canCloseLoadingOverlay}
                <div
                    transition:fade={{ duration: 300 }}
                    class="absolute top-0 left-0 bottom-0 right-0 flex justify-center items-center flex-col bg-black/55 backdrop-blur-md z-10 text-center">
                    {#if !$isRTCConnected}
                        <p>Waiting for peer to connect...</p>
                    {:else if !$dataChannelReady && !$initialConnectionComplete}
                        <p>Establishing data channel...</p>
                    {:else if !$keyExchangeDone}
                        <p>Establishing a secure connection with the peer...</p>
                    {:else if $room.connectionState === RoomConnectionState.RECONNECTING}
                        <p>Disconnect from peer, attempting to reconnecting...</p>
                    {:else if $room.participants !== 2 || $dataChannelReady === false}
                        <p>Peer has disconnected, waiting for other peer to reconnect...</p>
                    {:else}
                        <p>Successfully established a secure connection to peer!</p>
                    {/if}
                    <div class="mt-2">
                        {#if !$keyExchangeDone || $room.participants !== 2 || $dataChannelReady === false || $room.connectionState === RoomConnectionState.RECONNECTING}
                            <!-- loading spinner -->
                            <svg
                                class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24">
                                <circle
                                    class="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    stroke-width="4" />
                                <path
                                    class="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        {:else}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24">
                                <path
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M5 13l4 4L19 7" />
                            </svg>
                        {/if}
                    </div>
                </div>
            {/if}
            {#each $messages as msg, index}
                <div class="flex flex-row gap-2">
                    <p class="whitespace-nowrap">
                        {#if msg.initiator}
                            You:
                        {:else}
                            Peer:
                        {/if}
                    </p>
                    {#if msg.type === MessageType.TEXT}
                        <p>{msg.data}</p>
                    {:else if msg.type === MessageType.FILE_OFFER}
                        <div class="flex flex-col mb-2 items-start">
                            <!-- if the file was auto downloaded, OR we downloaded the file manually OR we are the sender of the image (regardless of auto download setting) -->
                            {#if msg.data.fileType.startsWith("image/")}
                                {#if $settingsStore.autoDownloadImages || $downloadedImageFiles.has(msg.data.id) || msg.initiator}
                                    {#if msg.initiator}
                                        <!-- just preview the image -->
                                        <img
                                            class="w-auto h-auto rounded"
                                            src={URL.createObjectURL(
                                                $advertisedOffers.get(msg.data.id)!,
                                            )}
                                            alt={msg.data.fileName} />
                                    {:else}
                                        <!-- wait for the image to download in the auto download queue -->
                                        {#if $downloadedImageFiles.has(msg.data.id)}
                                            <img
                                                class="max-w-3/5 h-auto rounded"
                                                src={URL.createObjectURL(
                                                    $downloadedImageFiles.get(msg.data.id)!,
                                                )}
                                                alt={msg.data.fileName} />
                                        {:else}
                                            <div
                                                class="bg-neutral-800 animate-pulse rounded w-40 h-56 text-paragraph-muted flex justify-center items-center">
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="24"
                                                    height="24"
                                                    viewBox="0 0 24 24"
                                                    ><!-- Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE --><g
                                                        fill="none"
                                                        stroke="currentColor"
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        stroke-width="2"
                                                        ><path
                                                            d="M15 8h.01M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" /><path
                                                            d="m3 16l5-5c.928-.893 2.072-.893 3 0l5 5" /><path
                                                            d="m14 14l1-1c.928-.893 2.072-.893 3 0l3 3" /></g
                                                    ></svg>
                                            </div>
                                        {/if}
                                    {/if}
                                {/if}
                            {:else}
                                {#if msg.data.text !== null}
                                    <p>
                                        {msg.data.text}
                                    </p>
                                {/if}
                                <div
                                    class="flex flex-col p-2 relative w-8/12 bg-primary/50 rounded">
                                    <h3 class="font-semibold">
                                        {msg.data.fileName}
                                    </h3>
                                    <p class="text-sm text-paragraph-muted">
                                        {msg.data.fileSize} bytes
                                    </p>
                                    <!-- as the initiator, we cant send ourselves a file -->
                                    {#if !msg.initiator}
                                        <div class="flex flex-row gap-2 absolute right-2 bottom-2">
                                            {#if msg.data.fileType.startsWith("image/")}
                                                <button
                                                    disabled={msg.data.downloading !== undefined}
                                                    onclick={() =>
                                                        downloadFile(msg.data.id, index, false)}
                                                    class="p-1 border border-[#2c3444]/80 text-paragraph hover:bg-[#1D1C1F]/60 transition-colors rounded disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
                                                    {#if msg.data.downloading === "preview"}
                                                        <LoadingSpinner size="16" />
                                                    {:else}
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            width="16"
                                                            height="16"
                                                            viewBox="0 0 24 24"
                                                            ><!-- Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE --><g
                                                                fill="none"
                                                                stroke="currentColor"
                                                                stroke-linecap="round"
                                                                stroke-linejoin="round"
                                                                stroke-width="2"
                                                                ><path
                                                                    d="M14 3v4a1 1 0 0 0 1 1h4" /><path
                                                                    d="M12 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v4.5" /><path
                                                                    d="M14 17.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0m4.5 2L21 22" /></g
                                                            ></svg>
                                                    {/if}
                                                </button>
                                            {/if}
                                            <button
                                                disabled={msg.data.downloading !== undefined}
                                                onclick={() => downloadFile(msg.data.id, index)}
                                                class="p-1 border border-[#2c3444]/80 text-paragraph hover:bg-[#1D1C1F]/60 transition-colors rounded disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
                                                {#if msg.data.downloading === "downloading"}
                                                    <LoadingSpinner size="16" />
                                                {:else}
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        width="16"
                                                        height="16"
                                                        viewBox="0 0 24 24"
                                                        ><!-- Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE --><path
                                                            fill="none"
                                                            stroke="currentColor"
                                                            stroke-linecap="round"
                                                            stroke-linejoin="round"
                                                            stroke-width="2"
                                                            d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 11l5 5l5-5m-5-7v12" /></svg>
                                                {/if}
                                            </button>
                                        </div>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    {:else}
                        <p>Unknown message type: {msg.type}</p>
                    {/if}
                </div>
            {/each}
        </div>
        <input
            type="file"
            bind:files={$inputFile}
            bind:this={inputFileElement}
            class="absolute opacity-0 -top-[9999px] -left-[9999px]" />
        <div class="flex gap-2 w-full flex-row mb-2">
            <div
                class="border rounded border-[#2c3444] focus-within:border-[#404c63] transition-colors flex-grow flex flex-col bg-[#232b3e]">
                {#if $inputFile}
                    <div class="flex flex-row gap-2 p-2">
                        <div
                            class="p-2 flex flex-col gap-2 w-48 border rounded-md border-[#2c3444] relative">
                            <div class="w-full flex justify-center">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="128"
                                    height="128"
                                    viewBox="0 0 24 24"
                                    ><!-- Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE --><g
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="1"
                                        ><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path
                                            d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2" /></g
                                    ></svg>
                            </div>
                            <p class="text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                                {$inputFile[0].name}
                            </p>

                            <button
                                onclick={() => {
                                    $inputFile = null;
                                }}
                                class="absolute right-2 top-2 p-1 border border-[#2c3444] text-paragraph hover:bg-surface/70 transition-colors rounded disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    ><!-- Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE --><path
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M18 6L6 18M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>
                    <hr class="border-[#2c3444]" />
                {/if}
                <div class="flex flex-row rounded">
                    <textarea
                        bind:value={$inputMessage}
                        cols="1"
                        use:autogrow
                        onkeydown={(e) => {
                            if (e.key === "Enter" && !e.getModifierState("Shift")) {
                                e.preventDefault();
                                sendMessage();
                            }
                        }}
                        disabled={!$isRTCConnected ||
                            !$dataChannelReady ||
                            !$keyExchangeDone ||
                            $room.connectionState === RoomConnectionState.RECONNECTING}
                        placeholder="Type your message..."
                        class="placeholder:text-paragraph-muted flex-grow p-2 bg-[#232b3e] rounded min-h-12
            focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed resize-none leading-8"
                    ></textarea>
                    <div class="flex flex-row gap-2 p-2 h-fit mt-auto">
                        <button
                            onclick={pickFile}
                            disabled={!$isRTCConnected ||
                                !$dataChannelReady ||
                                !$keyExchangeDone ||
                                $room.connectionState === RoomConnectionState.RECONNECTING}
                            aria-label="Pick file"
                            class="not-disabled:hover:bg-primary/50 h-fit p-1 text-paragraph transition-colors rounded disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                ><!-- Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE --><path
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="m15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3L18 10a3 3 0 0 0-6-6l-6.5 6.5a4.5 4.5 0 0 0 9 9L21 13" /></svg>
                        </button>
                        <button
                            onclick={sendMessage}
                            disabled={!$isRTCConnected ||
                                !$dataChannelReady ||
                                !$keyExchangeDone ||
                                $room.connectionState === RoomConnectionState.RECONNECTING}
                            class="not-disabled:hover:bg-primary/50 h-fit p-1 text-paragraph transition-colors rounded disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                ><!-- Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE --><path
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M10 14L21 3m0 0l-6.5 18a.55.55 0 0 1-1 0L10 14l-7-3.5a.55.55 0 0 1 0-1z" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}
