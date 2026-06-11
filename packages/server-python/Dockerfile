# OpenMAIC Python Backend - Dockerfile (Optimized)


FROM python:3.12-slim

WORKDIR /app

# 安装系统依赖（jbig2dec: PDF JBIG2图像解码）
RUN apt-get update -qq && apt-get install -y -qq jbig2dec && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir --timeout=120 -r requirements.txt

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
# 开发环境通过 docker-compose.yml command 覆盖为 --reload 模式
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--timeout-keep-alive", "300"]