# 更新日志

本文档记录了 nvproxyjs 项目的所有重要更改。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2024-01-01

### 新增
- 初始版本发布
- NVIDIA API 代理服务核心功能
- 多密钥负载均衡支持
- 并发请求优化
- 自动故障转移机制
- Token 鉴权保护
- CORS 跨域支持
- 流式响应处理
- 详细日志记录
- 性能监控

### 功能特性
- 🔑 多密钥负载均衡
- 🚀 并发请求优化
- 🔄 自动故障转移
- 📊 详细日志记录
- 🛡️ Token 鉴权
- 🌐 CORS 支持
- ⚡ 流式响应

### 环境变量支持
- `KEY_PREFIX` - 密钥前缀配置
- `KEY_COUNT` - 密钥数量配置
- `MAX_CONCURRENCY` - 最大并发数
- `MAXTOKEN` - Token 鉴权数量
- `NV_KEY_*` - NVIDIA API 密钥
- `TOKEN_*` - 访问鉴权 Token

### API 端点
- `GET /v1/models` - 获取模型列表
- `POST /v1/chat/completions` - 聊天完成接口

### 文档
- 完整的 README.md 文档
- CONTRIBUTING.md 贡献指南
- LICENSE 许可证文件
- GitHub Issue 和 PR 模板

---

## 版本说明

### 版本号格式
- 主版本号 (MAJOR): 不兼容的 API 修改
- 次版本号 (MINOR): 向下兼容的功能性新增
- 修订号 (PATCH): 向下兼容的问题修正

### 更新类型
- **新增** (Added): 新功能
- **更改** (Changed): 现有功能的变更
- **弃用** (Deprecated): 即将移除的功能
- **移除** (Removed): 已移除的功能
- **修复** (Fixed): 错误修复
- **安全** (Security): 安全相关的修复