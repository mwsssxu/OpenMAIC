"""
单元测试 - 认证和安全
"""

import pytest
from app.core.security import hash_password, verify_password, create_access_token, verify_token


def test_password_hashing():
    """测试密码哈希"""
    password = "my_password_123"
    hashed = hash_password(password)

    # 哈希值应与原密码不同
    assert hashed != password

    # 验证密码应成功
    assert verify_password(password, hashed) is True

    # 错误密码应失败
    assert verify_password("wrong_password", hashed) is False


def test_jwt_creation():
    """测试 JWT 创建"""
    user_id = "test_user_123"
    token = create_access_token(user_id)

    # Token 应为字符串
    assert isinstance(token, str)

    # 验证 Token 应返回正确的 user_id
    extracted_user_id = verify_token(token)
    assert extracted_user_id == user_id


def test_jwt_invalid_token():
    """测试无效 JWT"""
    invalid_token = "invalid.token.here"

    # 无效 Token 应返回 None
    result = verify_token(invalid_token)
    assert result is None


def test_jwt_expired_token():
    """测试过期 JWT"""
    # 创建一个立即过期的 Token
    from datetime import timedelta
    import time

    # 创建有效期很短的 Token
    short_token = create_access_token("test_user", timedelta(seconds=1))

    # 立即验证应成功
    assert verify_token(short_token) == "test_user"

    # 等待过期
    time.sleep(2)

    # 过期后应返回 None
    assert verify_token(short_token) is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])