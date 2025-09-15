<script lang="ts">
    import "../app.css";
    import favicon from "$lib/assets/favicon.svg";

    let { children } = $props();
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
    <script
        src="https://cdn.jsdelivr.net/npm/web-streams-polyfill@2.0.2/dist/ponyfill.min.js"
    ></script>
    <script
        src="https://cdn.jsdelivr.net/npm/streamsaver@2.0.3/StreamSaver.min.js"
    ></script>
</svelte:head>

{@render children?.()}
