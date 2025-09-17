import preprocessors from './preprocessors/index.js';
import filters from './filters/index.js';
import processors from './processors/index.js';

async function handle_request_with(ctx, pList) {
    for (const handler of pList) {
        try {
            const result = await handler(ctx);
            // verbose (useless) statement because typeof null === 'object'
            // but for code readability we keep it
            if (typeof result !== 'object' && result !== null) throw new TypeError("Handlers must return an object or null")
            // if the result is a valid value, return it
            if (result !== null) return result;
         }
        catch (error) {
            throw new Error('Error while executing handler; error is ' + error + '; handler is ' + handler, { cause: error })
        }
    }
    return null; // Not handled
}

export async function handle_main_request(event, context) {
    // Context object
    // Handlers can modify the object to 传递 specific data.
    const ctx = { event, context };
    
    return { ctx, response: get_response(ctx) };
}

async function get_response(ctx) {
    // 1. Preprocessors: 
    const preprocessors_result = await handle_request_with(ctx, preprocessors);
    if (preprocessors_result !== null) return preprocessors_result;

    // 2. Filters: 
    for (const filter of filters) {
        const allow = await filter(ctx);
        if (typeof allow !== 'boolean') {
            return {
                statusCode: 500,
                body: 'Server Error: Filters must return boolean'
            };
        }
        if (allow === false) {
            return {
                statusCode: 403,
                body: 'Request was filtered'
            };
        }
    }
    
    // 3. Processors: 
    const processors_result = await handle_request_with(ctx, processors);
    if (processors_result !== null) return processors_result;
    
    // 4. Fallback: 
    return {
        statusCode: 404,
        body: 'The request was not handled'
    };
}