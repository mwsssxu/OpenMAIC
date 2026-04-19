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
    ANTHROPIC_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""
    MINIMAX_API_KEY: str = ""
    DEFAULT_MODEL: str = "openai/gpt-4o"

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
    ALIPAY_PUBLIC_KEY: str = ""   # 支付宝公钥

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()