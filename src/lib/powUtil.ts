export async function hashStringSHA256(message: string): Promise<string> {
    const textEncoder = new TextEncoder();
    const data = textEncoder.encode(message);

    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function solveChallenge(challenge: string, difficulty: number, additionalData: string): Promise<string | null> {
    let nonce = 0;
    let targetPrefix = '0'.repeat(difficulty);
    let maxIterations = 1_000_000;

    while (nonce < maxIterations) {
        let hash = await hashStringSHA256(`${additionalData}${challenge}${nonce}`);
        if (hash.startsWith(targetPrefix)) {
            return nonce.toString();
        }

        nonce++;
    }

    return null;
}

