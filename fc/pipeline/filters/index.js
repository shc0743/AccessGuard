/**
 * @type {Array<(context) => Promise<boolean>>}
 */
const filters = [
    (await import('./modules/TimeWindow.js')).default,
    (await import('./modules/Referer.js')).default,
];
export default filters;