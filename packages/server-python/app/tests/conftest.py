"""
pytest 配置文件 - 测试fixture和配置管理

使用 FastAPI TestClient 进行独立测试，无需运行服务器
"""

import pytest
import uuid
import asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport
import os

# 设置测试环境 - 必须在导入app之前设置
os.environ.setdefault("TESTING_MODE", "true")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests")

from app.main import app


# ==================== 基础 Fixture ====================

@pytest.fixture(scope="session")
def event_loop():
    """创建事件循环"""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def client():
    """同步测试客户端 - 无需认证"""
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def registered_user(client):
    """注册一个测试用户并返回其token和数据"""
    unique_id = uuid.uuid4().hex[:8]
    user_data = {
        "email": f"test_{unique_id}@example.com",
        "password": "TestPwd1!",
        "nickname": "testuser"
    }
    response = client.post("/auth/register", json=user_data)
    print(f"Register response: {response.status_code}")
    if response.status_code in [200, 201]:
        token = response.json().get("access_token")
        print(f"Token obtained: {token[:20] if token else 'None'}...")
        return {"token": token, "user_data": user_data}
    print(f"Register failed: {response.json()}")
    return None


@pytest.fixture(scope="module")
def auth_client(client, registered_user):
    """已认证的测试客户端 - module级别确保token全局可用"""
    if registered_user and registered_user.get("token"):
        token = registered_user['token']
        client.headers["Authorization"] = f"Bearer {token}"
        print(f"Authorization header set: Bearer {token[:20]}...")
    yield client
    # 清理
    client.headers.pop("Authorization", None)


@pytest.fixture
def test_classroom_id(auth_client):
    """创建测试课程并返回ID - 如果认证失败则跳过"""
    # 检查是否已认证
    if "Authorization" not in auth_client.headers:
        pytest.skip("需要认证才能创建课程")
        return None
    
    response = auth_client.post("/classrooms", json={
        "name": "测试课程",
        "description": "用于测试的课程",
        "language_directive": "中文"
    })
    if response.status_code in [200, 201]:
        return response.json().get("id")
    return None


# ==================== 管理员 Fixture ====================

@pytest.fixture
def admin_user_data():
    """管理员测试数据"""
    unique_id = uuid.uuid4().hex[:8]
    return {
        "email": f"admin_{unique_id}@example.com",
        "password": "AdminPwd1!",  # 短密码
        "nickname": "testadmin"
    }


@pytest.fixture
def admin_client(client):
    """管理员认证客户端（用于测试未授权场景）"""
    # 注意：真实管理员测试需要预先创建超级管理员
    # 这里主要用于测试未授权访问
    yield client


# ==================== 数据清理 Fixture ====================

@pytest.fixture(autouse=True)
def cleanup_test_data():
    """自动清理测试数据"""
    yield
    # 测试结束后清理逻辑可以在这里添加
    # 例如：删除测试用户、课程等


# ==================== 边界数据 Fixture ====================

@pytest.fixture
def boundary_test_cases():
    """边界测试数据集"""
    return {
        "empty_string": "",
        "very_long_string": "a" * 100,
        "special_chars": "!@#$%^&*(){}[]|\\:;\"'<>,.?/~`",
        "invalid_email": "not-an-email",
        "invalid_uuid": "not-a-uuid",
        "negative_number": -100,
        "zero": 0,
        "large_number": 999999999999,
        "unicode_chars": "中文日本語한국어العربية",
        "whitespace_only": "   ",
        "null_json": None,
        "sql_injection_attempt": "'; DROP TABLE users; --",
        "xss_attempt": "<script>alert('xss')</script>",
        "path_traversal": "../../../etc/passwd",
    }


# ==================== 支付测试数据 Fixture ====================

@pytest.fixture
def payment_test_data():
    """支付测试数据"""
    return {
        "valid_order": {
            "product_type": "tokens",
            "package_id": "basic",
            "amount": 1000
        },
        "invalid_order_negative": {
            "product_type": "tokens",
            "package_id": "basic",
            "amount": -100
        },
        "invalid_order_zero": {
            "product_type": "tokens",
            "package_id": "basic",
            "amount": 0
        },
        "invalid_order_type": {
            "product_type": "invalid_type",
            "package_id": "basic",
            "amount": 1000
        },
        "wechat_callback": {
            "transaction_id": "test_txn_123",
            "out_trade_no": "order_123",
            "total": 1000,
            "result_code": "SUCCESS"
        }
    }