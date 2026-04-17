"""
积分兑换 Token 测试 - 验证兑换档位调整
"""

import pytest
import httpx
import uuid

BASE_URL = "http://localhost:8000"


@pytest.fixture
async def client():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30) as c:
        yield c


@pytest.fixture
async def test_user_with_points(client):
    """创建测试用户并发放积分"""
    email = f"exchange_test_{uuid.uuid4().hex[:8]}@test.com"
    response = await client.post("/auth/register", json={
        "email": email,
        "password": "password123"
    })
    assert response.status_code == 200
    token = response.json()["access_token"]
    user_id = response.json()["user"]["id"]

    # 发放积分（测试模式）
    response = await client.post(
        "/points/earn",
        json={"source": "test", "amount": 500},
        headers={"Authorization": f"Bearer {token}"}
    )

    return {
        "email": email,
        "token": token,
        "user_id": user_id,
        "initial_points": 500
    }


@pytest.mark.asyncio
async def test_get_exchange_rates(client):
    """测试获取兑换档位列表"""
    response = await client.get("/tokens/exchange-rates")
    assert response.status_code == 200
    data = response.json()
    assert "tiers" in data
    assert len(data["tiers"]) == 3

    # 验证档位配置
    tiers = data["tiers"]
    small = tiers[0]
    assert small["tier"] == "small"
    assert small["points"] == 50
    assert small["tokens"] == 10

    standard = tiers[1]
    assert standard["tier"] == "standard"
    assert standard["points"] == 100
    assert standard["tokens"] == 25

    large = tiers[2]
    assert large["tier"] == "large"
    assert large["points"] == 200
    assert large["tokens"] == 60


@pytest.mark.asyncio
async def test_exchange_small_tier(client, test_user_with_points):
    """测试小额兑换（50积分 → 10Token）"""
    response = await client.post(
        "/tokens/exchange",
        json={"tier": "small"},
        headers={"Authorization": f"Bearer {test_user_with_points['token']}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["tier"] == "small"
    assert data["points_used"] == 50
    assert data["tokens_gained"] == 10
    assert data["efficiency"] == 0.2


@pytest.mark.asyncio
async def test_exchange_standard_tier(client, test_user_with_points):
    """测试标准兑换（100积分 → 25Token）"""
    response = await client.post(
        "/tokens/exchange",
        json={"tier": "standard"},
        headers={"Authorization": f"Bearer {test_user_with_points['token']}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["tier"] == "standard"
    assert data["points_used"] == 100
    assert data["tokens_gained"] == 25
    assert data["efficiency"] == 0.25


@pytest.mark.asyncio
async def test_exchange_large_tier(client, test_user_with_points):
    """测试大额兑换（200积分 → 60Token）"""
    response = await client.post(
        "/tokens/exchange",
        json={"tier": "large"},
        headers={"Authorization": f"Bearer {test_user_with_points['token']}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["tier"] == "large"
    assert data["points_used"] == 200
    assert data["tokens_gained"] == 60
    assert data["efficiency"] == 0.3


@pytest.mark.asyncio
async def test_exchange_invalid_tier(client, test_user_with_points):
    """测试无效档位"""
    response = await client.post(
        "/tokens/exchange",
        json={"tier": "invalid"},
        headers={"Authorization": f"Bearer {test_user_with_points['token']}"}
    )
    assert response.status_code == 400
    assert "无效兑换档位" in response.json()["detail"]


@pytest.mark.asyncio
async def test_exchange_insufficient_points(client):
    """测试积分不足"""
    # 创建新用户，没有积分
    email = f"poor_user_{uuid.uuid4().hex[:8]}@test.com"
    response = await client.post("/auth/register", json={
        "email": email,
        "password": "password123"
    })
    token = response.json()["access_token"]

    response = await client.post(
        "/tokens/exchange",
        json={"tier": "large"},  # 需要 200 积分
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 400
    assert "积分余额不足" in response.json()["detail"]


@pytest.mark.asyncio
async def test_efficiency_comparison(client):
    """测试档位效率对比"""
    response = await client.get("/tokens/exchange-rates")
    data = response.json()

    # 验证效率递增
    efficiencies = [t["efficiency"] for t in data["tiers"]]
    assert efficiencies[0] < efficiencies[1] < efficiencies[2]

    # 大额兑换效率最高
    assert efficiencies[2] == 0.3  # 60/200 = 0.3