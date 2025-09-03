<script lang="ts">
    import { writable, type Writable } from "svelte/store";
    import { room } from "../stores/roomStore";
    import { connected } from "../stores/websocketStore";
    import {
        isRTCConnected,
        dataChannelReady,
        messages,
        peer,
    } from "../utils/webrtcUtil";

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

        if ($inputFile != null && $inputFile[0] !== undefined) {
            $messages = [...$messages, `You: ${$inputFile[0].name}`];
            $peer.send($inputFile[0]);
            $inputFile = null;
        }

        if ($inputMessage) {
            $messages = [...$messages, `You: ${$inputMessage}`];
            $peer.send($inputMessage);
            $inputMessage = "";
        }
    }

    function pickFile() {
        inputFileElement.click();
    }
</script>

{#if $room !== null && $connected === true}
    {#if !$isRTCConnected}
        <p>Waiting for peer to connect...</p>
    {:else if !$dataChannelReady}
        <p>Establishing data channel...</p>
    {:else}
        <div class="flex-grow overflow-y-auto mb-4 p-2 bg-gray-800 rounded">
            {#each $messages as msg}
                <p>{msg}</p>
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
