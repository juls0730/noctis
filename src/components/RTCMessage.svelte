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

    function sendMessage() {
        if (!$peer) {
            console.error("Peer not initialized");
            return;
        }

        $messages = [...$messages, `You: ${$inputMessage}`];
        $peer.send($inputMessage);
        $inputMessage = "";
    }
</script>

{#if $room && $connected}
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

        <div class="flex gap-2">
            <input
                type="text"
                bind:value={$inputMessage}
                on:keyup={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type your message..."
                class="flex-grow p-2 rounded bg-gray-700 border border-gray-600 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
                on:click={sendMessage}
                disabled={!dataChannelReady}
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Send
            </button>
        </div>
    {/if}
{:else}
    <p>Waiting for peer to connect...</p>
{/if}
