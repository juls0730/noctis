<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { room } from "../../stores/roomStore";
    import { error, handleMessage, peer } from "../../utils/webrtcUtil";
    import { ws, webSocketConnected } from "../../stores/websocketStore";
    import { WebSocketMessageType } from "../../types/websocket";
    import RtcMessage from "../../components/RTCMessage.svelte";
    import { ConnectionState } from "../../types/websocket";
    export let data: { roomId: string };
    const { roomId } = data;

    onMount(async () => {
        room.update((room) => ({ ...room, id: roomId }));

        $ws.addEventListener("message", handleMessage);

        webSocketConnected.subscribe((value) => {
            if (value) {
                room.update((room) => ({
                    ...room,
                    connectionState: ConnectionState.CONNECTING,
                }));

                if ($room.id === null) {
                    throw new Error("Room ID not set");
                }

                $ws.send({
                    type: WebSocketMessageType.JOIN_ROOM,
                    roomId: $room.id,
                });
            }
        });
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
        <p>Hm. Something went wrong: {$error.toLocaleLowerCase()}</p>
    {:else if $room.connectionState !== ConnectionState.CONNECTED && $room.connectionState !== ConnectionState.RECONNECTING}
        <p>Connecting to server...</p>
    {:else}
        <RtcMessage {room} />
    {/if}
</div>
