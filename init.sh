#!/bin/bash
# TeamBuddy - 会话初始化脚本
# 每次新会话开始时运行此脚本，快速恢复上下文

echo "========================================="
echo "  TeamBuddy - 研发小组管家 Agent"
echo "========================================="
echo ""

# 1. 最近 Git 变更
echo "📋 最近 Git 提交:"
git log --oneline -10 2>/dev/null || echo "  (暂无提交)"
echo ""

# 2. 进度摘要
echo "📊 进度摘要:"
if [ -f "progress.md" ]; then
    # 显示当前阶段和最近更新
    sed -n '/## 当前阶段/,/## /p' progress.md | head -20
    echo ""
    echo "📝 最近更新:"
    sed -n '/## 最近更新/,$p' progress.md | head -10
else
    echo "  progress.md 不存在"
fi
echo ""

# 3. Feature 状态统计
echo "🎯 Feature 状态:"
if [ -f "feature_list.json" ]; then
    total=$(grep -c '"id":' feature_list.json)
    done=$(grep -c '"status": "done"' feature_list.json)
    in_progress=$(grep -c '"status": "in_progress"' feature_list.json)
    pending=$(grep -c '"status": "pending"' feature_list.json)
    echo "  总计: $total | 完成: $done | 进行中: $in_progress | 待办: $pending"
else
    echo "  feature_list.json 不存在"
fi
echo ""

# 4. 开发服务状态检查
echo "🔧 服务状态:"
if [ -f "package.json" ]; then
    echo "  Node 项目已初始化"
    if [ -d "node_modules" ]; then
        echo "  依赖已安装"
    else
        echo "  ⚠️  依赖未安装 (需要 npm install)"
    fi
else
    echo "  ⚠️  package.json 不存在 (需要初始化 Next.js 项目)"
fi

# 检查数据库
if ls *.db >/dev/null 2>&1 || ls *.sqlite >/dev/null 2>&1; then
    echo "  SQLite 数据库存在"
else
    echo "  📦 数据库待创建"
fi
echo ""

echo "========================================="
echo "  准备就绪，可以开始工作！"
echo "========================================="
