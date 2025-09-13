// 移除不支持提示
document.getElementById('unsupported').style.display = 'none';

// 获取DOM元素
const errorElement = document.getElementById('error');
const progressBar = document.getElementById('progressBar');
const statusElement = document.getElementById('status');
const hashesElement = document.getElementById('hashes');
const retryButton = document.getElementById('retryButton');
retryButton.style.display = 'none';

// 检查crypto支持
if (!window.crypto || !window.crypto.subtle) {
    showError('您的浏览器不支持加密功能，请更新到现代浏览器。');
    throw 'bad';
}

// Web Worker代码（内联）
const workerCode = `
    let hashesPerSecond = 0;
    let lastHashes = 0;
    let lastTime = Date.now();
    
    // 将字符串转换为ArrayBuffer
    function stringToArrayBuffer(str) {
        const encoder = new TextEncoder();
        return encoder.encode(str);
    }
    
    // 计算SHA256哈希
    async function sha256(message) {
        const data = stringToArrayBuffer(message);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
    
    // 检查哈希是否满足难度要求
    function checkDifficulty(hash, difficulty) {
        return hash.startsWith('0'.repeat(difficulty));
    }
    
    // 主Worker逻辑
    self.onmessage = async function(e) {
        const { challenge, difficulty, startNonce, batchSize } = e.data;
        
        let nonce = startNonce;
        let found = false;
        let hashCount = 0;
        
        // 定时报告哈希率
        let iddid = setInterval(() => {
            const now = Date.now();
            const elapsedSeconds = (now - lastTime) / 1000;
            hashesPerSecond = Math.round((hashCount - lastHashes) / elapsedSeconds);
            lastHashes = hashCount;
            lastTime = now;
            
            self.postMessage({
                type: 'status',
                hashesPerSecond: hashesPerSecond,
                hashCount,
            });
        }, 1000);
        
        // 开始计算
        while (!found) {
            for (let i = 0; i < batchSize; i++) {
                const testString = challenge + nonce.toString();
                const hash = await sha256(testString);
                hashCount++;
                
                if (checkDifficulty(hash, difficulty)) {
                    self.postMessage({
                        type: 'solution',
                        nonce: nonce,
                        hash: hash
                    });
                    found = true;
                    break;
                }
                
                nonce++;
            }
            
            // 报告进度
            self.postMessage({
                type: 'progress',
                nonce: nonce,
                hashCount: hashCount
            });
            
            //// 短暂让出控制权，避免阻塞
            //await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        clearInterval(iddid);
    };
`;

// 创建Web Worker
let worker;
try {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    worker = new Worker(URL.createObjectURL(blob));
} catch (e) {
    showError('无法创建 Web Worker: ' + e.message);
    throw e;
}

// 初始化变量
let challenge = null;
let difficulty = 0;
let startTime = null;
let hashesPerSecond = 0;

// 启动PoW流程
startPowProcess();

// 重试按钮事件
retryButton.addEventListener('click', () => {
    errorElement.style.display = 'none';
    retryButton.style.display = 'none';
    startPowProcess();
});

// 启动PoW流程
async function startPowProcess() {
    try {
        statusElement.textContent = '正在获取挑战...';
        
        // 获取挑战
        const response = await fetch(window.location.href);
        
        if (response.status === 401) {
            const data = await response.json();
            
            // 需要PoW验证
            challenge = data.challenge;
            difficulty = data.difficulty;
            
            statusElement.textContent = `正在计算 (难度: ${difficulty})...`;
            startTime = Date.now();
            
            // 启动Worker进行计算
            worker.postMessage({
                challenge: challenge,
                difficulty: difficulty,
                startNonce: 0,
                batchSize: 51207 // 叱咤月海鱼鱼猫
            });
        } else if (response.status === 200) {
            const data = await response.text();
            // 直接重定向到签名URL
            window.open(data, '_self');
        } else {
            throw new Error('意外的服务器响应: ' + JSON.stringify(data));
        }
    } catch (error) {
        showError('获取挑战失败: ' + error.message);
    }
}

// Worker消息处理
worker.onmessage = function(e) {
    const data = e.data;
    
    switch (data.type) {
        case 'progress':
            // 更新进度显示
            const elapsedSeconds = (Date.now() - startTime) / 1000;
            progressBar.style.width = Math.min(100, (data.nonce / 1000000) * 100) + '%';
            break;
            
        case 'status':
            // 更新哈希率显示
            hashesPerSecond = data.hashesPerSecond;
            hashesElement.textContent = `${hashesPerSecond/1000} kH/s, ${Math.floor(data.hashCount/1000)}k iters`;
            break;
            
        case 'solution':
            // 找到解决方案
            statusElement.textContent = '验证成功，正在跳转...';
            progressBar.style.width = '100%';
            
            // 发送解决方案到服务器
            submitSolution(data.nonce);
            break;
    }
};

// Worker错误处理
worker.onerror = function(error) {
    showError('计算错误: ' + error.message);
};

// 提交解决方案到服务器
async function submitSolution(nonce) {
    try {
        const response = await fetch(window.location.href, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                challenge: challenge,
                nonce: nonce
            })
        });
        
        const data = await response.text();
        
        if (response.ok) {
            // 跳转到签名URL
            window.open(data, '_self');
        } else {
            throw new Error(data.error || '验证失败');
        }
    } catch (error) {
        showError('提交解决方案失败: ' + error.message);
    }
}

// 显示错误信息
function showError(message) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    statusElement.textContent = '验证失败';
    retryButton.style.display = 'block';
    
    // 终止Worker
    if (worker) {
        worker.terminate();
    }
}