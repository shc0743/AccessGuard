// static.js
import path from 'path';
import fs from 'fs';
import mime from 'mime-types';
import { baseDir } from './config.js';

// 静态文件服务配置
const WEB_ROOT = path.join(baseDir, 'web');

/**
 * 处理静态文件请求
 * @param {string} requestPath 请求路径
 * @returns {Promise<Object>} 响应对象
 */
export async function serveStaticFile(requestPath) {
    if (requestPath === '/') {
        return redirectToWebRoot(requestPath.substring(1));
    }
    if (requestPath === '/favicon.ico') requestPath = '/web/img' + requestPath;
    requestPath = requestPath.substring(5);
    try {
        // 防止路径穿越攻击
        const normalizedPath = path.normalize(requestPath);
        let filePath = path.join(WEB_ROOT, normalizedPath);
        
        // 确保文件路径在WEB_ROOT内
        if (!filePath.startsWith(WEB_ROOT)) {
            return {
                statusCode: 403,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Dangerous request' })
            };
        }
        
        // 如果是目录，则查找index.html
        let stats;
        try {
            stats = await fs.promises.stat(filePath);
        } catch (err) {
            return {
                statusCode: 404,
                body: '',
            };
        }
        
        if (stats.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
            try {
                stats = await fs.promises.stat(filePath);
            } catch (err) {
                return {
                    statusCode: 404,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Index file not found' })
                };
            }
        }
        
        // 读取文件内容
        const content = await fs.promises.readFile(filePath);
        
        // 获取MIME类型
        const mimeType = mime.lookup(path.extname(filePath)) || 'application/octet-stream';
        
        return {
            statusCode: 200,
            headers: {
                'X-Service-Owner-Favorite-Character': 'Kiana Kaslana (Herrscher of Finality)',
                'Content-Type': mimeType,
                'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval'; worker-src 'self';",
                'Cache-Control': 'max-age=60', // 缓存
            },
            body: content.toString('base64'),
            isBase64Encoded: true,
        };
    } catch (error) {
        console.error('Error serving static file:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
}

/**
 * 检查是否为静态文件请求
 * @param {string} path 请求路径
 * @returns {boolean} 是否为静态文件请求
 */
export function isStaticRequest(path) {
    return path.startsWith('/web/') || path === '/' || path === '/favicon.ico';
}

/**
 * 处理根路径重定向
 * @returns {Object} 重定向响应
 */
function redirectToWebRoot(path = '') {
    return {
        statusCode: 308,
        headers: {
            'Location': '/web/' + path,
            'Cache-Control': 'no-store'
        }
    };
}
