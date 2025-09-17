import path from 'path';
import { fileURLToPath } from 'url';
// 从环境变量获取配置
export const bucket = process.env.bucket;
export const region = process.env.region;
export const baseUrl = process.env.base;
export const CHALLENGE_SECRET = process.env.CHALLENGE_SECRET;
export const SIGNED_URL_EXPIRES = 10; // 签名URL有效期（秒）
export const DEBUG = (process.env.debug === 'true');
export const FAC = (process.env.favorite || null);
// difficulty 相关配置
export const MIN_CHALLENGE_EXPIRY = 15; // 最短挑战有效期（秒）
export const MAX_CHALLENGE_EXPIRY = 1800; // 最长挑战有效期（秒）
// 策略：可选 "T90_AT_200KH", "T90_AT_300KH", "MEDIAN_AT_300KH" 等
export const POW_EXPIRY_STRATEGY = "T90_AT_200KH";
// 最低算力（哈希率，单位 H/s）
export const HASHRATE_MIN = 200_000;   // 200 kH/s
export const HASHRATE_AVG = 300_000;   // 300 kH/s
// HTTP 请求相关
export const ALLOWED_METHODS = ["GET", "HEAD"];
// 项目根目录
export const baseDir = path.dirname(fileURLToPath(import.meta.url));
// 一些彩蛋
// 设置环境变量：“kiana=kaslana”以激活响应头中的彩蛋
export const EASTER_EGG = (process.env.kiana === 'kaslana');
// 确保配置正确
export function check_config() {
    if (!bucket || !region || !baseUrl || !CHALLENGE_SECRET) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Server configuration missing' })
        };
    }
}