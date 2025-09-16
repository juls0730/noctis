import { handler } from './build/handler.js'; // Adjust path as needed
import http from 'http';
import { WebSocketServer } from 'ws';
import polka from 'polka';
import { confgiureWebsocketServer } from './src/lib/server/websocketHandler.ts'

const server = http.createServer();
const app = polka({ server });
const port = process.env.PORT || 4173;

const ws = new WebSocketServer({ server });

confgiureWebsocketServer(ws);

app.use(handler); // SvelteKit handler

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});