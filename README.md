# NVIDIA API Proxy

高性能流式 NVIDIA API 代理服务器，基于 Cloudflare Worker 构建。

## ✨ 特性

- 🚀 **智能并发竞速** - 确保遍历所有可用 Key，自动选择最优响应
- 🔄 **自动重试机制** - 所有 Key 失败后自动重试，提高成功率
- 🛡️ **流式防泄漏** - 客户端断开时立即中止上游生成，节省资源
- 🔐 **鉴权降本** - 全局缓存 Token Set，减少重复验证开销
- ⚙️ **请求体干预** - 自动限制 max_tokens，强制 stream 模式
- 📊 **串行批次执行** - 严格遵守 MAX_CONCURRENCY 限制
- 🎯 **错误处理优化** - 最终失败时返回错误，避免客户端卡住
- 📝 **详细日志系统** - 实时监控请求状态和性能指标

## 📦 安装部署

### 前置要求

- Cloudflare 账号
- Wrangler CLI 工具

### 部署步骤

1. 安装 Wrangler CLI：
```bash
npm install -g wrangler
```

2. 登录 Cloudflare：
```bash
wrangler login
```

3. 配置环境变量（见下方配置说明）

4. 部署 Worker：
```bash
wrangler deploy
```

## ⚙️ 环境变量配置

在 Cloudflare Worker 设置中配置以下环境变量：

### 基础配置

| 变量名 | 说明 | 默认值 | 必填 |
|--------|------|--------|------|
| `NVIDIA_BASE` | NVIDIA API 基础 URL | `https://integrate.api.nvidia.com` | 否 |
| `KEY_PREFIX` | 密钥前缀 | `NV_KEY_` | 否 |
| `KEY_COUNT` | 密钥数量 | `1` | 否 |
| `MAX_CONCURRENCY` | 最大并发数 | `2` | 否 |
| `MAX_RETRIES` | 最大重试次数 | `1` | 否 |
| `DEFAULT_MAX_TOKENS` | 默认最大 token 数 | `4096` | 否 |
| `REQUEST_TIMEOUT` | 请求超时时间（毫秒） | `30000` | 否 |

### NVIDIA API 密钥

配置多个 NVIDIA API 密钥以实现负载均衡：

```
NV_KEY_1=your_nvidia_api_key_1
NV_KEY_2=your_nvidia_api_key_2
NV_KEY_3=your_nvidia_api_key_3
...
```

### 鉴权配置（可选）

如果需要启用访问控制，配置以下变量：

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `MAXTOKEN` | 最大鉴权令牌数 | `0`（不启用） |
| `TOKEN_1` | 鉴权令牌 1 | - |
| `TOKEN_2` | 鉴权令牌 2 | - |
| ... | ... | ... |

## 🚀 使用方法

### API 端点

#### 健康检查
```bash
GET /health
```

#### 模型列表
```bash
GET /v1/models
Authorization: Bearer YOUR_TOKEN (如果启用鉴权)
```

#### 聊天补全
```bash
POST /v1/chat/completions
Authorization: Bearer YOUR_TOKEN (如果启用鉴权)
Content-Type: application/json

{
  "model": "meta/llama-3.1-405b-instruct",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "stream": true
}
```

### 示例代码

#### cURL 示例
```bash
curl -X POST https://your-worker.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "model": "meta/llama-3.1-405b-instruct",
    "messages": [{"role": "user", "content": "你好！"}],
    "stream": true
  }'
```

#### Python 示例
```python
import requests

url = "https://your-worker.workers.dev/v1/chat/completions"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_TOKEN"
}

data = {
    "model": "meta/llama-3.1-405b-instruct",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": True
}

response = requests.post(url, json=data, headers=headers, stream=True)
for line in response.iter_lines():
    if line:
        print(line.decode('utf-8'))
```

#### JavaScript 示例
```javascript
const response = await fetch('https://your-worker.workers.dev/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    model: 'meta/llama-3.1-405b-instruct',
    messages: [{ role: 'user', content: 'Hello!' }],
    stream: true
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(decoder.decode(value));
}
```

## 📊 性能优化

### 并发控制

- **串行批次执行**：严格遵守 `MAX_CONCURRENCY` 限制
- **智能竞速**：批次内使用 `Promise.any` 选择最快响应
- **自动重试**：失败后自动重试，提高成功率

### 资源管理

- **流式防泄漏**：客户端断开时立即中止上游
- **超时控制**：默认 30 秒超时，可配置
- **全局缓存**：Token Set 缓存减少验证开销

### 请求优化

- **强制流式**：自动将非流式请求转为流式
- **Token 限制**：自动限制 max_tokens 避免超限
- **CORS 支持**：完整的跨域支持

## 🛠️ 开发

### 本地开发

```bash
# 安装依赖
npm install

# 启动本地开发服务器
wrangler dev

# 运行测试
npm test
```

### 项目结构

```
nvproxyjs/
├── index.js          # 主程序文件
├── README.md         # 项目说明
├── LICENSE           # 许可证
├── .gitignore        # Git 忽略文件
└── wrangler.toml     # Wrangler 配置文件
```

## 📝 版本历史

### v5.6.0 (当前版本)
- 🚀 串行批次执行：严格遵守 MAX_CONCURRENCY 限制
- 🚀 重试机制：所有 key 失败后自动重试
- 🚀 错误处理：最终失败时返回错误，避免客户端卡住
- 🚀 移除洗牌缓存：避免日志不一致问题

### v5.5.0
- ✅ 智能并发竞速：确保遍历所有可用 Key
- ✅ 流式防泄漏：客户端断开时，立即中止上游生成
- ✅ 鉴权降本：全局缓存 Token Set
- ✅ 请求体干预：自动限制 max_tokens，强制 stream

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🔗 相关链接

- [NVIDIA API 文档](https://docs.nvidia.com/)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [OpenAI API 兼容性](https://platform.openai.com/docs/api-reference)

## 💬 支持

如有问题，请提交 Issue 或联系维护者。

---

**注意**：使用本代理服务时，请遵守 NVIDIA API 的使用条款和服务协议。
