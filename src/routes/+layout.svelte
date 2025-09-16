<script lang="ts">
    import "../app.css";
    import favicon from "$lib/assets/favicon.svg";
    import { onDestroy, onMount } from "svelte";
    import { WebsocketConnectionState, ws } from "$stores/websocketStore";
    import { room } from "$stores/roomStore";

    onMount(() => {
        ws.connect();
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

<header class="p-5">
    <div class="flex justify-between items-center max-w-7xl px-5 mx-auto">
        <div class="text-2xl font-bold text-white">
            <a href="/" class="!text-white !no-underline">Noctis<span class="text-accent">.</span>
            </a>
        </div>
        <nav>
            <a href="https://github.com/juls0730/noctis" target="_blank" rel="noopener noreferrer">
                GitHub
            </a>
        </nav>
    </div>
</header>

<main>
    {@render children?.()}
</main>
