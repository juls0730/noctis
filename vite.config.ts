import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { webSocketServer } from './src/websocket.ts';

export default defineConfig({
    plugins: [tailwindcss(), sveltekit(), webSocketServer],
    server: {
        allowedHosts: ['.trycloudflare.com'],
    },
    ssr: {
        // ts-mls is problematic, make vite bundle it
        noExternal: ['ts-mls']
    }
});
