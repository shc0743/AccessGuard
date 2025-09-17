import { handle_main_request } from './pipeline/index.js';
import { apply_modifiers } from './pipeline/modifiers/index.js';

export async function handler(event, context) {
    try {
        const eventObj = JSON.parse(event);
        let { ctx, response } = await handle_main_request(eventObj, context);
        await apply_modifiers(ctx, response);
        return response;
    }
    catch (error) {
        console.error('FATAL:: Unhandled exception!!', error, error?.stack);
        return {
            statusCode: 500,
            body: 'FATAL:: Unexpected exception has occurred while handling request.\nTrying again may solve the problem.\n\nIf you are the service owner, please check the server log and fix the code.'
        }
    }
};

