<script lang="ts">
    import { page } from "$app/state";
    import { onDestroy, onMount } from "svelte";
    import { room, connectionState } from "../../stores/roomStore";
    import { error, handleMessage, peer } from "../../utils/webrtcUtil";
    import { ws, connected } from "../../stores/websocketStore";
    import RtcMessage from "../../components/RTCMessage.svelte";
    import { ConnectionState } from "../../types/websocket";

    if (!page.params.roomId) {
        throw new Error("Room ID not provided");
    }

    // subscribe to the websocket store
    room.set(page.params.roomId);

    onMount(async () => {
        $ws.addEventListener("message", handleMessage);

        $ws.onopen = () => {
            $connectionState = ConnectionState.CONNECTING;
            $ws.send(JSON.stringify({ type: "join", roomId: $room }));
        };
    });

    onDestroy(() => {
        if ($ws) {
            $connectionState = ConnectionState.DISCONNECTED;
            $ws.close();
        }
        if ($peer) {
            $peer.close();
        }
    });
</script>

<div class="p-4">
    {#if $error}
        <p>Whoops! That room doesn't exist.</p>
    {:else if !$connected || $connectionState === ConnectionState.CONNECTING}
        <p>Connecting to server...</p>
    {:else}
        <RtcMessage />
    {/if}
</div>
