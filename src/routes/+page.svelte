<script lang="ts">
    import { ws, connected } from "../stores/websocketStore";
    import { room, connectionState } from "../stores/roomStore";
    import { browser } from "$app/environment";
    import { peer, handleMessage } from "../utils/webrtcUtil";
    import { onDestroy, onMount } from "svelte";
    import RtcMessage from "../components/RTCMessage.svelte";
    import { ConnectionState } from "../types/websocket";

    onMount(async () => {
        $connectionState = ConnectionState.CONNECTING;
        $ws.addEventListener("message", handleMessage);
    });

    onDestroy(() => {
        if ($ws) {
            $connectionState = ConnectionState.DISCONNECTED;
            $ws.removeEventListener("message", handleMessage);
        }
        if ($peer) {
            $peer.close();
        }
    });
</script>

<div class="p-4">
    <h1>Welcome to Wormhole!</h1>

    {#if $connected}
        <button
            on:click={() => {
                $ws.send(JSON.stringify({ type: "create" })); // send a message when the button is clicked
            }}>Create Room</button
        >
    {:else}
        <p>Connecting to server...</p>
    {/if}

    {#if $room && browser}
        <p>Room created!</p>
        <p>Share this link with your friend:</p>
        <a href={`${location.origin}/${$room}`}>{location.origin}/{$room}</a>
    {/if}

    <RtcMessage />
</div>
