<script lang="ts">
    import { writable, type Writable } from "svelte/store";
    import { room, connectionState } from "../stores/roomStore";
    import { connected } from "../stores/websocketStore";
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
            // $messages = [...$messages, `You: ${$inputMessage}`];
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

    function pickFile() {
        inputFileElement.click();
    }
</script>

<!-- If we are in a room, connected to the websocket server, and the have been informed that we are connected to the room -->
{#if $room !== null && $connected === true && $connectionState === ConnectionState.CONNECTED}
    {#if !$isRTCConnected}
        <p>Waiting for peer to connect...</p>
    {:else if !$dataChannelReady}
        <p>Establishing data channel...</p>
    {:else if !$keyExchangeDone}
        <p>Establishing a secure connection with the peer...</p>
    {:else}
        <div
            class="flex-grow overflow-y-auto mb-4 p-2 bg-gray-800 rounded break-all"
        >
            {#each $messages as msg}
                <div>
                    <div class="w-fit h-max">
                        {#if msg.initiator}
                            You:
                        {:else}
                            Peer:
                        {/if}
                    </div>
                    <span>
                        {#if msg.type === MessageType.TEXT}
                            {msg.data}
                        {:else}
                            Unknown message type: {msg.type}
                        {/if}
                    </span>
                </div>
            {/each}
        </div>
        <input
            type="file"
            bind:files={$inputFile}
            bind:this={inputFileElement}
            class="absolute opacity-0 -top-[9999px] -left-[9999px]"
        />
        <div class="flex gap-2">
            <input
                type="text"
                bind:value={$inputMessage}
                on:keyup={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type your message..."
                class="flex-grow p-2 rounded bg-gray-700 border border-gray-600 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
                on:click={pickFile}
                disabled={!dataChannelReady}
                aria-label="Pick file"
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
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
                disabled={!dataChannelReady}
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Send
            </button>
        </div>
    {/if}
{/if}
