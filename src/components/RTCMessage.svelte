<script lang="ts">
    import { writable, type Writable } from "svelte/store";
    import { room } from "../stores/roomStore";
    import { webSocketConnected } from "../stores/websocketStore";
    import {
        isRTCConnected,
        dataChannelReady,
        peer,
        keyExchangeDone,
    } from "../utils/webrtcUtil";
    import { messages } from "../stores/messageStore";
    import { WebRTCPacketType } from "../types/webrtc";
    import { ConnectionState } from "../types/websocket";
    import { MessageType } from "../types/message";
    import { fade } from "svelte/transition";

    let inputMessage: Writable<string> = writable("");
    let inputFile = writable(null);
    let inputFileElement: HTMLInputElement;

    function sendMessage() {
        if (!$peer) {
            console.error("Peer not initialized");
            return;
        }

        if (!$inputFile && !$inputMessage) {
            return;
        }

        // if ($inputFile != null && $inputFile[0] !== undefined) {
        //     $messages = [...$messages, `You: ${$inputFile[0].name}`];
        //     $peer.send($inputFile[0]);
        //     $inputFile = null;
        // }

        if ($inputMessage) {
            $messages = [
                ...$messages,
                {
                    initiator: true,
                    type: MessageType.TEXT,
                    data: $inputMessage,
                },
            ];
            $peer.send(
                new TextEncoder().encode(
                    JSON.stringify({
                        type: MessageType.TEXT,
                        data: $inputMessage,
                    }),
                ).buffer,
                WebRTCPacketType.MESSAGE,
            );
            $inputMessage = "";
        }
    }

    let canCloseLoadingOverlay = writable(false);
    keyExchangeDone.subscribe((value) => {
        console.log("Key exchange done:", value, $keyExchangeDone);
        if (value) {
            // provide a grace period for the user to see that the connection is established
            setTimeout(() => {
                canCloseLoadingOverlay.set(true);
            }, 1000);
        }
    });

    function pickFile() {
        inputFileElement.click();
    }
</script>

<p>{$room?.id} - {$room?.connectionState} - {$webSocketConnected}</p>

<!-- If we are in a room, connected to the websocket server, and the have been informed that we are connected to the room -->
{#if $room !== null && $webSocketConnected === true && $room.connectionState === ConnectionState.CONNECTED}
    <div
        class="flex flex-col sm:max-w-4/5 lg:max-w-3/5 min-h-[calc(5/12_*_100vh)]"
    >
        <div
            class="flex-grow flex flex-col overflow-y-auto mb-4 p-2 bg-gray-800 rounded break-all relative"
        >
            {#if !$isRTCConnected || !$dataChannelReady || !$keyExchangeDone || !$canCloseLoadingOverlay}
                <div
                    transition:fade={{ duration: 300 }}
                    class="absolute top-0 left-0 bottom-0 right-0 flex justify-center items-center flex-col bg-black/55 backdrop-blur-md"
                >
                    {#if !$isRTCConnected}
                        <p>Waiting for peer to connect...</p>
                    {:else if !$dataChannelReady}
                        <p>Establishing data channel...</p>
                    {:else if !$keyExchangeDone}
                        <p>Establishing a secure connection with the peer...</p>
                    {:else}
                        <p>
                            Successfully established a secure connection to
                            peer!
                        </p>
                    {/if}
                    <div class="mt-2">
                        {#if !$keyExchangeDone}
                            <!-- loading spinner -->
                            <svg
                                class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    class="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    stroke-width="4"
                                />
                                <path
                                    class="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                            </svg>
                        {:else}
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M5 13l4 4L19 7"
                                />
                            </svg>
                        {/if}
                    </div>
                </div>
            {/if}
            {#each $messages as msg}
                <div class="flex flex-row gap-2">
                    <p class="break-keep">
                        {#if msg.initiator}
                            You:
                        {:else}
                            Peer:
                        {/if}
                    </p>
                    <p>
                        {#if msg.type === MessageType.TEXT}
                            {msg.data}
                        {:else}
                            Unknown message type: {msg.type}
                        {/if}
                    </p>
                </div>
            {/each}
        </div>
        <input
            type="file"
            bind:files={$inputFile}
            bind:this={inputFileElement}
            class="absolute opacity-0 -top-[9999px] -left-[9999px]"
        />
        <div class="flex gap-2 w-full flex-row">
            <input
                type="text"
                bind:value={$inputMessage}
                on:keyup={(e) => e.key === "Enter" && sendMessage()}
                disabled={!$isRTCConnected ||
                    !$dataChannelReady ||
                    !$keyExchangeDone}
                placeholder="Type your message..."
                class="flex-grow p-2 rounded bg-gray-700 border border-gray-600 text-gray-100 placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
                on:click={pickFile}
                disabled={!$isRTCConnected ||
                    !$dataChannelReady ||
                    !$keyExchangeDone}
                aria-label="Pick file"
                class="px-4 py-2 bg-blue-600 not-disabled:hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
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
                        d="m15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3L18 10a3 3 0 0 0-6-6l-6.5 6.5a4.5 4.5 0 0 0 9 9L21 13"
                    /></svg
                >
            </button>
            <button
                on:click={sendMessage}
                disabled={!$isRTCConnected ||
                    !$dataChannelReady ||
                    !$keyExchangeDone}
                class="px-4 py-2 bg-blue-600 not-disabled:hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Send
            </button>
        </div>
    </div>
{/if}
