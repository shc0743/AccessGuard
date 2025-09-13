import { sign_url } from 'alioss-sign-v4-util';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { serveStaticFile, isStaticRequest } from './static.js';

// 从环境变量获取配置
const bucket = process.env.bucket;
const region = process.env.region;
const baseUrl = process.env.base;
const CHALLENGE_SECRET = process.env.CHALLENGE_SECRET;

// 获取当前目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const path_join = path.join;

// difficulty 相关配置
const MIN_CHALLENGE_EXPIRY = 15; // 最短挑战有效期（秒）
const MAX_CHALLENGE_EXPIRY = 1800; // 最长挑战有效期（秒）
const BASE_COMPUTATION_TIME = 4; // 基础计算时间系数（秒）

// 解析arg1参数
function parseAccessControl(arg1) {
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

// 检查Referer是否合法
function checkReferer(acParams, requestReferer) {
    // 如果没有设置Referer参数，直接通过
    if (!acParams.Referer) return true;

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

// 检查时间有效性
function checkTimeValidity(acParams) {
    const now = Date.now();

    if (acParams.NotBefore && now < parseInt(acParams.NotBefore)) {
        return false;
    }

    if (acParams.NotAfter && now > parseInt(acParams.NotAfter)) {
        return false;
    }

    return true;
}

// 生成签名URL（提取为独立函数）
async function generateSignedUrl(objectKey, context) {
    try {
        const myurl = new URL(objectKey, baseUrl);
        myurl.searchParams.set("x-oss-security-token", context.credentials.securityToken);
        const signedUrl = new URL(await sign_url(myurl, {
            expires: 10,
            bucket,
            region,
            access_key_id: context.credentials.accessKeyId,
            access_key_secret: context.credentials.accessKeySecret,
        }));

        return signedUrl.href;
    } catch (error) {
        console.error('Error generating signed URL:', error);
        throw error;
    }
}

// 生成PoW挑战
function calculateDynamicExpiry(difficulty) {
    // 基于难度的指数增长计算时间窗口
    // 难度每增加1，所需时间大约翻倍
    const computedTime = BASE_COMPUTATION_TIME * Math.pow(2, difficulty);
    
    // 应用最小和最大限制
    return Math.max(MIN_CHALLENGE_EXPIRY, Math.min(computedTime, MAX_CHALLENGE_EXPIRY));
}
function generatePowChallenge(resourcePath, difficulty) {
    const timestamp = Date.now();
    // 使用 Web Crypto API 生成随机值
    const randomValueArray = new Uint8Array(16);
    crypto.getRandomValues(randomValueArray);
    const randomValue = Array.from(randomValueArray, byte => byte.toString(16).padStart(2, '0')).join('');

    // 创建挑战负载
    const e = calculateDynamicExpiry(difficulty);
    const challengePayload = {
        t: timestamp,        // 时间戳
        r: resourcePath,     // 请求的资源
        n: randomValue,      // 随机数
        d: difficulty,       // 难度
        e,                   // 有效期
    };

    // 使用JWT签名挑战
    if (!CHALLENGE_SECRET) throw new Error('Bad server config');
    const token = jwt.sign(challengePayload, CHALLENGE_SECRET, { expiresIn: '40m' });
    return { challenge: token, expires: e };
}
// 验证PoW挑战和答案
async function verifyPowChallenge(challengeToken, nonce) {
    try {
        // 验证JWT签名
        const challenge = jwt.verify(challengeToken, CHALLENGE_SECRET);

        // 检查挑战是否过期
        if ((Date.now() - challenge.t) > (challenge.e * 1000)) {
            return { valid: false, reason: "Challenge expired" };
        }

        // 验证PoW - 使用 Web Crypto API
        const hashInput = challengeToken + nonce;
        const encoder = new TextEncoder();
        const data = encoder.encode(hashInput);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // 检查是否满足难度要求
        const requiredPrefix = '0'.repeat(challenge.d);
        if (hash.startsWith(requiredPrefix)) {
            return { valid: true, resource: challenge.r };
        } else {
            return { valid: false, reason: "Failure" };
        }
    } catch (error) {
        return { valid: false, reason: "Invalid signature" };
    }
}

async function PoW_handler(eventObj, context, {
    httpMethod, path: req_path, powDifficulty, arg1, arg2
}) {
    if (httpMethod === 'GET') {
        // 检查sec-fetch-dest头部
        const secFetchDest = eventObj.headers?.['sec-fetch-dest'] || eventObj.headers?.['Sec-Fetch-Dest'];
        
        if (secFetchDest === 'document') {
            // 返回pow.html
            try {
                const powHtmlPath = path.join(__dirname, 'web/pow.html');
                const powHtmlContent = fs.readFileSync(powHtmlPath, 'utf8');
                
                return {
                    statusCode: 401,
                    headers: {
                        'Content-Type': 'text/html',
                        'Content-Security-Policy': "default-src 'self'; script-src 'self' blob:; worker-src blob: 'self';",
                        'Cache-Control': 'no-store, no-cache, must-revalidate',
                    },
                    body: powHtmlContent
                };
            } catch (error) {
                console.error('Error reading pow.html:', error);
                return {
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: String(error) + '\n' + String(error?.stack) })
                };
            }
        }
    
        // 生成并返回PoW挑战
        const { challenge, expires } = generatePowChallenge(req_path, powDifficulty);

        return {
            statusCode: 401,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                challenge: challenge,
                difficulty: powDifficulty,
                expires,
            })
        };
    } else if (httpMethod === 'POST') {
        // 验证PoW答案
        let body;
        try {
            body = JSON.parse(eventObj.body);
        } catch (e) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Invalid JSON body' })
            };
        }

        const { challenge, nonce } = body;
        if (!challenge || !nonce) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Missing challenge or nonce' })
            };
        }

        const verification = await verifyPowChallenge(challenge, nonce);
        if (!verification.valid) {
            return {
                statusCode: 403,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'PoW verification failed: ' + verification.reason })
            };
        }
        if (verification.resource !== req_path) {
            return {
                statusCode: 403,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'PoW challenge resource mismatch' })
            };
        }

        // PoW验证通过，生成签名URL
        try {
            const objectKey = `${encodeURIComponent(arg1)}/${encodeURIComponent(arg2)}`;
            const signedUrl = await generateSignedUrl(objectKey, context);

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: signedUrl
            };
        } catch (error) {
            console.error('Error generating signed URL:', error);
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: String(error) + '\n' + String(error?.stack) })
            };
        }
    } else {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
}

export const handler = async (event, context) => {
    const eventObj = JSON.parse(event);
    // console.log(`Receive event: ${JSON.stringify(eventObj)}`);
    if (!bucket || !region || !baseUrl || !CHALLENGE_SECRET) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Server configuration missing' })
        };
    }

    // 获取HTTP方法
    const httpMethod = eventObj.requestContext?.http?.method || 'GET';

    // 获取请求路径
    const path = eventObj.requestContext?.http?.path || '';
    const pathParts = path.split('/').filter(part => part !== '');
    
    // 在处理函数开头添加
    if (httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: ''
        };
    }
    
    // 处理静态文件请求
    if (isStaticRequest(path)) {
        return serveStaticFile(path); 
    }

    // 验证路径格式
    if (pathParts.length !== 2) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Invalid path format. Expected /{arg1}/{arg2}' })
        };
    }

    const arg1 = decodeURIComponent(pathParts[0]);
    const arg2 = decodeURIComponent(pathParts[1]);

    // 解析访问控制参数
    const acParams = parseAccessControl(arg1);

    // 检查是否需要PoW验证
    const powDifficulty = parseInt(acParams.PoW) || 0;
    const requiresPoW = powDifficulty > 0;

    // 检查时间有效性
    if (!checkTimeValidity(acParams)) {
        return {
            statusCode: 403,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Time is not allowed' })
        };
    }

    // 检查Referer
    const requestReferer = eventObj.headers?.referer || eventObj.headers?.Referer;
    if (!checkReferer(acParams, requestReferer)) {
        return {
            statusCode: 403,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Referer not allowed' })
        };
    }

    // 处理PoW逻辑
    if (requiresPoW) try { return await PoW_handler(eventObj, context, {
        httpMethod, path, powDifficulty, arg1, arg2,
    }); } catch (error) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: String(error) + '\n' + String(error?.stack) })
        };
    }

    // 不需要PoW验证，直接返回签名URL
    try {
        const objectKey = `${encodeURIComponent(arg1)}/${encodeURIComponent(arg2)}`;
        const signedUrl = await generateSignedUrl(objectKey, context);

        // 返回307重定向
        return {
            statusCode: 307,
            headers: {
                'Location': signedUrl,
                'Cache-Control': 'no-store'
            },
        };
    } catch (error) {
        console.error('Error processing request:', error);

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: String(error) + '\n' + String(error?.stack) })
        };
    }
};