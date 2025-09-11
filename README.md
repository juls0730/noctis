# Wormhole
(needs a different name I think because I dont want to confuse it with wormhole.app)

A peer-to-peer encrypted file sharing app.

## Features
- E2E communication
- P2P file sharing
- P2P chat

Data is end-to-end encrypted with MLS. MLS is currently implemented with [ts-mls](https://github.com/LukaJCB/ts-mls). Due
to MLS' age, there are not many libraries for it yet and as a result, there is no gurantee that the implementation will
be bug-free or completely secure. Hopefully this will change in the future, but until then, be careful, this project
shouldnt be used for anything actually important. In the future I may consider switching to mls-ts from Matrix, or write
wasm bindings for AWS' mls-rs library.

## How to use
1. clone the repo
2. run `bun install`
3. run `bun run dev --host` (webrtc doesnt co-operate with localhost connections, so connect via 127.0.0.1)
4. open the browser at http://127.0.0.1:5173