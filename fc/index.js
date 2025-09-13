import { serveStaticFile, isStaticRequest } from './static.js';
import filters from './filters/index.js';
import { checkConfig } from './config.js';
import { parseAccessControlParams } from './filters/parser.js';
import geturl from './geturl.js';

export const handler = async (event, context) => {
    const eventObj = JSON.parse(event);
    { let e = checkConfig(); if (e) return e; }
    // HTTP方法
    const httpMethod = eventObj.requestContext?.http?.method || 'GET';
    // 请求路径
    const path = eventObj.requestContext?.http?.path || '';
    const pathParts = path.split('/').filter(part => part !== '');
    // 处理CORS
    if (httpMethod === 'OPTIONS') return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: ''
    };
    // 处理静态文件请求
    if (isStaticRequest(path)) return serveStaticFile(path);
    // 验证路径格式
    if (pathParts.length !== 2) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Invalid path format. Expected /{arg1}/{arg2}' })
        };
    }
    // 解码路径参数
    const arg1 = decodeURIComponent(pathParts[0]), arg2 = decodeURIComponent(pathParts[1]);
    // 解析访问控制参数
    const acParams = parseAccessControlParams(arg1);

    // 依次执行过滤器
    for (const filter of filters) {
        try {
            const filtered = await filter(acParams, eventObj, context, arg1, arg2);
            if (filtered === false) {
                return {
                    statusCode: 403,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Request was filtered' })
                };
            }
            else if (!!filtered && (filtered !== true)) {
                return filtered;
            }
        }
        catch (e) {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: `Unexpected exception while executing filter: ${e}\n${e?.stack}` })
            };
        }
    }

    // 重定向请求
    return {
        statusCode: 307,
        headers: {
            'Location': await geturl(`${encodeURIComponent(arg1)}/${encodeURIComponent(arg2)}`, context),
            'Cache-Control': 'no-store'
        },
    };
};