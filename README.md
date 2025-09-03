# Wormhole
(needs a different name I think because I dont want to confuse it with wormhole.app)

A peer-to-peer encrypted file sharing app.

## Features
- E2E communication
- P2P file sharing
- P2P chat

Your data is peer-to-peer encrypted and only accessible to the people you share it with, it never touches any servers.

## How to use
1. clone the repo
2. run `bun install`
3. run `bun run dev --host` (webrtc doesnt co-operate with localhost connections, so connect via 127.0.0.1)
4. open the browser at http://127.0.0.1:5173