#!/bin/bash

# nvproxyjs 部署脚本
# 用于自动化部署到 Cloudflare Workers

set -e  # 遇到错误立即退出

echo "🚀 开始部署 nvproxyjs 到 Cloudflare Workers..."

# 检查是否安装了 wrangler
if ! command -v wrangler &> /dev/null; then
    echo "❌ 错误: wrangler 未安装"
    echo "请先安装: npm install -g wrangler"
    exit 1
fi

# 检查是否已登录
echo "📋 检查登录状态..."
if ! wrangler whoami &> /dev/null; then
    echo "⚠️  未登录，请先登录 Cloudflare"
    wrangler login
fi

# 询问部署环境
echo ""
echo "请选择部署环境:"
echo "1) 生产环境 (production)"
echo "2) 开发环境 (development)"
read -p "请输入选择 (1-2): " env_choice

case $env_choice in
    1)
        ENV="production"
        echo "🌍 部署到生产环境"
        ;;
    2)
        ENV="development"
        echo "🔧 部署到开发环境"
        ;;
    *)
        echo "❌ 无效的选择"
        exit 1
        ;;
esac

# 检查环境变量
echo ""
echo "📋 检查环境变量配置..."

# 检查必需的环境变量
required_vars=("KEY_COUNT" "MAX_CONCURRENCY")
for var in "${required_vars[@]}"; do
    if grep -q "^$var=" wrangler.toml; then
        echo "✅ $var 已配置"
    else
        echo "⚠️  $var 未配置，将使用默认值"
    fi
done

# 询问是否设置密钥
echo ""
read -p "是否需要设置/更新 NVIDIA API 密钥? (y/n): " setup_keys

if [ "$setup_keys" = "y" ] || [ "$setup_keys" = "Y" ]; then
    # 获取密钥数量
    key_count=$(grep "^KEY_COUNT=" wrangler.toml | cut -d'"' -f2)
    echo "📋 将设置 $key_count 个 NVIDIA API 密钥"
    
    for i in $(seq 1 $key_count); do
        echo ""
        read -p "请输入 NV_KEY_$i (留空跳过): " key_value
        if [ -n "$key_value" ]; then
            echo "🔐 设置 NV_KEY_$i..."
            echo "$key_value" | wrangler secret put NV_KEY_$i
        fi
    done
fi

# 询问是否设置访问 Token
echo ""
read -p "是否需要设置访问 Token? (y/n): " setup_tokens

if [ "$setup_tokens" = "y" ] || [ "$setup_tokens" = "Y" ]; then
    maxtoken=$(grep "^MAXTOKEN=" wrangler.toml | cut -d'"' -f2)
    if [ "$maxtoken" = "0" ]; then
        echo "⚠️  MAXTOKEN 设置为 0，不需要设置 Token"
    else
        echo "📋 将设置 $maxtoken 个访问 Token"
        for i in $(seq 1 $maxtoken); do
            echo ""
            read -p "请输入 TOKEN_$i (留空跳过): " token_value
            if [ -n "$token_value" ]; then
                echo "🔐 设置 TOKEN_$i..."
                echo "$token_value" | wrangler secret put TOKEN_$i
            fi
        done
    fi
fi

# 部署
echo ""
echo "🚀 开始部署..."
if [ "$ENV" = "production" ]; then
    wrangler deploy --env production
else
    wrangler deploy
fi

# 检查部署结果
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 部署成功！"
    echo ""
    echo "📋 后续步骤:"
    echo "1. 测试您的 Worker 端点"
    echo "2. 监控日志: wrangler tail"
    echo "3. 查看指标: Cloudflare Dashboard"
    echo ""
    echo "🔗 查看实时日志:"
    echo "   wrangler tail"
else
    echo ""
    echo "❌ 部署失败，请检查错误信息"
    exit 1
fi