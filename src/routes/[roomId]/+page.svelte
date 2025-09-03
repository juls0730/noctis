<script lang="ts">
    import { page } from "$app/state";
    import { onDestroy, onMount } from "svelte";
    import { room } from "../../stores/roomStore";
    import { error, handleMessage, peer } from "../../utils/webrtcUtil";
    import { ws } from "../../stores/websocketStore";
    import RtcMessage from "../../components/RTCMessage.svelte";

    if (!page.params.roomId) {
        throw new Error("Room ID not provided");
    }

    // subscribe to the websocket store
    room.set(page.params.roomId);

    onMount(async () => {
        $ws.addEventListener("message", handleMessage);

        $ws.onopen = () => {
            $ws.send(JSON.stringify({ type: "join", data: $room }));
        };
    });

    onDestroy(() => {
        if ($ws) {
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
    {:else}
        <RtcMessage />
    {/if}
</div>
