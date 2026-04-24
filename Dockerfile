# 使用官方 Node.js 镜像
FROM node:20-bookworm-slim

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制项目文件
COPY . .

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["node", "index.js"]