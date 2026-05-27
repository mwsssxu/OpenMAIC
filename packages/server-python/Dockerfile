# OpenMAIC Python Backend - Dockerfile (Optimized)


FROM python:3.12-slim

WORKDIR /app

# 安装依赖（使用清华镜像源解决SSL问题）
COPY requirements.txt .
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt

# 复制应用代码
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .

# 暴露端口
EXPOSE 8000

# 健康检查 (使用 Python)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# 启动命令 - 增加 timeout-keep-alive 支持 SSE 长连接
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--timeout-keep-alive", "300"]