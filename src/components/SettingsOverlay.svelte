<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import ToggleSwitch from "./ToggleSwitch.svelte";
    import { settingsStore } from "$stores/settingsStore";
    import { writable, type Writable } from "svelte/store";

    let { open = $bindable() } = $props();

    let previouslyFocusedElement: HTMLElement | null; // To restore focus later
    let maxDownloadSizeinMB: Writable<number> = writable($settingsStore.maxAutoDownloadSize);
    $maxDownloadSizeinMB = Math.floor($maxDownloadSizeinMB / 1024 / 1024);

    maxDownloadSizeinMB.subscribe((value) => {
        console.log("Max download size:", value);
        $settingsStore.maxAutoDownloadSize = value * 1024 * 1024;
    });

    function trapFocus(node: HTMLElement) {
        let focusableElements: NodeListOf<HTMLElement>;
        let firstFocusableElement: HTMLElement;
        let lastFocusableElement: HTMLElement;

        const queryFocusable = () => {
            // Select all elements that can receive focus
            focusableElements = node.querySelectorAll(
                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            );
            firstFocusableElement = focusableElements[0];
            lastFocusableElement = focusableElements[focusableElements.length - 1];
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Tab") {
                // Recalculate focusable elements on tab to account for potential dynamic content
                queryFocusable();

                if (event.shiftKey) {
                    // Shift + Tab
                    if (document.activeElement === firstFocusableElement) {
                        lastFocusableElement.focus();
                        event.preventDefault();
                    }
                } else {
                    // Tab
                    if (document.activeElement === lastFocusableElement) {
                        firstFocusableElement.focus();
                        event.preventDefault();
                    }
                }
            } else if (event.key === "Escape") {
                open = false; // Close on Escape key
            }
        };

        // Initial setup when mounted
        onMount(() => {
            previouslyFocusedElement = document.activeElement as HTMLElement | null; // Save reference
            queryFocusable();
            if (firstFocusableElement) {
                firstFocusableElement.focus(); // Focus first item
            }
            document.addEventListener("keydown", handleKeyDown);
        });

        // Cleanup when destroyed
        onDestroy(() => {
            document.removeEventListener("keydown", handleKeyDown);
            if (previouslyFocusedElement) {
                previouslyFocusedElement.focus(); // Restore focus
            }
        });

        return {
            destroy() {
                document.removeEventListener("keydown", handleKeyDown);
                if (previouslyFocusedElement) {
                    previouslyFocusedElement.focus();
                }
            },
        };
    }
</script>

<!-- div to block interaction with the body -->
{#if open}
    <div
        class="fixed top-0 left-0 w-screen h-screen z-10 flex items-center justify-center"
        use:trapFocus>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div onclick={() => (open = false)} class="absolute inset-0"></div>
        <div
            class="bg-surface py-4 px-6 rounded-lg border border-[#21293b] z-20 max-w-xl w-full mx-5">
            <h2 class="font-bold text-center">Settings</h2>
            <form class="flex flex-col gap-5" id="roomForm">
                <div class="flex">
                    <label
                        for="autoDownloadImages"
                        class="text-paragraph block text-sm font-medium mr-2">Image Previews</label>
                    <ToggleSwitch
                        id="autoDownloadImages"
                        bind:checked={$settingsStore.autoDownloadImages}
                        className="border border-[#2c3444] bg-[#232b3e] ml-auto" />
                </div>
                <div class="flex items-center">
                    <label
                        for="maxAutoDownloadSize"
                        class="text-paragraph block text-sm font-medium mr-2"
                        >Max Auto Download Size (MB)</label>
                    <input
                        type="number"
                        id="maxAutoDownloadSize"
                        bind:value={$maxDownloadSizeinMB}
                        class="border border-[#2c3444] bg-[#232b3e] ml-auto h-fit px-2 py-1 max-w-20" />
                </div>
            </form>
        </div>
    </div>
{/if}
