import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import geturl from '../../geturl.js';
import { BASE_COMPUTATION_TIME, MIN_CHALLENGE_EXPIRY, MAX_CHALLENGE_EXPIRY, CHALLENGE_SECRET, baseDir } from '../../config.js';

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
                const powHtmlPath = path.join(baseDir, 'web/pow.html');
                const powHtmlContent = fs.readFileSync(powHtmlPath, 'utf8');
                
                return {
                    statusCode: 401,
                    headers: {
                        'Content-Type': 'text/html',
                        'Content-Security-Policy': "default-src 'self';",
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
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json;charset=utf-8' },
            body: JSON.stringify({
                url: await geturl(`${encodeURIComponent(arg1)}/${encodeURIComponent(arg2)}`, context),
                expires: SIGNED_URL_EXPIRES,
            }),
        };
    } else {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
}


export default async function filter_request(acParams, eventObj, context, arg1, arg2) {
    const httpMethod = eventObj.requestContext?.http?.method || 'GET';
    const path = eventObj.requestContext?.http?.path || '';
    // 检查是否需要PoW验证
    const powDifficulty = parseInt(acParams.PoW) || 0;
    const requiresPoW = powDifficulty > 0;
    if (!requiresPoW && httpMethod === 'GET') return;
    // 处理 PoW
    return await PoW_handler(eventObj, context, {
        httpMethod, path, powDifficulty, arg1, arg2
    });
}