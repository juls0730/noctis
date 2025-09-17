<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { room } from "$stores/roomStore";
    import { WebsocketConnectionState, ws } from "$stores/websocketStore";
    import { RoomStatusType, WebSocketRequestType, WebSocketResponseType } from "$types/websocket";
    import { error, peer } from "$lib/webrtcUtil";
    import { goto } from "$app/navigation";
    import RtcMessage from "$components/RTCMessage.svelte";
    import { page } from "$app/state";
    import LoadingSpinner from "$components/LoadingSpinner.svelte";
    import { hashStringSHA256, solveChallenge } from "$lib/powUtil";
    import { doChallenge } from "$lib/challenge";
    import { messages } from "$stores/messageStore";
    const { roomId } = page.params;

    let isHost = $derived($room.host === true);
    let roomExists: boolean | undefined = $state(undefined);

    let awaitingJoinConfirmation = $derived(!isHost);
    let roomLink = $state("");
    let copyButtonText = $state("Copy Link");

    onMount(() => {
        error.set(null);

        roomLink = `${window.location.origin}/${roomId}`;
    });

    onDestroy(() => {
        messages.set([]);
        $peer?.close();
    });

    function handleCopyLink() {
        navigator.clipboard.writeText(roomLink).then(() => {
            copyButtonText = "Copied!";
            setTimeout(() => {
                copyButtonText = "Copy Link";
            }, 2000);
        });
    }

    async function handleConfirmJoin() {
        awaitingJoinConfirmation = false;

        if (!roomId) {
            return;
        }

        let challengeResult = await doChallenge(roomId);
        if (!challengeResult) {
            return;
        }

        ws.send({
            type: WebSocketRequestType.ROOM_JOIN,
            roomId: roomId!,
            challenge: {
                target: challengeResult.target,
                nonce: challengeResult.nonce,
            },
        });
    }

    function handleDeclineJoin() {
        // In a real app, this would close the connection and maybe redirect
        alert("You have declined to join the room.");
        awaitingJoinConfirmation = false; // Hides the prompt
        goto("/");
    }

    ws.subscribe(async (newWs) => {
        if (newWs.status === WebsocketConnectionState.CONNECTED) {
            if (!awaitingJoinConfirmation) {
                return;
            }

            if (!roomId) {
                return;
            }

            let challengeResult = await doChallenge(roomId);

            if (challengeResult) {
                let unsubscribe = ws.handleEvent(WebSocketResponseType.ROOM_STATUS, (value) => {
                    if (value.status === RoomStatusType.OPEN) {
                        unsubscribe();
                        roomExists = true;
                    } else if (value.status === RoomStatusType.NOT_FOUND) {
                        unsubscribe();
                        roomExists = false;
                    }
                });

                ws.send({
                    type: WebSocketRequestType.ROOM_STATUS,
                    roomId: roomId,
                    challenge: {
                        target: challengeResult.target,
                        nonce: challengeResult.nonce,
                    },
                });
            }
        }
    });
</script>

<div class="max-w-6xl px-5 mx-auto flex flex-col items-center">
    {#if $error}
        <h2 class="text-3xl font-bold text-white mb-2">
            Something went wrong: {$error.toLocaleLowerCase()}
        </h2>
        <p class="!text-paragraph">
            click <a href="/">here</a>
            to go back to the homepage
        </p>
    {/if}

    {#if !$error}
        {#if isHost}
            {#if !$room.RTCConnectionReady}
                <h2 class="text-3xl font-bold text-white mb-2">Your secure room is ready.</h2>
                <p class="text-gray-400 mb-6 text-center">
                    Share the link below to invite someone to chat directly with you. Once they
                    join, you will be connected automatically.
                </p>

                <div
                    class="bg-gray-900 rounded-lg p-4 flex items-center justify-between gap-4 border border-gray-600">
                    <span class="text-accent font-mono text-sm overflow-x-auto whitespace-nowrap">
                        {roomLink}
                    </span>
                    <button
                        onclick={handleCopyLink}
                        class="bg-accent hover:bg-accent/80 active:bg-accent/60 cursor-pointer text-gray-900 font-bold py-2 px-4 rounded-md transition-colors whitespace-nowrap">
                        {copyButtonText}
                    </button>
                </div>
            {:else}
                <RtcMessage {room} />
            {/if}
        {:else if awaitingJoinConfirmation}
            {#if $ws.status !== WebsocketConnectionState.CONNECTED || roomExists === undefined}
                <h2 class="text-3xl font-bold text-white mb-2">
                    <span class="flex items-center">
                        <span class="mr-3"><LoadingSpinner size="24" /></span> Connecting to server...
                    </span>
                </h2>
                <p class="!text-paragraph">
                    click <a href="/">here</a>
                    to go back to the homepage
                </p>
            {:else if roomExists === false}
                <h2 class="text-3xl font-bold text-white mb-2">That room does not exist.</h2>
                <p class="!text-paragraph">
                    click <a href="/">here</a>
                    to go back to the homepage
                </p>
            {:else}
                <h2 class="text-3xl font-bold text-white mb-2">You're invited to chat.</h2>
                <div class="flex flex-row gap-2">
                    <button
                        onclick={handleConfirmJoin}
                        class="bg-accent hover:bg-accent/80 active:bg-accent/60 cursor-pointer text-gray-900 font-bold py-2 px-4 rounded-md transition-colors whitespace-nowrap">
                        Accept
                    </button>
                    <button
                        onclick={handleDeclineJoin}
                        class="bg-red-400 hover:bg-red-400/80 active:bg-red-400/60 cursor-pointer text-gray-900 font-bold py-2 px-4 rounded-md transition-colors whitespace-nowrap">
                        Decline
                    </button>
                </div>
            {/if}
        {:else if !$room.RTCConnectionReady}
            <h2 class="text-3xl font-bold text-white mb-2">
                <span class="flex items-center">
                    <span class="mr-3"><LoadingSpinner size="24" /></span> Connecting to room...
                </span>
            </h2>
        {:else}
            <RtcMessage {room} />
        {/if}
    {/if}
</div>
