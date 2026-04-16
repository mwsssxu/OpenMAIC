"""
Pydantic 模型 - 用户
"""

from pydantic import BaseModel, EmailStr
from typing import Optional


class UserRegister(BaseModel):
    """用户注册请求"""
    email: EmailStr
    password: str
    nickname: Optional[str] = None


class UserLogin(BaseModel):
    """用户登录请求"""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """用户响应"""
    id: str
    email: str
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None


class UserUpdate(BaseModel):
    """用户更新请求"""
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None


class PasswordChange(BaseModel):
    """修改密码请求"""
    old_password: str
    new_password: str


class TokenResponse(BaseModel):
    """Token 响应"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class OAuthLoginRequest(BaseModel):
    """OAuth 登录请求"""
    provider: str  # 'apple', 'google', 'wechat'
    token: str  # OAuth provider 返回的 token
    user_info: Optional[dict] = None  # 部分平台需要额外用户信息


class UserStats(BaseModel):
    """用户统计"""
    total_classrooms: int = 0
    total_scenes: int = 0
    total_media_files: int = 0
    total_chat_sessions: int = 0