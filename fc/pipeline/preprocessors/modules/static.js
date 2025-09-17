import path from 'path';
import fs from 'fs';
import mime from 'mime-types';
import { baseDir } from '../../../config.js';
const WEB_ROOT = path.join(baseDir, 'web');


export default async function handle_request(ctx) {
    const path = ctx.event.requestContext?.http?.path;
    if (is_static_request(path)) return serve_static_file(path);
    return null;
}


// serve a static file.
export async function serve_static_file(requestPath) {
    if (requestPath === '/') return {
        statusCode: 308,
        headers: {
            'Location': '/web/' + requestPath.substring(1),
            'Cache-Control': 'no-store'
        }
    };
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
                body: 'Dangerous request'
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
                    body: 'Index file not found'
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
                'Content-Type': mimeType,
                'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval'; worker-src 'self';",
                'Cache-Control': 'max-age=30',
            },
            body: content.toString('base64'),
            isBase64Encoded: true,
        };
    } catch (error) {
        console.error('Error serving static file:', error);
        return {
            statusCode: 500,
            body: 'Error serving static file'
        };
    }
}

export function is_static_request(path) {
    return path.startsWith('/web/') || path === '/' || path === '/favicon.ico';
}
