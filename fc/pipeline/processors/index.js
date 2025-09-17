/**
 * @type {Array<(context) => Promise<object | null>>}
 */
const handlers = [
    (await import('./modules/PoW.js')).default,
    (await import('./modules/default.js')).default,
];
export default handlers;