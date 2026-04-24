# 贡献指南

感谢您对 nvproxyjs 项目的关注！我们欢迎任何形式的贡献。

## 如何贡献

### 报告问题

如果您发现了 bug 或有功能建议：

1. 检查 [Issues](https://github.com/yourusername/nvproxyjs/issues) 确保问题未被报告
2. 创建新的 Issue，使用清晰的标题和详细的描述
3. 提供重现问题的步骤和环境信息
4. 如果可能，附上相关的日志或截图

### 提交代码

1. **Fork 项目**
   ```bash
   # 在 GitHub 上点击 Fork 按钮
   git clone https://github.com/yourusername/nvproxyjs.git
   cd nvproxyjs
   ```

2. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

3. **进行修改**
   - 遵循现有代码风格
   - 添加必要的注释
   - 更新相关文档

4. **测试修改**
   ```bash
   # 本地测试
   npm run dev
   
   # 运行测试
   npm test
   ```

5. **提交更改**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   # 或
   git commit -m "fix: describe your bug fix"
   ```

6. **推送分支**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **创建 Pull Request**
   - 访问 GitHub 上的项目页面
   - 点击 "New Pull Request"
   - 填写 PR 模板中的信息
   - 等待代码审查

## 代码规范

### 命名规范

- **文件名**: 使用小写字母和连字符 `kebab-case.js`
- **变量名**: 使用驼峰命名法 `camelCase`
- **常量**: 使用大写字母和下划线 `UPPER_SNAKE_CASE`
- **函数名**: 使用驼峰命名法 `camelCase`

### 代码风格

- 使用 2 空格缩进
- 使用单引号
- 每行最大长度 80 字符
- 函数之间空一行
- 注释解释"为什么"而不是"是什么"

### 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型 (type):**
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具相关

**示例:**
```
feat(api): add rate limiting support

Add rate limiting to prevent API abuse and ensure fair usage
across all users.

Closes #123
```

## 开发环境设置

### 前置要求

- Node.js >= 16.0.0
- npm 或 yarn
- Git
- Cloudflare 账户（用于测试）

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
# 启动本地开发服务器
npm run dev

# 在另一个终端查看日志
npm run tail
```

### 测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- --grep "test-name"
```

## 文档贡献

文档同样重要！如果您发现：

- 错别字或语法错误
- 不清晰的说明
- 缺失的文档
- 过时的信息

请随时提交 PR 改进文档。

## 行为准则

### 我们的承诺

为了营造开放和友好的环境，我们承诺：

- 尊重不同的观点和经验
- 优雅地接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

### 不可接受的行为

- 使用性化的语言或图像
- 恶意评论或人身攻击
- 公开或私下骚扰
- 未经许可发布他人的私人信息
- 其他不道德或不专业的行为

## 获取帮助

如果您在贡献过程中遇到问题：

- 查看 [文档](README.md)
- 搜索 [Issues](https://github.com/yourusername/nvproxyjs/issues)
- 创建新的 Issue 寻求帮助
- 联系维护者

## 许可证

通过贡献代码，您同意您的贡献将根据项目的 MIT 许可证进行许可。

## 致谢

感谢所有贡献者！您的贡献让这个项目变得更好。

---

再次感谢您的贡献！🎉