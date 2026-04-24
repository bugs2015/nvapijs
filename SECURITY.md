# 安全政策

## 支持的版本

| 版本 | 支持状态 |
|------|----------|
| 1.0.x | ✅ 支持 |
| < 1.0.0 | ❌ 不支持 |

## 报告安全漏洞

如果您发现安全漏洞，请不要公开报告，而是通过以下方式私下联系我们：

- 发送邮件至：security@example.com
- 使用 PGP 加密您的邮件（推荐）

请尽可能包含以下信息：

- 漏洞的详细描述
- 复现步骤
- 潜在的影响
- 如果可能，提供修复建议

我们会在 48 小时内回复，并在确认后会：

1. 确认收到报告
2. 评估漏洞的严重程度
3. 制定修复计划
4. 在适当的时候发布安全更新

## 安全最佳实践

### 部署安全

1. **使用环境变量**
   - 永远不要在代码中硬编码 API 密钥
   - 使用 Cloudflare Workers Secrets 存储敏感信息
   - 定期轮换 API 密钥

2. **启用鉴权**
   - 设置 `MAXTOKEN` 环境变量
   - 配置强密码作为访问 Token
   - 定期更新访问 Token

3. **限制访问**
   - 使用 Cloudflare Access 限制访问
   - 配置 IP 白名单（如需要）
   - 监控异常访问模式

### API 密钥管理

1. **获取 NVIDIA API 密钥**
   - 从官方 [NVIDIA NGC](https://ngc.nvidia.com/) 获取
   - 不要分享或公开您的密钥
   - 为不同环境使用不同的密钥

2. **密钥存储**
   ```bash
   # 使用 wrangler secret 命令安全存储密钥
   wrangler secret put NV_KEY_1
   wrangler secret put NV_KEY_2
   ```

3. **密钥轮换**
   - 定期（建议每 90 天）更换 API 密钥
   - 在更换前确保新密钥可用
   - 监控密钥使用情况

### 请求限制

1. **并发控制**
   - 根据您的 NVIDIA API 配额设置 `MAX_CONCURRENCY`
   - 监控请求频率和响应时间
   - 避免超过 API 速率限制

2. **速率限制**
   - 考虑实现额外的速率限制
   - 监控异常请求模式
   - 设置适当的超时时间

### 日志和监控

1. **日志安全**
   - 不要在日志中记录敏感信息
   - 定期清理和归档日志
   - 保护日志文件的访问权限

2. **监控指标**
   - 监控 API 调用次数
   - 跟踪错误率和响应时间
   - 设置异常告警

## 已知安全问题

目前没有已知的安全问题。

## 安全更新

我们会通过以下方式发布安全更新：

1. **GitHub Security Advisories**
   - 发布安全公告
   - 提供修复版本
   - 包含升级指南

2. **更新日志**
   - 在 CHANGELOG.md 中记录安全修复
   - 标注安全相关的更改

3. **依赖更新**
   - 定期更新依赖包
   - 及时修复已知漏洞
   - 使用 `npm audit` 检查安全问题

## 依赖安全

### 定期检查

```bash
# 检查依赖中的安全漏洞
npm audit

# 自动修复可修复的漏洞
npm audit fix

# 检查开发依赖
npm audit --dev
```

### 依赖更新

- 定期更新依赖包到最新版本
- 关注依赖包的安全公告
- 使用可靠的依赖包来源

## 安全资源

- [Cloudflare Workers 安全最佳实践](https://developers.cloudflare.com/workers/security/)
- [NVIDIA NGC 安全指南](https://docs.nvidia.com/ngc/)
- [OWASP 安全指南](https://owasp.org/)
- [Web 安全最佳实践](https://web.dev/secure/)

## 联系方式

- 安全邮箱：security@example.com
- GitHub Security：[https://github.com/yourusername/nvproxyjs/security](https://github.com/yourusername/nvproxyjs/security)

## 感谢

感谢所有帮助提高 nvproxyjs 安全性的研究人员和开发者！

---

**最后更新**: 2024-01-01