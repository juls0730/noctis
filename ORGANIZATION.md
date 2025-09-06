This document lists the current state of files in this repository. This will serve as a tool for me to reorganize my code and make it easier to find things.

## Directories

### /src

This is the SvelteKit project.

- **lib/**:
  - **webrtc.ts**: Holds the WebRTCPeer class, which is used to handle WebRTC connections. It is the place where encryption and decryption is handled.
- **shared/**:
  - **keyConfig.ts**: Holds the configuration for the RSA key pair used for wrapping the unique AES-GCM key for each
    message, literally nothing else.
- **stores/**:
  - **messageStore.ts**: Holds the messages that are sent between the client and the peer.
  - **roomStore.ts**: Holds the room information, such as the room ID, the number of participants, and the connection state.
  - **websocketStore.ts**: Holds the WebSocket connection. 
- **types/**:
  - **message.ts**: Defines the types of application messages that are sent between the client and the peer via WebRTC
    post initialization.
    - **webrtc.ts**: Defines the WebRTCPeerCallbacks, the WebRTCPacketType, the structure of the WebRTCPacket (even
      though all WebRTC packets are binary data), and the structure of the KeyStore.
    - **websocket.ts**: Defines the WebSocketMessageType, and the types for each message along with the union.
- **utils/**:
  - **webrtcUtil.ts**: This file feels like a hodgepodge of random shit. Its responsible for handling application messages that come from the
    data channel, as well as handling the websocket signaling and room notifications. It need to be usable by both peers.

### /server

This is the server that handles the webrtc signaling.