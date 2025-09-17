<script lang="ts">
    import "../app.css";
    import favicon from "$lib/assets/favicon.svg";
    import { onDestroy, onMount } from "svelte";
    import { WebsocketConnectionState, ws } from "$stores/websocketStore";
    import { room } from "$stores/roomStore";
    import { writable } from "svelte/store";
    import SettingsOverlay from "$components/SettingsOverlay.svelte";
    import { settingsStore } from "$stores/settingsStore";

    const settingsOverlayOpen = writable(false);

    onMount(() => {
        ws.connect();

        let settings = localStorage.getItem("settings");
        if (settings) {
            // settingsStore = JSON.parse(settings);
            let settingsObj = JSON.parse(settings);
            for (let key in $settingsStore) {
                // @ts-ignore
                $settingsStore[key] = settingsObj[key];
            }
        } else {
            localStorage.setItem("settings", JSON.stringify($settingsStore));
        }

        $effect(() => {
            localStorage.setItem("settings", JSON.stringify($settingsStore));
        });

        settingsOverlayOpen.subscribe((value) => {
            document.getElementById("app")!.style.filter = value ? "blur(10px)" : "";
            document.documentElement.style.overflow = value ? "hidden" : "auto";
        });
    });

    onDestroy(() => {
        ws.disconnect();
    });

    ws.subscribe((newWs) => {
        if (newWs.status === WebsocketConnectionState.CONNECTED) {
            console.log("Connected to websocket server, room id:", $room.id, "reconnecting");
        }
    });

    let { children } = $props();
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
    <link
        rel="preload"
        as="font"
        type="font/woff2"
        crossorigin="anonymous"
        href="/fonts/InstrumentSans-VariableFont_wdth,wght.woff2" />
    {#if process.env.NODE_ENV !== "production"}
        <!-- Debug console. Particularly useful for debugging on mobile devices -->
        <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
        <script>
            eruda.init();
        </script>
    {/if}
    <script
        src="https://cdn.jsdelivr.net/npm/web-streams-polyfill@2.0.2/dist/ponyfill.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/streamsaver@2.0.3/StreamSaver.min.js"></script>
</svelte:head>

<div
    id="app"
    aria-hidden={$settingsOverlayOpen}
    class="transition-[filter] duration-300 ease-[cubic-bezier(0.45,_0,_0.55,_1)]">
    <header class="p-5">
        <div class="flex justify-between items-center max-w-7xl px-5 mx-auto">
            <div class="text-2xl font-bold text-white">
                <a href="/" class="!text-white !no-underline"
                    >Noctis<span class="text-accent">.</span>
                </a>
            </div>
            <nav class="flex gap-2 items-center">
                <a
                    href="https://github.com/juls0730/noctis"
                    target="_blank"
                    rel="noopener noreferrer">
                    GitHub
                </a>
                <button
                    onclick={() => settingsOverlayOpen.set(!$settingsOverlayOpen)}
                    class="p-1 rounded-md hover:bg-surface/80 transition-colors cursor-pointer group">
                    <svg
                        class="group-hover:text-accent group-hover:rotate-45 transition-[colors,rotate] duration-300 ease-in-out"
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        ><!-- Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE --><g
                            fill="none"
                            stroke="currentColor"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            ><path
                                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37c1 .608 2.296.07 2.572-1.065" /><path
                                d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0-6 0" /></g
                        ></svg>
                </button>
            </nav>
        </div>
    </header>

    <main>
        {@render children?.()}
    </main>
</div>

<SettingsOverlay bind:open={$settingsOverlayOpen} />
