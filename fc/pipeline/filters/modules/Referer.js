export default async function filter_request({ acParams, event : eventObj }) {
    // If Referer is not set, directly pass
    if (!acParams.Referer) return true;

    const requestReferer = eventObj.headers?.referer || eventObj.headers?.Referer || '';

    // Parse the allowed list
    const allowedReferers = acParams.Referer.split(',').map(r => r.trim());

    // Handling empty referer
    if (!requestReferer) {
        return allowedReferers.includes('');
    }

    // Extract hostname from header (the header might be a full-qualified URL)
    let refererDomain;
    try {
        const url = new URL(requestReferer);
        refererDomain = url.hostname;
    } catch (e) {
        // if it is only a domain (without protocols), new URL will fail
        // directly use the raw value
        refererDomain = requestReferer;
    }

    return allowedReferers.includes(refererDomain);
}