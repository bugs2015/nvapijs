var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var NVIDIA_BASE = "https://integrate.api.nvidia.com";
var STANDARD_PATH = "/v1/chat/completions";

var nvmuley_instrumented_default = {
    async fetch(request, env) {
        const rid = Math.random().toString(36).substring(7);
        const startTimestamp = Date.now();
        const urlObj = new URL(request.url);
        const isModelList = urlObj.pathname === "/v1/models";
        
        console.log(`[${rid}] >>> 收到请求: ${request.method} ${urlObj.pathname} | 时间: ${new Date().toISOString()}`);

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "*" } });
        }

        try {
            // 1. 鉴权
            const authHeader = request.headers.get("Authorization");
            const maxTokenCount = parseInt(env.MAXTOKEN || "0");
            if (maxTokenCount > 0) {
                const providedToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
                let validTokens = [];
                for (let i = 1; i <= maxTokenCount; i++) if (env[`TOKEN_${i}`]) validTokens.push(env[`TOKEN_${i}`]);
                if (!providedToken || !validTokens.includes(providedToken)) {
                    console.warn(`[${rid}] 鉴权失败: Token 不匹配`);
                    return new Response("Unauthorized", { status: 401 });
                }
            }

            // 2. 读取 Body 并统计大小
            let requestBodyCached = null;
            if (!isModelList) {
                requestBodyCached = await request.text();
                console.log(`[${rid}] Body 读取完成 | 长度: ${requestBodyCached.length} bytes | 耗时: ${Date.now() - startTimestamp}ms`);
            }

            // 3. 准备 Keys 并洗牌
            const prefix = env.KEY_PREFIX || "NV_KEY_";
            const count = parseInt(env.KEY_COUNT || "1");
            let allKeys = [];
            for (let i = 1; i <= count; i++) {
                const val = env[`${prefix}${i}`];
                if (val) allKeys.push({ index: i, key: val });
            }
            
            console.log(`[${rid}] 密钥库就绪 | 有效 Key 数量: ${allKeys.length}`);
            
            if (allKeys.length === 0) return new Response("No Keys", { status: 500 });
            
            for (let i = allKeys.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allKeys[i], allKeys[j]] = [allKeys[j], allKeys[i]];
            }

            // 4. 并发请求逻辑
            const CONCURRENCY_LIMIT = Math.min(parseInt(env.MAX_CONCURRENCY || "2"), allKeys.length);
            
            const fetchWithKey = async (item, signal) => {
                const fetchStart = Date.now();
                const headers = { 
                    "Authorization": `Bearer ${item.key}`, 
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "text/event-stream"
                };
                if (!isModelList) headers["Content-Type"] = "application/json";

                console.log(`[${rid}] 尝试调用 Key #${item.index} | 并发信号: ${signal.aborted ? '已取消' : '有效'}`);

                try {
                    const res = await fetch(NVIDIA_BASE + (isModelList ? "/v1/models" : STANDARD_PATH), {
                        method: isModelList ? "GET" : "POST",
                        headers: headers,
                        body: isModelList ? null : requestBodyCached,
                        signal: signal
                    });
                    
                    const duration = Date.now() - fetchStart;
                    if (res.ok) {
                        console.log(`[${rid}] Key #${item.index} 响应成功 | 状态: ${res.status} | 延迟: ${duration}ms`);
                        return res;
                    } else {
                        const errText = await res.text().catch(() => "无法读取错误详情");
                        console.error(`[${rid}] Key #${item.index} 业务报错 | 状态: ${res.status} | 耗时: ${duration}ms | 详情: ${errText.slice(0, 100)}`);
                        throw new Error(`Status ${res.status}`);
                    }
                } catch (e) {
                    if (e.name === 'AbortError') {
                        console.log(`[${rid}] Key #${item.index} 已被竞争取消`);
                    } else {
                        console.error(`[${rid}] Key #${item.index} 请求异常 | 错误: ${e.message}`);
                    }
                    throw e;
                }
            };

            // 5. 轮询执行
            for (let attempt = 0; attempt < Math.ceil(allKeys.length / CONCURRENCY_LIMIT); attempt++) {
                const batch = allKeys.slice(attempt * CONCURRENCY_LIMIT, (attempt + 1) * CONCURRENCY_LIMIT);
                const batchController = new AbortController();
                const batchIndices = batch.map(k => `#${k.index}`).join(', ');
                
                console.log(`[${rid}] --- 第 ${attempt + 1} 轮调度 开始 --- | 包含 Key: [${batchIndices}]`);
                
                try {
                    const winner = await Promise.any(batch.map(item => fetchWithKey(item, batchController.signal)));
                    
                    if (isModelList) {
                        const modelData = await winner.json();
                        return new Response(JSON.stringify(modelData), { 
                            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
                        });
                    }

                    console.log(`[${rid}] <<< 获胜响应已锁定，建立原生流管道 | 总历时: ${Date.now() - startTimestamp}ms`);
                    
                    return new Response(winner.body, {
                        status: 200,
                        headers: {
                            "Content-Type": "text/event-stream; charset=utf-8",
                            "Access-Control-Allow-Origin": "*",
                            "Connection": "keep-alive",
                            "X-Accel-Buffering": "no",
                            "Cache-Control": "no-cache"
                        }
                    });
                } catch (e) {
                    batchController.abort();
                    console.warn(`[${rid}] --- 第 ${attempt + 1} 轮调度 失败 ---`);
                    if (attempt === Math.ceil(allKeys.length / CONCURRENCY_LIMIT) - 1) {
                        console.error(`[${rid}] 所有可用 Key 已耗尽`);
                        throw e;
                    }
                }
            }
        } catch (err) {
            console.error(`[${rid}] 最终抛错: ${err.message} | 运行时长: ${Date.now() - startTimestamp}ms`);
            return new Response(JSON.stringify({ error: err.message, rid: rid }), { 
                status: 502,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
            });
        }
    }
};
export { nvmuley_instrumented_default as default };