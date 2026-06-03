#!/bin/bash
# 快速修复笔记页面错误

echo "================================================"
echo "笔记页面错误修复"
echo "================================================"

cd /Users/xuning/workspace/project/git/ML/openmaic-business

echo ""
echo "【问题】个人笔记API SQL参数错误已修复"
echo "【修复】修改了 personal_notes.py 第113行"
echo "  - 修复前: *params[:-2] (参数传递错误)"
echo "  - 修复后: *params (正确传递查询条件)"
echo ""

echo "【重启Docker容器】"
echo "请执行以下命令重启服务："
echo ""
echo "  docker-compose restart python-server"
echo ""
echo "或重新构建："
echo ""
echo "  docker-compose build python-server"
echo "  docker-compose up -d"
echo ""

echo "================================================"