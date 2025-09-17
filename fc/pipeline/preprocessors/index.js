/**
 * @type {Array<(context) => Promise<object | null>>}
 */
const handlers = [
    (await import('./modules/cors.js')).default,
    (await import('./modules/static.js')).default,
    (await import('./modules/env.js')).default,
];
export default handlers;