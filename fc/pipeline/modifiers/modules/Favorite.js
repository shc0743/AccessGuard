import { FAC } from '../../../config.js';

export default async function modify_response(ctx, response) {
    if (!FAC) return;
    if (!response.headers) response.headers = {};
    response.headers["X-Service-Owner-Favorite-Character"] = FAC;
}
