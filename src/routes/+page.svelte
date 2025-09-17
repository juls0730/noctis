<script lang="ts">
    import { WebsocketConnectionState, ws } from "$stores/websocketStore";
    import { WebSocketRequestType } from "$types/websocket";
    import { writable, type Writable } from "svelte/store";
    import LoadingSpinner from "$components/LoadingSpinner.svelte";
    import { doChallenge } from "$lib/challenge";

    let roomName: Writable<string> = writable("");
    let roomLoading: Writable<boolean> = writable(false);

    function createRoom() {
        roomLoading.set(true);
        let roomId = $roomName.trim() === "" ? undefined : $roomName.trim();

        doChallenge().then(async (challengeResult) => {
            if (!challengeResult) {
                return;
            }

            ws.send({
                type: WebSocketRequestType.CREATE_ROOM,
                roomName: roomId,
                challenge: {
                    target: challengeResult.target,
                    nonce: challengeResult.nonce,
                },
            });

            console.log("Created room:", roomId);
        });
    }

    let showRoomNameInput: Writable<boolean> = writable(false);
</script>

<section class="py-20 text-center">
    <div class="max-w-6xl px-5 mx-auto flex flex-col items-center">
        <h1 class="font-bold">Your Private, Peer-to-Peer Chat Room</h1>
        <p class="max-w-xl mx-8">
            End-to-end encrypted. Peer-to-peer. No servers. No sign-ups. Just chat.
        </p>

        <div
            class="bg-surface p-10 rounded-xl max-w-xl shadow-xl border border-[#21293b] mt-10 mr-auto ml-auto w-full">
            <form class="flex flex-col gap-5" id="roomForm">
                <button
                    onclick={createRoom}
                    disabled={$ws.status !== WebsocketConnectionState.CONNECTED || $roomLoading}
                    class="py-4 px-8 text-xl font-semibold bg-accent text-[#121826] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg cursor-pointer transition-[background-color,_translate,_box-shadow] ease-out duration-200 w-full inline-flex justify-center items-center gap-2.5 hover:bg-[#00f0c8] hover:-translate-y-1 hover:shadow-md shadow-accent/20">
                    {#if $ws.status !== WebsocketConnectionState.CONNECTED}
                        <span class="flex items-center">
                            <span class="mr-3"><LoadingSpinner /></span> Connecting to server...
                        </span>
                    {:else if $roomLoading}
                        <span class="flex items-center">
                            <span class="mr-3"><LoadingSpinner /></span> Creating Room...
                        </span>
                    {:else}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24">
                            <!-- Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE -->
                            <path
                                fill="currentColor"
                                d="M12 2a5 5 0 0 1 5 5v3a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3V7a5 5 0 0 1 5-5m0 12a2 2 0 0 0-1.995 1.85L10 16a2 2 0 1 0 2-2m0-10a3 3 0 0 0-3 3v3h6V7a3 3 0 0 0-3-3" />
                        </svg>
                        Create Secure Room
                    {/if}
                </button>
                <div
                    class="{$showRoomNameInput
                        ? 'max-h-32'
                        : 'max-h-0 opacity-0'} overflow-hidden transition-[max-height,_opacity] duration-700">
                    <label
                        aria-hidden={!$showRoomNameInput}
                        for="roomNameInput"
                        class="text-paragraph block text-sm font-medium mb-2 text-left">
                        Enter a custom room name
                    </label>
                    <input
                        tabindex={!$showRoomNameInput ? -1 : 0}
                        type="text"
                        id="roomNameInput"
                        bind:value={$roomName}
                        class="placeholder:text-paragraph-muted w-full py-3 px-4 rounded-lg border border-[#2c3444] bg-[#232b3e] text-paragraph transition-[border-color,_box-shadow] duration-300 ease-in-out focus:outline-none focus:border-accent focus:shadow-sm shadow-accent/20"
                        placeholder="e.g., private-chat" />
                </div>
                <span class="text-paragraph {$showRoomNameInput ? 'hidden' : '-mt-5'}">
                    or <button
                        id="showCustomNameLink"
                        class="cursor-pointer underline hover:no-underline text-accent"
                        onclick={() => showRoomNameInput.set(true)}>
                        choose a custom room name
                    </button>
                </span>
            </form>
        </div>
    </div>
</section>

<section class="py-20 bg-surface">
    <div class="max-w-6xl px-5 mx-auto">
        <h2 class="font-semibold">How It Works</h2>
        <div class="mt-10 flex justify-around gap-8 flex-wrap">
            <div class="text-center max-w-3xs">
                <div
                    class="text-2xl font-bold w-12 h-12 leading-12 rounded-full bg-primary text-accent mx-auto mb-5">
                    1
                </div>
                <h3>Create a Room</h3>
                <p>
                    Click the button above to create a random room instantly, no personal info
                    required.
                </p>
            </div>
            <div class="text-center max-w-3xs">
                <div
                    class="text-2xl font-bold w-12 h-12 leading-12 rounded-full bg-primary text-accent mx-auto mb-5">
                    2
                </div>
                <h3>Share the Link</h3>
                <p>
                    You'll get a unique link to your private room. Share this link with anyone you
                    want to chat with securely.
                </p>
            </div>
            <div class="text-center max-w-3xs">
                <div
                    class="text-2xl font-bold w-12 h-12 leading-12 rounded-full bg-primary text-accent mx-auto mb-5">
                    3
                </div>
                <h3>Chat Privately</h3>
                <p>
                    Once they join, your messages are sent directly between your devices, encrypted
                    from end to end. Hidden from everyone else.
                </p>
            </div>
        </div>
    </div>
</section>

<section class="py-20">
    <div class="max-w-6xl px-10 mx-auto">
        <h2 class="font-semibold">Security by Design</h2>
        <div class="mt-10 grid grid-cols-[repeat(auto-fit,_minmax(300px,_1fr))] gap-8">
            <div class="bg-surface p-8 rounded-xl border border-[#21293b] text-center">
                <div
                    class="mb-5 bg-accent/10 w-16 h-16 rounded-full inline-flex justify-center items-center text-paragraph">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24">
                        <!-- Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE -->
                        <g
                            fill="none"
                            stroke="currentColor"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2">
                            <path
                                d="M5 13a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
                            <path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0-2 0m-3-5V7a4 4 0 1 1 8 0v4" />
                        </g>
                    </svg>
                </div>
                <h3 class="font-bold">End-to-End Encrypted</h3>
                <p>
                    Only you and the people in your room can read the messages. Your data is
                    encrypted before its sent using the Message Layer Security (MLS) protocol.
                </p>
            </div>
            <div class="bg-surface p-8 rounded-xl border border-[#21293b] text-center">
                <div
                    class="mb-5 bg-accent/10 w-16 h-16 rounded-full inline-flex justify-center items-center text-paragraph">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24">
                        <!-- Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE -->
                        <path
                            fill="none"
                            stroke="currentColor"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M21 11V8a2 2 0 0 0-2-2h-6m0 0l3 3m-3-3l3-3M3 13.013v3a2 2 0 0 0 2 2h6m0 0l-3-3m3 3l-3 3m8-4.511a2 2 0 1 0 4.001-.001a2 2 0 0 0-4.001.001m-12-12a2 2 0 1 0 4.001-.001A2 2 0 0 0 4 4.502m17 16.997a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2m-6-12a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2" />
                    </svg>
                </div>
                <h3 class="font-bold">Truly Peer-to-Peer</h3>
                <p>
                    Your messages are sent directly from your device to the recipient's. They never
                    pass through a central server.
                </p>
            </div>
            <div class="bg-surface p-8 rounded-xl border border-[#21293b] text-center">
                <div
                    class="mb-5 bg-accent/10 w-16 h-16 rounded-full inline-flex justify-center items-center text-paragraph">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24">
                        <!-- Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE -->
                        <path
                            fill="none"
                            stroke="currentColor"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="m3 3l18 18M7 3h7l5 5v7m0 4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5" />
                    </svg>
                </div>
                <h3 class="font-bold">No Data Stored</h3>
                <p>
                    We don't have accounts, and we don't store your messages. Once you close the
                    tab, the conversation is gone forever.
                </p>
            </div>
        </div>
    </div>
</section>

<footer class="px-20 pt-3 pb-1 text-center border-t border-[#21293b]">
    <div class="max-w-6xl px-10 mx-auto">
        <p>
            &copy; {new Date().getFullYear()} Noctis - MIT License
            <br />
            Made with
            <span class="text-accent">
                <svg
                    class="inline-block"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24">
                    <!-- Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE -->
                    <path
                        fill="currentColor"
                        d="M6.979 3.074a6 6 0 0 1 4.988 1.425l.037.033l.034-.03a6 6 0 0 1 4.733-1.44l.246.036a6 6 0 0 1 3.364 10.008l-.18.185l-.048.041l-7.45 7.379a1 1 0 0 1-1.313.082l-.094-.082l-7.493-7.422A6 6 0 0 1 6.979 3.074" />
                </svg>
            </span>
            by
            <a href="https://zoeissleeping.com">zoeissleeping</a>
        </p>
    </div>
</footer>

<style>
    p {
        margin-bottom: 1rem;
        color: var(--color-paragraph-muted);
    }
</style>
