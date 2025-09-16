import { ws } from "$stores/websocketStore";
import { WebSocketRequestType, WebSocketResponseType } from "$types/websocket";
import { solveChallenge } from "./powUtil";

export async function doChallenge(additionalData: string = ""): Promise<{
    target: string;
    nonce: string;
} | null> {
    let roomChallengeTarget: string | null = null;

    let challengePromise = new Promise<string | null>((resolve) => {
        let unsubscribe = ws.handleEvent(
            WebSocketResponseType.CHALLENGE_RESPONSE,
            async (value) => {
                unsubscribe();
                roomChallengeTarget = value.target;
                resolve(
                    await solveChallenge(
                        roomChallengeTarget,
                        value.difficulty,
                        additionalData,
                    ),
                );
            },
        );
    });

    ws.send({
        type: WebSocketRequestType.CHALLENGE_REQUEST,
    });

    let challengeNonce = await challengePromise;
    if (!challengeNonce) {
        throw new Error("Could not solve challenge within max iterations");
    }

    if (!roomChallengeTarget) {
        throw new Error("No room challenge");
    }

    return {
        target: roomChallengeTarget,
        nonce: challengeNonce,
    };
}