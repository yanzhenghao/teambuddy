#!/bin/bash
set -e
echo "=== TeamBuddy 本地启动 ==="
# 安装依赖
if [ ! -d "node_modules" ]; then
  echo "安装依赖..."
  npm install
fi
# 数据库已存在则跳过
if [ ! -f "teambuddy.db" ]; then
  echo "初始化数据库..."
  npm run db:migrate
  npm run db:seed
fi
echo "启动服务..."
npm run dev
