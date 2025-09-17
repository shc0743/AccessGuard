export default async function filter_request(ctx) {
    const now = Date.now();
    if (ctx.acParams.NotBefore && (now < parseInt(ctx.acParams.NotBefore))) return false;
    if (ctx.acParams.NotAfter && (now > parseInt(ctx.acParams.NotAfter))) return false;
    return true;
}