export default async function filter_request(acParams, eventObj, context, arg1, arg2) {
    const now = Date.now();

    if (acParams.NotBefore && (now < parseInt(acParams.NotBefore))) {
        return false;
    }

    if (acParams.NotAfter && (now > parseInt(acParams.NotAfter))) {
        return false;
    }

    return true;
}