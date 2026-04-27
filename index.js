/**
 * NVIDIA API Proxy - Cloudflare Worker (V5.6 串行批次 + 重试机制)
 * 
 * 核心修复：
 * - 🚀 串行批次执行：严格遵守 MAX_CONCURRENCY 限制
 * - 🚀 重试机制：所有key失败后自动重试
 * - 🚀 错误处理：最终失败时返回错误，避免客户端卡住
 * - 🚀 移除洗牌缓存：避免日志不一致问题
 * 
 * 继承特性：
 * - ✅ 智能并发竞速：确保遍历所有可用 Key
 * - ✅ 流式防泄漏：客户端断开时，立即中止上游生成
 * - ✅ 鉴权降本：全局缓存 Token Set
 * - ✅ 请求体干预：自动限制 max_tokens，强制 stream
 * 
 * 环境变量配置：
 * - NVIDIA_BASE: NVIDIA API 基础 URL（默认: https://integrate.api.nvidia.com）
 * - KEY_PREFIX: 密钥前缀（默认: NV_KEY_）
 * - KEY_COUNT: 密钥数量（默认: 1）
 * - MAXTOKEN: 最大鉴权令牌数（默认: 0）
 * - TOKEN_1, TOKEN_2, ...: 鉴权令牌
 * - MAX_CONCURRENCY: 最大并发数（默认: 2）
 * - MAX_RETRIES: 最大重试次数（默认: 1）
 * - DEFAULT_MAX_TOKENS: 默认最大 token 数（默认: 4096）
 * - REQUEST_TIMEOUT: 请求超时时间（默认: 30000ms）
 */
const NVIDIA_BASE = "https://integrate.api.nvidia.com";
const STANDARD_PATH = "/v1/chat/completions";
const DEFAULT_TIMEOUT = 30000; // 30秒默认超时

// --- 全局缓存（仅用于Token缓存）---
const globalCache = {
    validTokens: null,
    maxTokenCount: -1
};

// --- 轻量级日志（优化版：减少字符串操作）---
function log(rid, level, msg) {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const levels = { INFO: '📋', SUCCESS: '✅', WARN: '⚠️', ERROR: '❌', DEBUG: '🔍' };
    console.log(`${time} [${rid}] ${levels[level] || '📋'} ${msg}`);
}

// --- 生成请求ID ---
function generateRid() {
    return Math.random().toString(36).substring(2, 8);
}

// --- 获取客户端IP ---
function getClientIp(request) {
    return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'Unknown';
}

// --- 洗牌算法 ---
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// --- 辅助函数：将字符串安全转换为 ReadableStream ---
function stringToReadableStream(str) {
    return new ReadableStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode(str));
            controller.close();
        }
    });
}

// --- 核心请求函数（高并发优化版）---
async function fetchWithKey(env, item, payloadContent, isModelList, rid, batchSignal, clientSignal, timeout = DEFAULT_TIMEOUT) {
    const nvidiaBase = env.NVIDIA_BASE || NVIDIA_BASE;
    const url = isModelList ? `${nvidiaBase}/v1/models` : `${nvidiaBase}${STANDARD_PATH}`;
    
    // 快速验证
    if (!item?.key) {
        throw new Error('Invalid key');
    }
    
    const headers = {
        'Authorization': `Bearer ${item.key}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/event-stream'
    };
    if (!isModelList) {
        headers['Content-Type'] = 'application/json';
    }

    // 组合信号源（添加超时控制）
    const combinedController = new AbortController();
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeout);
    
    const onAbort = () => combinedController.abort();
    batchSignal.addEventListener('abort', onAbort, { once: true });
    clientSignal?.addEventListener('abort', onAbort, { once: true });
    timeoutController.signal.addEventListener('abort', onAbort, { once: true });

    const startTime = Date.now();
    try {
        const response = await fetch(url, {
            method: isModelList ? 'GET' : 'POST',
            headers: headers,
            body: isModelList ? null : stringToReadableStream(payloadContent),
            signal: combinedController.signal
        });
        
        const duration = Date.now() - startTime;
        if (response.ok) {
            log(rid, 'SUCCESS', `Key #${item.index} 成功 | ${duration}ms`);
            return response;
        } else {
            log(rid, 'WARN', `Key #${item.index} 失败 | ${response.status} | ${duration}ms`);
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (e) {
        const duration = Date.now() - startTime;
        if (e.name === 'AbortError') {
            // 静默处理取消
        } else if (e.message.startsWith('HTTP')) {
            throw e;
        } else {
            log(rid, 'ERROR', `Key #${item.index} 异常 | ${e.name} | ${duration}ms`);
            throw new Error(`Network error: ${e.message}`);
        }
        throw e;
    } finally {
        clearTimeout(timeoutId);
        // 使用 once: true 后不需要手动移除
    }
}

// --- 并发竞速逻辑（V5.6：串行批次 + 重试机制）---
async function raceWithKeys(env, payloadContent, isModelList, rid, clientSignal) {
    const keyPrefix = env.KEY_PREFIX || 'NV_KEY_';
    const keyCount = Math.max(1, parseInt(env.KEY_COUNT || '1') || 1);
    const maxConcurrency = Math.max(1, parseInt(env.MAX_CONCURRENCY || '2') || 2);
    const timeout = parseInt(env.REQUEST_TIMEOUT || String(DEFAULT_TIMEOUT)) || DEFAULT_TIMEOUT;
    const maxRetries = parseInt(env.MAX_RETRIES || '1') || 1; // 默认重试1次

    // 构建密钥池
    let allKeys = [];
    for (let i = 1; i <= keyCount; i++) {
        const key = env[`${keyPrefix}${i}`];
        if (key) allKeys.push({ index: i, key: key });
    }
    
    if (allKeys.length === 0) {
        throw new Error('没有可用的密钥');
    }
    
    log(rid, 'INFO', `密钥池就绪 | 数量: ${allKeys.length} | 并发: ${maxConcurrency} | 重试: ${maxRetries}`);

    // 🚀 重试机制
    for (let retry = 0; retry <= maxRetries; retry++) {
        if (retry > 0) {
            log(rid, 'WARN', `开始重试 (${retry}/${maxRetries})`);
        }

        const failedKeyIndices = new Set();
        let lastError = null;
        
        // 每次重试都重新洗牌
        const availableKeys = shuffleArray([...allKeys]);

        // 🚀 串行批次，严格遵守并发控制
        for (let i = 0; i < availableKeys.length; i += maxConcurrency) {
            const batch = availableKeys.slice(i, i + maxConcurrency);
            const batchNum = Math.floor(i / maxConcurrency) + 1;
            
            // 只在第一个批次输出详细日志
            if (batchNum === 1 && retry === 0) {
                const keyStr = batch.map(k => `#${k.index}`).join(', ');
                log(rid, 'INFO', `批次 ${batchNum} | Key: ${keyStr}`);
            }

            const controller = new AbortController();
            try {
                // 批次内部使用 Promise.any 竞速
                const winner = await Promise.any(
                    batch.map(item => 
                        fetchWithKey(env, item, payloadContent, isModelList, rid, controller.signal, clientSignal, timeout)
                    )
                );
                
                log(rid, 'SUCCESS', `批次 ${batchNum} 竞速成功`);
                return winner;
            } catch (e) {
                controller.abort();
                batch.forEach(k => failedKeyIndices.add(k.index));
                lastError = e;
                
                log(rid, 'DEBUG', `批次 ${batchNum} 失败`);
                
                // 继续下一个批次
            }
        }

        // 所有批次都失败
        log(rid, 'WARN', `重试 ${retry} 失败 | 失败: ${failedKeyIndices.size}/${allKeys.length}`);
    }

    // 所有重试都失败，返回错误
    log(rid, 'ERROR', `所有密钥失败 | 总重试: ${maxRetries}`);
    throw new Error(`All keys exhausted after ${maxRetries} retries`);
}

// --- 模型列表请求（直接获取，无缓存）---
async function fetchModelList(env, rid, clientSignal) {
    const nvidiaBase = env.NVIDIA_BASE || NVIDIA_BASE;
    try {
        const response = await fetch(`${nvidiaBase}/v1/models`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: clientSignal
        });
        
        if (response.ok) {
            return response;
        } else {
            log(rid, 'WARN', `获取模型列表失败 | ${response.status}`);
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (e) {
        log(rid, 'ERROR', `获取模型列表异常: ${e.message}`);
        throw e;
    }
}

// --- 主处理函数 ---
export default {
    async fetch(request, env, ctx) {
        const rid = generateRid();
        const clientIp = getClientIp(request);
        const url = new URL(request.url);
        const path = url.pathname;
        const isModelList = path === '/v1/models';
        const startTime = Date.now();
        log(rid, 'INFO', `${request.method} ${path} | IP: ${clientIp}`);

        // 处理预检请求
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': '*'
                }
            });
        }

        // 健康检查
        if (path === '/health' || path === '/kaithhealthcheck') {
            return new Response(JSON.stringify({
                status: 'healthy',
                service: 'nvidia-api-proxy',
                version: '5.6.0',
                timestamp: new Date().toISOString()
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // 根路径
        if (path === '/' || path === '') {
            return new Response(JSON.stringify({
                service: 'NVIDIA API Proxy',
                version: '5.6.0',
                description: '高性能流式 NVIDIA API 代理服务器',
                features: [
                    '智能并发竞速',
                    '流式防泄漏断路',
                    '端到端 SSE 流式管道',
                    '智能参数干预',
                    '并发流安全隔离',
                    '极速响应优化',
                    '低CPU占用',
                    '环境变量验证',
                    '请求超时控制',
                    '串行批次执行',
                    '自动重试机制',
                    '错误处理优化',
                    '日志一致性修复'
                ]
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        try {
            // --- 1. 鉴权（使用全局缓存对象）---
            if (!isModelList) {
                const maxTokenCount = parseInt(env.MAXTOKEN || '0');
                if (maxTokenCount > 0) {
                    // 使用全局缓存对象，避免竞态条件
                    if (globalCache.maxTokenCount !== maxTokenCount || !globalCache.validTokens) {
                        const tokenSet = new Set();
                        for (let i = 1; i <= maxTokenCount; i++) {
                            const token = env[`TOKEN_${i}`];
                            if (token) tokenSet.add(token);
                        }
                        globalCache.validTokens = tokenSet;
                        globalCache.maxTokenCount = maxTokenCount;
                    }
                    
                    const authHeader = request.headers.get('Authorization') || '';
                    const providedToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
                    
                    if (!globalCache.validTokens.has(providedToken)) {
                        log(rid, 'ERROR', '鉴权失败');
                        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                            status: 401,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            }
                        });
                    }
                }
            }

            // --- 2. 读取与干预请求体 ---
            let payloadContent = null;
            if (!isModelList && request.method === 'POST') {
                payloadContent = await request.clone().text();
                try {
                    let body = JSON.parse(payloadContent);
                    let modified = false;
                    
                    const defaultMaxTokens = parseInt(env.DEFAULT_MAX_TOKENS || '4096');
                    if (!body.max_tokens || body.max_tokens > defaultMaxTokens) {
                        body.max_tokens = defaultMaxTokens;
                        modified = true;
                    }

                    if (body.stream !== true) {
                        body.stream = true;
                        modified = true;
                    }

                    if (modified) {
                        payloadContent = JSON.stringify(body);
                    }
                } catch (e) {
                    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
                        status: 400,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        }
                    });
                }
            }

            // --- 3. 核心调度 ---
            let winner = null;
            if (isModelList) {
                // 🚀 直接获取模型列表，无缓存
                winner = await fetchModelList(env, rid, request.signal);
            } else {
                // 聊天请求使用竞速逻辑
                winner = await raceWithKeys(env, payloadContent, isModelList, rid, request.signal);
            }

            if (!winner) {
                const totalDuration = Date.now() - startTime;
                log(rid, 'ERROR', `所有密钥失败 | 总耗时: ${totalDuration}ms`);
                return new Response(JSON.stringify({
                    error: 'All keys failed',
                    message: '所有API密钥均已失败，请稍后重试',
                    rid: rid,
                    duration: totalDuration
                }), {
                    status: 502,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            }

            // --- 4. 返回响应 ---
            if (isModelList) {
                const modelData = await winner.json();
                log(rid, 'SUCCESS', `模型列表 | 总耗时: ${Date.now() - startTime}ms`);
                return new Response(JSON.stringify(modelData), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            } else {
                log(rid, 'SUCCESS', `流式响应管道已建立 | 总耗时: ${Date.now() - startTime}ms`);
                return new Response(winner.body, {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/event-stream; charset=utf-8',
                        'Access-Control-Allow-Origin': '*',
                        'Connection': 'keep-alive',
                        'X-Accel-Buffering': 'no',
                        'Cache-Control': 'no-cache'
                    }
                });
            }
        } catch (err) {
            const totalDuration = Date.now() - startTime;
            log(rid, 'ERROR', `全局异常: ${err.message} | 总耗时: ${totalDuration}ms`);
            return new Response(JSON.stringify({
                error: err.message,
                message: err.message.includes('All keys exhausted') 
                    ? '所有API密钥均已失败，请稍后重试'
                    : '请求处理失败，请稍后重试',
                rid: rid,
                duration: totalDuration
            }), {
                status: 502,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
    }
};