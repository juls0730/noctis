<script lang="ts">
    import { ws, webSocketConnected } from "../stores/websocketStore";
    import { WebSocketMessageType } from "../types/websocket";
    import { room } from "../stores/roomStore";
    import { browser } from "$app/environment";
    import { peer, handleMessage } from "../utils/webrtcUtil";
    import { onDestroy, onMount } from "svelte";
    import RtcMessage from "../components/RTCMessage.svelte";
    import { ConnectionState } from "../types/websocket";

    onMount(async () => {
        $ws.addEventListener("message", handleMessage);
    });

    onDestroy(() => {
        if ($ws) {
            room.update((room) => ({
                ...room,
                connectionState: ConnectionState.DISCONNECTED,
            }));
            $ws.removeEventListener("message", handleMessage);
        }
        if ($peer) {
            $peer.close();
        }
    });
</script>

<div class="p-4">
    <h1>Welcome to Wormhole!</h1>

    {#if $webSocketConnected}
        <button
            onclick={() => {
                // if we are in a room already, leave it
                if ($room.id) {
                    $ws.send({
                        type: WebSocketMessageType.LEAVE_ROOM,
                        roomId: $room.id,
                    });
                    $peer?.close();
                    peer.set(null);
                    room.update((room) => ({
                        ...room,
                        connectionState: ConnectionState.DISCONNECTED,
                    }));
                }
                $ws.send({ type: WebSocketMessageType.CREATE_ROOM }); // send a message when the button is clicked
            }}>Create Room</button
        >
    {:else}
        <p>Connecting to server...</p>
    {/if}

    {#if $room.id && browser}
        <p>Room created!</p>
        <p>Share this link with your friend:</p>
        <a href={`${location.origin}/${$room}`}>{location.origin}/{$room.id}</a>
    {/if}

    <RtcMessage {room} />
</div>
