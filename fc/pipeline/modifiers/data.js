/**
 * @type {Array<(ctx, response) => Promise<>>}
 */
const modifiers = [
    (await import('./modules/KianaKaslana.js')).default,
];
export default modifiers;
