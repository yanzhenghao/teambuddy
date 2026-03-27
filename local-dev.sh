#!/bin/bash
set -e
echo "=== TeamBuddy 本地启动 ==="
# 数据库已存在则跳过
if [ ! -f "teambuddy.db" ]; then
  npm run db:migrate
  npm run db:seed
fi
npm run dev
