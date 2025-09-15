<script lang="ts">
    import { onMount } from "svelte";
    import { room } from "../../stores/roomStore";
    import { ws } from "../../stores/websocketStore";
    import { WebSocketMessageType } from "../../types/websocket";
    import { dataChannelReady, error } from "../../utils/webrtcUtil";
    import { goto } from "$app/navigation";
    import RtcMessage from "../../components/RTCMessage.svelte";

    let isHost = $room.host === true;

    let awaitingJoinConfirmation = !isHost;
    let roomLink = "";
    let copyButtonText = "Copy Link";
    export let data: { roomId: string };
    const { roomId } = data;

    onMount(() => {
        error.set(null);

        roomLink = `${window.location.origin}/${roomId}`;
    });

    function handleCopyLink() {
        navigator.clipboard.writeText(roomLink).then(() => {
            copyButtonText = "Copied!";
            setTimeout(() => {
                copyButtonText = "Copy Link";
            }, 2000);
        });
    }

    function handleConfirmJoin() {
        awaitingJoinConfirmation = false;

        ws.send({
            type: WebSocketMessageType.JOIN_ROOM,
            roomId: roomId,
        });
    }

    function handleDeclineJoin() {
        // In a real app, this would close the connection and maybe redirect
        alert("You have declined to join the room.");
        awaitingJoinConfirmation = false; // Hides the prompt
        goto("/");
    }

    function handleLeave() {
        if (
            confirm(
                "Are you sure you want to leave? The chat history will be deleted.",
            )
        ) {
            // In a real app, this would disconnect the P2P session and redirect.
            window.location.href = "/";
        }
    }
</script>

<div class="max-w-6xl px-5 mx-auto flex flex-col items-center">
    {#if $error}
        <h2 class="text-3xl font-bold text-white mb-2">
            Something went wrong: {$error.toLocaleLowerCase()}
        </h2>
        <p class="!text-paragraph">
            click <a href="/">here</a> to go back to the homepage
        </p>
    {/if}

    {#if !$error}
        {#if isHost}
            {#if !$room.RTCConnectionReady}
                <h2 class="text-3xl font-bold text-white mb-2">
                    Your secure room is ready.
                </h2>
                <p class="text-gray-400 mb-6 text-center">
                    Share the link below to invite someone to chat directly with
                    you. Once they join, you will be connected automatically.
                </p>

                <div
                    class="bg-gray-900 rounded-lg p-4 flex items-center justify-between gap-4 border border-gray-600"
                >
                    <span
                        class="text-accent font-mono text-sm overflow-x-auto whitespace-nowrap"
                        >{roomLink}</span
                    >
                    <button
                        onclick={handleCopyLink}
                        class="bg-accent hover:bg-accent/80 active:bg-accent/60 cursor-pointer text-gray-900 font-bold py-2 px-4 rounded-md transition-colors whitespace-nowrap"
                    >
                        {copyButtonText}
                    </button>
                </div>
            {:else}
                <RtcMessage {room} />
            {/if}
        {:else if awaitingJoinConfirmation}
            <h2 class="text-3xl font-bold text-white mb-2">
                You're invited to chat.
            </h2>
            <div class="flex flex-row gap-2">
                <button
                    onclick={handleConfirmJoin}
                    class="bg-accent hover:bg-accent/80 active:bg-accent/60 cursor-pointer text-gray-900 font-bold py-2 px-4 rounded-md transition-colors whitespace-nowrap"
                >
                    Accept
                </button>
                <button
                    onclick={handleDeclineJoin}
                    class="bg-red-400 hover:bg-red-400/80 active:bg-red-400/60 cursor-pointer text-gray-900 font-bold py-2 px-4 rounded-md transition-colors whitespace-nowrap"
                >
                    Decline
                </button>
            </div>
        {:else}
            <RtcMessage {room} />
        {/if}
    {/if}
</div>
