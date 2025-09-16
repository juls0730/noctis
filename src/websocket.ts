import { WebSocketServer } from "ws";
import { confgiureWebsocketServer } from './lib/server/websocketHandler.ts';

import type { ViteDevServer } from "vite";

function createWebsocketViteWrapper(server: ViteDevServer) {
    if (!server.httpServer) {
        throw new Error("No httpServer found");
    }

    const result = new WebSocketServer({
        noServer: true,
    });

    server.httpServer.on("upgrade", (req, socket, head) => {
        // almost definitely HMR stuff, bail out before everything explodes
        if (req.headers['sec-websocket-protocol']?.startsWith('vite')) {
            return;
        }

        result.handleUpgrade(req, socket, head, (ws) => {
            result.emit("connection", ws, req);
        });
    });

    return result;
}

export const webSocketServer = {
    name: "websocket",
    configureServer: (server: ViteDevServer) => {
        confgiureWebsocketServer(createWebsocketViteWrapper(server));
    },
};