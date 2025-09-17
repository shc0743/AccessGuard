// default.js : the default handler (biz logic)
import { ALLOWED_METHODS } from '../../../config.js';
import geturl from '../../../lib/geturl.js';


export default async function handle_request(ctx) {
    if (!ALLOWED_METHODS.includes(ctx.method)) return {
        statusCode: 405,
        body: 'Method not allowed'
    };

    // Redirect the request
    return {
        statusCode: 307,
        headers: {
            'Location': await geturl(`${encodeURIComponent(ctx.arg1)}/${encodeURIComponent(ctx.arg2)}`, ctx.context, ctx.method),
            'Cache-Control': 'no-store'
        },
    };
}