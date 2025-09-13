export function parseAccessControlParams(arg1 = '') {
    const params = {};
    const parts = arg1.split(';');

    for (const part of parts) {
        const [key, value] = part.split('=');
        if (key && value !== undefined) {
            params[key.trim()] = value.trim();
        }
    }

    return params;
}
