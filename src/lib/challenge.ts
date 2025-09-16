import { ws } from "$stores/websocketStore";
import { WebSocketMessageType } from "$types/websocket";
import { solveChallenge } from "./powUtil";

export async function doChallenge(additionalData: string = ""): Promise<{
    challenge: string;
    nonce: string;
} | null> {
    let roomChallenge: string | null = null;

    let challengePromise = new Promise<string | null>((resolve) => {
        let unsubscribe = ws.handleEvent(
            WebSocketMessageType.CHALLENGE,
            async (value) => {
                unsubscribe();
                roomChallenge = value.challenge;
                resolve(
                    await solveChallenge(
                        roomChallenge,
                        value.difficulty,
                        additionalData,
                    ),
                );
            },
        );
    });

    ws.send({
        type: WebSocketMessageType.REQUEST_CHALLENGE,
    });

    let challengeNonce = await challengePromise;
    if (!challengeNonce) {
        throw new Error("Could not solve challenge within max iterations");
    }

    if (!roomChallenge) {
        throw new Error("No room challenge");
    }

    return {
        challenge: roomChallenge,
        nonce: challengeNonce,
    };
}