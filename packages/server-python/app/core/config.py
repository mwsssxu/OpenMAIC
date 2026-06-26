"""
应用配置 - 环境变量和设置
"""

from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # 应用配置
    APP_NAME: str = "OpenMAIC"
    DEBUG: bool = False
    TESTING_MODE: bool = os.getenv("TESTING_MODE", "false").lower() == "true"

    # 数据库
    DATABASE_URL: str = "postgres://maic:password@localhost:5432/maic"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # JWT - SECURITY WARNING: Must set SECRET_KEY in production!
    # Default empty value forces configuration check on startup
    SECRET_KEY: str = ""  # Required! Set via environment variable
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3030",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8081",
        "http://localhost:8082",
        "http://localhost:19000",  # Expo default
        "http://localhost:19006",  # Expo web
    ]

    # LLM 提供商
    OPENAI_API_KEY: str = ""
    OPENAI_API_BASE: str = ""  # 自定义 API endpoint (如阿里云百炼)
    HTTP_PROXY: str = ""  # HTTP 代理地址 (如 http://host.docker.internal:7890)
    # TTS 专用配置（可与 LLM 不同）
    TTS_API_KEY: str = ""  # TTS API key（如不配置则使用 OPENAI_API_KEY）
    TTS_API_BASE: str = ""  # TTS endpoint（如不配置则使用 OPENAI_API_BASE）
    ANTHROPIC_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""
    MINIMAX_API_KEY: str = ""
    DEFAULT_MODEL: str = "qwen3.7-plus"  # 默认文本模型，可通过环境变量覆盖

    # 阿里云 OSS
    OSS_ACCESS_KEY_ID: str = ""
    OSS_ACCESS_KEY_SECRET: str = ""
    OSS_BUCKET: str = ""
    OSS_ENDPOINT: str = ""

    # OAuth
    APPLE_CLIENT_ID: str = ""
    APPLE_CLIENT_SECRET: str = ""
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    WECHAT_APP_ID: str = ""
    WECHAT_APP_SECRET: str = ""

    # Payment - 支付签名验证密钥 (生产环境必须配置)
    WECHAT_PAY_API_KEY: str = ""  # 微信支付API密钥
    # Payment - 支付宝（证书模式，APPID: 2021003176655051）
    ALIPAY_APP_ID: str = ""           # 支付宝应用 APPID
    ALIPAY_APP_PRIVATE_KEY: str = ""  # 应用私钥（PKCS1/PKCS8，不含 BEGIN/END 标记）
    ALIPAY_APP_CERT_PATH: str = ""    # 应用公钥证书路径（.crt 文件）
    ALIPAY_PUBLIC_CERT_PATH: str = "" # 支付宝公钥证书路径（.crt 文件）
    ALIPAY_ROOT_CERT_PATH: str = ""   # 支付宝根证书路径（.crt 文件）
    ALIPAY_GATEWAY: str = "https://openapi.alipay.com/gateway.do"  # 沙箱用 https://openapi-sandbox.dl.alipaydev.com/gateway.do
    ALIPAY_NOTIFY_URL: str = ""       # 异步回调地址（公网可达，如 https://api.ceban.com/api/payment/callback/alipay）
    ALIPAY_RETURN_URL: str = ""       # 同步跳转地址（支付完成后浏览器跳转）
    ALIPAY_SANDBOX: bool = False      # 沙箱模式

    # 搜索配置
    GOOGLE_SEARCH_CX: str = ""  # Google Custom Search CX ID
    SERPER_API_KEY: str = ""    # Serper API Key
    TAVILY_API_KEY: str = ""    # Tavily API Key

    # Vision 模型配置
    VISION_MODEL_ID: str = ""  # Vision 模型 ID（如 gpt-4o, glm-4v, qwen-vl-max）

    # TTS 模型配置
    TTS_MODEL_ID: str = ""  # TTS 模型 ID（如 qwen3-tts-flash, cosyvoice-v1）

    # 图像生成模型配置
    IMAGE_GEN_MODEL_ID: str = ""  # 图像生成模型 ID（如 qwen-vl-image, wanx-v1）

    # 模型能力映射
    MODEL_CAPABILITIES: dict = {
        "gpt-4o": {"vision": True, "max_output_tokens": 4096},
        "gpt-4o-mini": {"vision": True, "max_output_tokens": 16384},
        "glm-4v": {"vision": True, "max_output_tokens": 4096},
        "glm-5": {"vision": False, "max_output_tokens": 8192},
        "gpt-4": {"vision": False, "max_output_tokens": 4096},
    }

    # 默认模型能力（当模型不在映射表中时使用）
    DEFAULT_MODEL_CAPABILITIES: dict = {"vision": False, "max_output_tokens": 2048}

    # MAIC-UI 服务配置（交互式内容生成）
    MAIC_UI_URL: str = ""  # MAIC-UI 服务地址（如 http://localhost:8927）
    MAIC_UI_ENABLED: bool = False  # 是否启用 MAIC-UI 集成
    MAIC_UI_SERVICE_TOKEN: str = ""  # MAIC-UI 服务账户令牌

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()