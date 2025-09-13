export default async function filter_request(acParams, eventObj, context, arg1, arg2) {
    // 如果没有设置Referer参数，直接通过
    if (!acParams.Referer) return true;

    const requestReferer = eventObj.headers?.referer || eventObj.headers?.Referer || '';

    // 解析允许的Referer列表
    const allowedReferers = acParams.Referer.split(',').map(r => r.trim());

    // 处理空Referer情况
    if (!requestReferer) {
        return allowedReferers.includes('') || allowedReferers.some(r => r === '');
    }

    // 从完整Referer中提取域名
    let refererDomain;
    try {
        const url = new URL(requestReferer);
        refererDomain = url.hostname;
    } catch (e) {
        // 如果无法解析为URL，直接使用原始值
        refererDomain = requestReferer;
    }

    // 检查是否在允许的列表中
    return allowedReferers.includes(refererDomain);
}