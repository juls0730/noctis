<script lang="ts">
    import { page } from "$app/state";
    import { onDestroy, onMount } from "svelte";
    import { room } from "../../stores/roomStore";
    import { error, handleMessage, peer } from "../../utils/webrtcUtil";
    import {
        ws,
        webSocketConnected,
        WebSocketMessageType,
    } from "../../stores/websocketStore";
    import RtcMessage from "../../components/RTCMessage.svelte";
    import { ConnectionState } from "../../types/websocket";

    const roomId = page.params.roomId;
    if (roomId === undefined) {
        throw new Error("Room ID not provided");
    }

    // subscribe to the websocket store
    room.update((room) => ({ ...room, id: roomId }));

    onMount(async () => {
        $ws.addEventListener("message", handleMessage);

        webSocketConnected.subscribe((value) => {
            if (value) {
                $ws.send({ type: WebSocketMessageType.JOIN_ROOM, roomId });
            }
        });
        // $ws.onopen = () => {
        //     room.update((room) => ({
        //         ...room,
        //         connectionState: ConnectionState.CONNECTING,
        //     }));
        //     $ws.send({ type: WebSocketMessageType.JOIN_ROOM, roomId });
        // };
    });

    onDestroy(() => {
        if ($ws) {
            room.update((room) => ({
                ...room,
                connectionState: ConnectionState.DISCONNECTED,
            }));
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
    {:else if !$webSocketConnected || $room.connectionState === ConnectionState.CONNECTING}
        <p>Connecting to server...</p>
    {:else}
        <RtcMessage />
    {/if}
</div>
