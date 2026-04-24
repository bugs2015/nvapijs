# nvproxyjs

一个基于 Cloudflare Workers 的 NVIDIA API 代理服务，提供高性能、高可用的 NVIDIA API 访问代理。

## 功能特性

- 🔑 **多密钥负载均衡** - 支持配置多个 NVIDIA API 密钥，自动负载均衡
- 🚀 **并发请求优化** - 使用并发请求策略，提高响应速度
- 🔄 **自动故障转移** - 当某个密钥失败时自动切换到其他可用密钥
- 📊 **详细日志记录** - 提供完整的请求日志和性能监控
- 🛡️ **Token 鉴权** - 支持自定义 Token 鉴权保护
- 🌐 **CORS 支持** - 完整的跨域资源共享支持
- ⚡ **流式响应** - 原生支持流式数据传输

## 部署方式

### 方式一：本地部署

#### 前置要求

- Node.js >= 16.0.0
- NVIDIA API 密钥（可从 [NVIDIA NGC](https://ngc.nvidia.com/) 获取）

#### 安装和运行

```bash
# 克隆项目
git clone https://github.com/yourusername/nvproxyjs.git
cd nvproxyjs

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入您的 NVIDIA API 密钥

# 启动服务
npm start
```

服务将在 `http://localhost:3000` 启动。

#### Docker 部署

```bash
# 构建镜像
npm run docker:build

# 运行容器
npm run docker:run

# 或手动运行
docker run -p 3000:3000 \
  -e NV_KEY_1=your_key_1 \
  -e NV_KEY_2=your_key_2 \
  -e KEY_COUNT=2 \
  nvproxyjs
```

### 方式二：Cloudflare Workers 部署

#### 前置要求

- Cloudflare 账户
- Node.js >= 16.0.0
- NVIDIA API 密钥（可从 [NVIDIA NGC](https://ngc.nvidia.com/) 获取）

#### 部署步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/yourusername/nvproxyjs.git
   cd nvproxyjs
   ```

2. **安装 Wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

3. **登录 Cloudflare**
   ```bash
   wrangler login
   ```

4. **配置环境变量**

   编辑 `wrangler.toml` 文件并配置以下环境变量：

   ```toml
   name = "nvproxyjs"
   main = "index.js"
   compatibility_date = "2024-01-01"

   [vars]
   # 密钥配置前缀
   KEY_PREFIX = "NV_KEY_"
   # 密钥数量
   KEY_COUNT = "3"
   # 最大并发数
   MAX_CONCURRENCY = "2"
   # 最大 Token 数量（0 表示不限制）
   MAXTOKEN = "0"
   ```

5. **设置密钥**

   ```bash
   # 设置 NVIDIA API 密钥
   wrangler secret put NV_KEY_1
   wrangler secret put NV_KEY_2
   wrangler secret put NV_KEY_3

   # 设置访问 Token（可选）
   wrangler secret put TOKEN_1
   wrangler secret put TOKEN_2
   ```

6. **部署**
   ```bash
   wrangler deploy
   ```

## 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `KEY_PREFIX` | NVIDIA API 密钥的前缀 | `NV_KEY_` |
| `KEY_COUNT` | 配置的密钥数量 | `1` |
| `MAX_CONCURRENCY` | 最大并发请求数 | `2` |
| `MAXTOKEN` | 最大 Token 鉴权数量（0为不限制） | `0` |
| `TOKEN_1`, `TOKEN_2`, ... | 访问鉴权 Token | - |
| `NV_KEY_1`, `NV_KEY_2`, ... | NVIDIA API 密钥 | - |

## API 使用

### 获取模型列表

```bash
curl -X GET https://your-worker.workers.dev/v1/models \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 聊天完成

```bash
curl -X POST https://your-worker.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta/llama-3.1-405b-instruct",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": true
  }'
```

## 工作原理

1. **请求接收** - 接收客户端请求并验证鉴权 Token
2. **密钥选择** - 从配置的 NVIDIA API 密钥池中随机选择
3. **并发请求** - 使用并发策略同时向多个密钥发送请求
4. **响应处理** - 返回第一个成功的响应，取消其他请求
5. **流式传输** - 支持流式数据传输，提高响应速度

## 性能优化

- **密钥洗牌** - 每次请求随机打乱密钥顺序，避免热点密钥
- **并发控制** - 可配置的并发限制，防止过度请求
- **自动重试** - 失败自动切换到下一个密钥
- **流式管道** - 原生流式响应，减少延迟

## 监控与日志

服务提供详细的日志记录，包括：

- 请求时间和耗时
- 密钥使用情况
- 响应状态和延迟
- 错误详情和堆栈

## 安全建议

1. **使用环境变量** - 永远不要在代码中硬编码密钥
2. **启用 Token 鉴权** - 保护您的代理服务不被滥用
3. **限制并发数** - 根据您的 NVIDIA API 配额调整并发数
4. **定期轮换密钥** - 定期更新 API 密钥提高安全性

## 故障排除

### 401 Unauthorized
- 检查 Token 鉴权配置
- 确认 `MAXTOKEN` 和 `TOKEN_*` 环境变量设置正确

### 502 Bad Gateway
- 检查 NVIDIA API 密钥是否有效
- 确认密钥配额未超限
- 查看日志了解具体错误信息

### 响应缓慢
- 调整 `MAX_CONCURRENCY` 参数
- 检查网络连接质量
- 考虑增加更多密钥

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题或建议，请通过以下方式联系：

- GitHub Issues: [https://github.com/yourusername/nvproxyjs/issues](https://github.com/yourusername/nvproxyjs/issues)
- Email: your.email@example.com

## 致谢

- [NVIDIA NGC](https://ngc.nvidia.com/) - 提供 API 服务
- [Cloudflare Workers](https://workers.cloudflare.com/) - 提供运行平台