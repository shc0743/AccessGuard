/**
 * @type {Array<(acParams: object, eventObj: any, context: any, arg1: string, arg2: string) => Promise<boolean | object | undefined>>}
 */
const filters = [
    (await import('./modules/TimeWindow.js')).default,
    (await import('./modules/Referer.js')).default,
    (await import('./modules/PoW.js')).default,
];
export default filters;