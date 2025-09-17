<script lang="ts">
    import { onMount } from "svelte";

    let {
        checked = $bindable(),
        value = $bindable(),
        disabled = $bindable(),
        id,
        className,
        ...others
    }: {
        checked: boolean;
        value?: string;
        disabled?: boolean;
        id?: string;
        className?: string;
    } = $props();

    onMount(() => {
        if (id) {
            document.querySelector(`[for="${id}"]`)?.addEventListener("click", toggle);
        }
    });

    function toggle() {
        if (disabled) return;
        checked = !checked;
    }
</script>

<button
    role="switch"
    class="vl-toggle-switch {className}"
    aria-disabled={disabled}
    aria-label="label"
    aria-labelledby="id"
    tabindex={disabled ? -1 : 0}
    aria-checked={checked}
    data-state={checked ? "checked" : "unchecked"}
    onclick={toggle}
    {...others}>
    <div></div>
</button>

<style scoped>
    .vl-toggle-switch {
        font-size: inherit;
        cursor: pointer;
        width: 2.5em;
        height: 1.4em;
        border-radius: 100px;
        padding: 0.125rem 0.25rem;
        position: relative;
        transition-property: background-color, border-color;
        transition-duration: 0.3s;
        transition-timing-function: ease;
    }

    .vl-toggle-switch[aria-disabled="true"] div {
        background: #919191;
    }

    .vl-toggle-switch div {
        position: relative;
        left: 0;
        width: 1em;
        height: 1em;
        background: #f7f7f7;
        border-radius: 90px;
        pointer-events: none;
        transition: all 0.3s;
    }

    .vl-toggle-switch[data-state="checked"] {
        --checked-color: var(--color-accent);
        background: var(--checked-color);
        border-color: var(--checked-color);
    }

    .vl-toggle-switch[data-state="checked"] div {
        left: 100%;
        transform: translateX(-100%);
    }

    .vl-toggle-switch:active div {
        width: 1.3em;
    }
</style>
