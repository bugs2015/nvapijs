/**
 * nvproxyjs 本地服务器版本
 * 用于在本地 Node.js 环境中运行 NVIDIA API 代理服务
 */

const http = require('http');
const https = require('https');
const url = require('url');

const NVIDIA_BASE = "https://integrate.api.nvidia.com";
const STANDARD_PATH = "/v1/chat/completions";

// 环境变量配置
const config = {
    KEY_PREFIX: process.env.KEY_PREFIX || "NV_KEY_",
    KEY_COUNT: parseInt(process.env.KEY_COUNT || "1"),
    MAX_CONCURRENCY: parseInt(process.env.MAX_CONCURRENCY || "2"),
    MAXTOKEN: parseInt(process.env.MAXTOKEN || "0"),
    PORT: process.env.PORT || 3000
};

// 获取所有配置的密钥
function getAllKeys() {
    let allKeys = [];
    for (let i = 1; i <= config.KEY_COUNT; i++) {
        const val = process.env[`${config.KEY_PREFIX}${i}`];
        if (val) allKeys.push({ index: i, key: val });
    }
    return allKeys;
}

// 获取有效的 Token
function getValidTokens() {
    let validTokens = [];
    for (let i = 1; i <= config.MAXTOKEN; i++) {
        const val = process.env[`TOKEN_${i}`];
        if (val) validTokens.push(val);
    }
    return validTokens;
}

// 验证 Token
function validateToken(authHeader) {
    if (config.MAXTOKEN === 0) return true;
    
    const providedToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
    const validTokens = getValidTokens();
    
    if (!providedToken || validTokens.length === 0) return false;
    return validTokens.includes(providedToken);
}

// 洗牌算法
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 发起 HTTP 请求
function makeRequest(options, data) {
    return new Promise((resolve, reject) => {
        const protocol = options.protocol === 'https:' ? https : http;
        const req = protocol.request(options, (res) => {
            let chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const body = Buffer.concat(chunks);
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: body
                });
            });
        });
        
        req.on('error', reject);
        
        if (data) {
            req.write(data);
        }
        req.end();
    });
}

// 处理请求
async function handleRequest(req, res) {
    const rid = Math.random().toString(36).substring(7);
    const startTimestamp = Date.now();
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const isModelList = urlObj.pathname === "/v1/models";
    
    console.log(`[${rid}] >>> 收到请求: ${req.method} ${urlObj.pathname} | 时间: ${new Date().toISOString()}`);

    // 处理 CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        // 鉴权
        const authHeader = req.headers['authorization'];
        if (!validateToken(authHeader)) {
            console.warn(`[${rid}] 鉴权失败: Token 不匹配`);
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: "Unauthorized" }));
            return;
        }

        // 读取 Body
        let requestBody = null;
        if (!isModelList && req.method === "POST") {
            requestBody = await new Promise((resolve) => {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => resolve(body));
            });
            console.log(`[${rid}] Body 读取完成 | 长度: ${requestBody.length} bytes`);
        }

        // 准备密钥
        let allKeys = getAllKeys();
        console.log(`[${rid}] 密钥库就绪 | 有效 Key 数量: ${allKeys.length}`);
        
        if (allKeys.length === 0) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: "No Keys" }));
            return;
        }
        
        allKeys = shuffleArray(allKeys);

        // 并发请求逻辑
        const CONCURRENCY_LIMIT = Math.min(config.MAX_CONCURRENCY, allKeys.length);
        
        const fetchWithKey = async (item) => {
            const fetchStart = Date.now();
            const headers = { 
                "Authorization": `Bearer ${item.key}`, 
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "text/event-stream",
                "Content-Type": "application/json"
            };

            console.log(`[${rid}] 尝试调用 Key #${item.index}`);

            try {
                const options = {
                    hostname: 'integrate.api.nvidia.com',
                    port: 443,
                    path: isModelList ? '/v1/models' : STANDARD_PATH,
                    method: isModelList ? 'GET' : 'POST',
                    headers: headers
                };

                const response = await makeRequest(options, requestBody);
                const duration = Date.now() - fetchStart;
                
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    console.log(`[${rid}] Key #${item.index} 响应成功 | 状态: ${response.statusCode} | 延迟: ${duration}ms`);
                    return response;
                } else {
                    console.error(`[${rid}] Key #${item.index} 业务报错 | 状态: ${response.statusCode} | 耗时: ${duration}ms`);
                    throw new Error(`Status ${response.statusCode}`);
                }
            } catch (e) {
                console.error(`[${rid}] Key #${item.index} 请求异常 | 错误: ${e.message}`);
                throw e;
            }
        };

        // 轮询执行
        for (let attempt = 0; attempt < Math.ceil(allKeys.length / CONCURRENCY_LIMIT); attempt++) {
            const batch = allKeys.slice(attempt * CONCURRENCY_LIMIT, (attempt + 1) * CONCURRENCY_LIMIT);
            const batchIndices = batch.map(k => `#${k.index}`).join(', ');
            
            console.log(`[${rid}] --- 第 ${attempt + 1} 轮调度 开始 --- | 包含 Key: [${batchIndices}]`);
            
            try {
                const promises = batch.map(item => fetchWithKey(item));
                const results = await Promise.allSettled(promises);
                
                const winner = results.find(result => result.status === 'fulfilled');
                
                if (winner) {
                    const response = winner.value;
                    
                    if (isModelList) {
                        res.writeHead(response.statusCode, {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        });
                        res.end(response.body);
                    } else {
                        console.log(`[${rid}] <<< 获胜响应已锁定 | 总历时: ${Date.now() - startTimestamp}ms`);
                        
                        res.writeHead(response.statusCode, {
                            'Content-Type': 'text/event-stream; charset=utf-8',
                            'Access-Control-Allow-Origin': '*',
                            'Connection': 'keep-alive',
                            'Cache-Control': 'no-cache'
                        });
                        res.end(response.body);
                    }
                    return;
                }
            } catch (e) {
                console.warn(`[${rid}] --- 第 ${attempt + 1} 轮调度 失败 ---`);
                if (attempt === Math.ceil(allKeys.length / CONCURRENCY_LIMIT) - 1) {
                    console.error(`[${rid}] 所有可用 Key 已耗尽`);
                    throw e;
                }
            }
        }
    } catch (err) {
        console.error(`[${rid}] 最终抛错: ${err.message} | 运行时长: ${Date.now() - startTimestamp}ms`);
        res.writeHead(502, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ error: err.message, rid: rid }));
    }
}

// 创建服务器
const server = http.createServer(handleRequest);

// 启动服务器
server.listen(config.PORT, () => {
    console.log('🚀 nvproxyjs 服务器启动成功');
    console.log(`📍 监听端口: ${config.PORT}`);
    console.log(`🔑 密钥数量: ${config.KEY_COUNT}`);
    console.log(`⚡ 最大并发: ${config.MAX_CONCURRENCY}`);
    console.log(`🛡️ Token 鉴权: ${config.MAXTOKEN > 0 ? '启用' : '禁用'}`);
    console.log('');
    console.log('📋 可用端点:');
    console.log(`  - GET  http://localhost:${config.PORT}/v1/models`);
    console.log(`  - POST http://localhost:${config.PORT}/v1/chat/completions`);
    console.log('');
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信号，正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n收到 SIGINT 信号，正在关闭服务器...');
    server.close(() => {
        console.log('服务器已关闭');
        process.exit(0);
    });
});

module.exports = server;