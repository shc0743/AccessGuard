import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import geturl from '../../../lib/geturl.js';
import {
    MIN_CHALLENGE_EXPIRY, MAX_CHALLENGE_EXPIRY,
    POW_EXPIRY_STRATEGY,
    HASHRATE_MIN, HASHRATE_AVG,
    CHALLENGE_SECRET,
    SIGNED_URL_EXPIRES,
    baseDir,
} from '../../../config.js';

// 分位系数（指数分布近似）
const FACTOR_MEDIAN = Math.log(2);         // ~0.6931
const FACTOR_90 = -Math.log(0.1);          // ~2.302585
// 预定义策略映射
const POW_STRATEGY_MAP = {
  // 保守策略：保证最低算力设备 90% 成功
  T90_AT_200KH: {
    factor: FACTOR_90,
    hashrate: HASHRATE_MIN,
  },
  // 折中策略：保证平均算力设备 90% 成功（最低算力成功率约 78.5%）
  T90_AT_300KH: {
    factor: FACTOR_90,
    hashrate: HASHRATE_AVG,
  },
  // 严格策略：平均算力设备 50% 成功
  MEDIAN_AT_300KH: {
    factor: FACTOR_MEDIAN,
    hashrate: HASHRATE_AVG,
  },
};

/**
 * 根据 difficulty 和配置策略，计算挑战的过期时间（秒）
 */
function calculateDynamicExpiry(difficulty) {
    const strategy = POW_STRATEGY_MAP[POW_EXPIRY_STRATEGY];
    if (!strategy) {
        throw new Error(`Missing strategy`);
    }
    // 期望哈希数（2^difficulty）
    const hashes = Math.pow(2, difficulty);
    // 计算 expiry（秒）
    let expirySec = strategy.factor * (hashes / strategy.hashrate);
    //// 加一点 buffer（例如 10%，避免网络延迟等）
    // expirySec *= 1.10;
    // 限制在最小和最大范围之间
    expirySec = Math.max(MIN_CHALLENGE_EXPIRY, Math.min(expirySec, MAX_CHALLENGE_EXPIRY));
    return Math.round(expirySec);
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
    const token = jwt.sign(challengePayload, CHALLENGE_SECRET, { expiresIn: '120m' });
    return { challenge: token, expires: e };
}
// 验证PoW挑战和答案（二进制）
async function verifyPowChallenge(challengeToken, nonce) {
    try {
        // 验证JWT签名
        const challenge = jwt.verify(challengeToken, CHALLENGE_SECRET);
        
        // 检查挑战是否过期
        if ((Date.now() - challenge.t) > (challenge.e * 1000)) {
            return { valid: false, reason: "Challenge expired" };
        }
        
        const hashInput = challengeToken + nonce;
        const encoder = new TextEncoder();
        const data = encoder.encode(hashInput);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = new Uint8Array(hashBuffer);
        
        // 检查是否满足难度要求 - 二进制模式
        const difficulty = challenge.d;
        const zeroBytes = Math.floor(difficulty / 8);
        const remainingBits = difficulty % 8;
        
        // 检查完整字节
        for (let i = 0; i < zeroBytes; i++) {
            if (hashArray[i] !== 0) {
                return { valid: false, reason: "Invalid solution" };
            }
        }
        
        // 检查剩余位
        if (remainingBits > 0 && zeroBytes < 32) {
            const mask = (0xFF << (8 - remainingBits)) & 0xFF;
            if ((hashArray[zeroBytes] & mask) !== 0) {
                return { valid: false, reason: "Invalid solution" };
            }
        }
        
        return { valid: true, resource: challenge.r };
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
                const powHtmlPath = path.join(baseDir, 'resource/pow.html');
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
                    body: JSON.stringify({ error: 'Unable to load document' })
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


export default async function handle_request(ctx) {
    // 检查是否需要PoW验证
    let powDifficulty = parseInt(ctx.acParams.PoW) || 0;
    if (!(powDifficulty > 0)) return;
    // 处理 PoW
    // 二进制模式（难度b）/十六进制模式（默认）
    if (!acParams.PoW.endsWith('b')) powDifficulty *= 4;
    return await PoW_handler(ctx.event, ctx.context, {
        httpMethod: ctx.method,
        path: ctx.path,
        powDifficulty,
        arg1: ctx.arg1, arg2: ctx.arg2,
    });
}
