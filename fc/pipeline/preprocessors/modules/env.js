import { check_config } from '../../../config.js';
import { parse_ac_params } from '../../../lib/ac_parser.js';

export default async function handle_request(ctx) {
    { let e = checkConfig(); if (e) return e; }
    const httpMethod = ctx.event.requestContext?.http?.method || 'GET';
    const path = ctx.event.requestContext?.http?.path || '';
    const pathParts = path.split('/').filter(part => part !== '');
    if (pathParts.length !== 2) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: 'Invalid path format. Expected /{arg1}/{arg2}'
        };
    }
    const [arg1, arg2] = pathParts;
    const acParams = parse_ac_params(arg1);
    // save data to ctx object
    ctx.method = httpMethod; ctx.path = path;
    ctx.acParams = acParams;
    ctx.arg1 = arg1; ctx.arg2 = arg2;
    // return null indicating that we didn't handled the request
    return null;
}
