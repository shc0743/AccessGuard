// DOM 元素引用
const policyStringEl = document.getElementById('policyString');
const refererEnabledEl = document.getElementById('refererEnabled');
const refererContentEl = document.getElementById('refererContent');
const domainListEl = document.getElementById('domainList');
const addDomainBtn = document.getElementById('addDomainBtn');
const allowEmptyRefererEl = document.getElementById('allowEmptyReferer');
const notBeforeEnabledEl = document.getElementById('notBeforeEnabled');
const notBeforeContentEl = document.getElementById('notBeforeContent');
const notBeforeDateEl = document.getElementById('notBeforeDate');
const notBeforeTimeEl = document.getElementById('notBeforeTime');
const notAfterEnabledEl = document.getElementById('notAfterEnabled');
const notAfterContentEl = document.getElementById('notAfterContent');
const notAfterDateEl = document.getElementById('notAfterDate');
const notAfterTimeEl = document.getElementById('notAfterTime');
const powEnabledEl = document.getElementById('powEnabled');
const powContentEl = document.getElementById('powContent');
const powDifficultyEl = document.getElementById('powDifficulty');
const filenameEl = document.getElementById('filename');
const finalUrlEl = document.getElementById('finalUrl');
const copyUrlBtn = document.getElementById('copyUrlBtn');

// 初始化
let domains = [];

// 设置当前日期和时间作为默认值
function setCurrentDateTime() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0];
    
    notBeforeDateEl.value = dateStr;
    notBeforeTimeEl.value = timeStr;
    
    // 设置默认结束时间为一天后
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDateStr = tomorrow.toISOString().split('T')[0];
    notAfterDateEl.value = tomorrowDateStr;
    notAfterTimeEl.value = timeStr;
}

setCurrentDateTime();

// 更新政策字符串
function updatePolicyString() {
    const parts = [];
    
    // Referer 部分
    if (refererEnabledEl.checked) {
        if (domains.length === 0 && allowEmptyRefererEl.checked) {
            parts.push('Referer='); // 只有空Referer
        } else if (domains.length > 0) {
            let refererValue = domains.join(',');
            if (allowEmptyRefererEl.checked) {
                refererValue += ','; // 添加空字符串在末尾
            }
            parts.push(`Referer=${refererValue}`);
        }
    }
    
    // NotBefore 部分
    if (notBeforeEnabledEl.checked && notBeforeDateEl.value && notBeforeTimeEl.value) {
        const dateTime = new Date(`${notBeforeDateEl.value}T${notBeforeTimeEl.value}`);
        parts.push(`NotBefore=${dateTime.getTime()}`);
    }
    
    // NotAfter 部分
    if (notAfterEnabledEl.checked && notAfterDateEl.value && notAfterTimeEl.value) {
        const dateTime = new Date(`${notAfterDateEl.value}T${notAfterTimeEl.value}`);
        parts.push(`NotAfter=${dateTime.getTime()}`);
    }
    
    // PoW 部分
    if (powEnabledEl.checked) {
        parts.push(`PoW=${powDifficultyEl.value}`);
    }
    
    policyStringEl.value = parts.join(';');
}

// 解析政策字符串
function parsePolicyString() {
    const policyString = policyStringEl.value;
    if (!policyString) return;
    
    // 重置所有选项
    refererEnabledEl.checked = false;
    notBeforeEnabledEl.checked = false;
    notAfterEnabledEl.checked = false;
    powEnabledEl.checked = false;
    domains = [];
    domainListEl.innerHTML = '';
    allowEmptyRefererEl.checked = false;
    setCurrentDateTime();
    
    // 解析字符串
    const parts = policyString.split(';');
    for (const part of parts) {
        const [key, value] = part.split('=');
        if (!key || !value) continue;
        
        switch (key.trim()) {
            case 'Referer':
                refererEnabledEl.checked = true;
                // 如果value是空字符串，则表示只允许空Referer
                if (value === '') {
                    domains = [];
                    allowEmptyRefererEl.checked = true;
                } else {
                    const domainValues = value.split(',');
                    // 检查最后一个元素是否为空字符串（表示允许空Referer）
                    if (domainValues[domainValues.length - 1] === '') {
                        allowEmptyRefererEl.checked = true;
                        domainValues.pop(); // 移除最后一个空元素
                    } else {
                        allowEmptyRefererEl.checked = false;
                    }
                    domains = domainValues.filter(d => d !== '');
                }
                break;
                
            case 'NotBefore':
                notBeforeEnabledEl.checked = true;
                const notBeforeDate = new Date(parseInt(value));
                notBeforeDateEl.value = notBeforeDate.toISOString().split('T')[0];
                notBeforeTimeEl.value = notBeforeDate.toTimeString().split(' ')[0];
                break;
                
            case 'NotAfter':
                notAfterEnabledEl.checked = true;
                const notAfterDate = new Date(parseInt(value));
                notAfterDateEl.value = notAfterDate.toISOString().split('T')[0];
                notAfterTimeEl.value = notAfterDate.toTimeString().split(' ')[0];
                break;
                
            case 'PoW':
                powEnabledEl.checked = true;
                powDifficultyEl.value = value;
                break;
        }
    }
    
    // 更新内容区域的显示状态
    updateContentVisibility();
}

// 渲染域名列表
function renderDomains() {
    domainListEl.innerHTML = '';
    domains.forEach((domain, index) => {
        const domainItem = document.createElement('div');
        domainItem.className = 'domain-item';
        domainItem.innerHTML = `
            <input type="text" value="${domain}" data-index="${index}">
            <button type="button" data-index="${index}">删除</button>
        `;
        domainListEl.appendChild(domainItem);
    });
    
    // 添加事件监听器
    domainListEl.querySelectorAll('input').forEach(input => {
        input.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index);
            domains[index] = e.target.value;
            updatePolicyString();
        });
    });
    
    domainListEl.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            domains.splice(index, 1);
            renderDomains();
            updatePolicyString();
        });
    });
}

// 更新内容区域的显示状态
function updateContentVisibility() {
    refererContentEl.classList.toggle('active', refererEnabledEl.checked);
    notBeforeContentEl.classList.toggle('active', notBeforeEnabledEl.checked);
    notAfterContentEl.classList.toggle('active', notAfterEnabledEl.checked);
    powContentEl.classList.toggle('active', powEnabledEl.checked);
}

// 添加新域名
addDomainBtn.addEventListener('click', () => {
    domains.push('');
    renderDomains();
    updatePolicyString();
});

// 选项启用/禁用事件
refererEnabledEl.addEventListener('change', () => {
    updateContentVisibility();
    updatePolicyString();
});

notBeforeEnabledEl.addEventListener('change', () => {
    updateContentVisibility();
    updatePolicyString();
});

notAfterEnabledEl.addEventListener('change', () => {
    updateContentVisibility();
    updatePolicyString();
});

powEnabledEl.addEventListener('change', () => {
    updateContentVisibility();
    updatePolicyString();
});

// 选项值变化事件
allowEmptyRefererEl.addEventListener('change', updatePolicyString);
notBeforeDateEl.addEventListener('change', updatePolicyString);
notBeforeTimeEl.addEventListener('change', updatePolicyString);
notAfterDateEl.addEventListener('change', updatePolicyString);
notAfterTimeEl.addEventListener('change', updatePolicyString);
powDifficultyEl.addEventListener('change', updatePolicyString);

// 政策字符串变化事件
policyStringEl.addEventListener('input', parsePolicyString);

// 初始化内容区域的显示状态
updateContentVisibility();

// 初始渲染域名列表
renderDomains();

// 更新最终URL
function updateFinalUrl() {
    const policyString = policyStringEl.value;
    const filename = filenameEl.value.trim();
    
    if (!policyString || !filename) {
        finalUrlEl.value = '';
        return;
    }
    
    const encodedPolicy = encodeURIComponent(policyString);
    const finalUrl = `${window.location.origin}/${encodedPolicy}/${filename}`;
    finalUrlEl.value = finalUrl;
}

// 复制URL到剪贴板
copyUrlBtn.addEventListener('click', async () => {
    if (!finalUrlEl.value) return;
    
    try {
        await navigator.clipboard.writeText(finalUrlEl.value);
        copyUrlBtn.textContent = '已复制!';
        setTimeout(() => {
            copyUrlBtn.textContent = '复制';
        }, 2000);
    } catch (err) {
        console.error('复制失败:', err);
        alert('复制失败，请手动复制URL');
    }
});

// 添加事件监听器
filenameEl.addEventListener('input', updateFinalUrl);
policyStringEl.addEventListener('input', updateFinalUrl);

// 初始化时更新一次URL
updateFinalUrl();