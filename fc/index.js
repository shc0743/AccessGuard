import { handle_main_request } from './pipeline/index.js';
import { DEBUG } from './config.js';

export async function handler(event, context) {
    try {
        const eventObj = JSON.parse(event);
        if (eventObj.isBase64Encoded) eventObj.body = atob(eventObj.body);
        const response = await handle_main_request(eventObj, context);
        return response;
    }
    catch (error) {
        console.error('FATAL:: Unhandled exception!!', error, error?.stack);
        return {
            statusCode: 500,
            headers: { "content-type": "text/plain;charset=utf-8" },
            body: DEBUG ? (`Fatal Error\n============\nError:\n\t${error}\n\nStack:\n${error?.stack || 'unknown'}`) : 'FATAL:: Unexpected exception has occurred while handling request.\nTrying again may solve the problem.\n\nIf you are the service owner, please check the server log and fix the code.'
        }
    }
};

