import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
    const roomId = params.roomId;

    if (!roomId) {
        // SvelteKit's way of handling errors in load functions
        throw error(404, 'Room ID not provided');
    }

    // This return value is SAFELY passed to your page component
    // It is NOT stored in a global variable on the server.
    return {
        roomId: roomId
    };
};