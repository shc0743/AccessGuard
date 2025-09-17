/**
 * @type {Array<(ctx, response) => Promise<>>}
 */
const modifiers = [
    (await import('./modules/Favorite.js')).default,
    (await import('./modules/KianaKaslana.js')).default,
    (await import('./modules/SimpleRespAddCtypeHeader.js')).default,
];
export default modifiers;
