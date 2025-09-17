// Add Content-Type header for simple response
// (if not added, FC view them as JSON, which is incorrect)

export default async function modify_response(ctx, response) {
    if (response.headers && response.headers["Content-Type"]) return;
    if (!response.headers) response.headers = {};
    response.headers["Content-Type"] = "text/plain;charset=utf-8";
}
