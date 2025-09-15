import path from 'path';
import { fileURLToPath } from 'url';
// 从环境变量获取配置
export const bucket = process.env.bucket;
export const region = process.env.region;
export const baseUrl = process.env.base;
export const CHALLENGE_SECRET = process.env.CHALLENGE_SECRET;
export const SIGNED_URL_EXPIRES = 10; // 签名URL有效期（秒）
// difficulty 相关配置
export const MIN_CHALLENGE_EXPIRY = 15; // 最短挑战有效期（秒）
export const MAX_CHALLENGE_EXPIRY = 1800; // 最长挑战有效期（秒）
// HTTP 请求相关
export const ALLOWED_METHODS = ["GET", "HEAD"];
// 项目根目录
export const baseDir = path.dirname(fileURLToPath(import.meta.url));
// 确保配置正确
export function checkConfig() {
    if (!bucket || !region || !baseUrl || !CHALLENGE_SECRET) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Server configuration missing' })
        };
    }
}