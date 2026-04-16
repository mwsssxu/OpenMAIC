"""
集成测试 - 用户数据隔离验证
"""

import pytest
import httpx
import asyncio
import uuid

BASE_URL = "http://localhost:8000"

@pytest.fixture
async def client():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30) as c:
        yield c


@pytest.fixture
async def user_a(client):
    """创建用户 A"""
    email = f"user_a_{uuid.uuid4().hex[:8]}@test.com"
    response = await client.post("/auth/register", json={
        "email": email,
        "password": "password123",
        "nickname": "User A"
    })
    return {
        "email": email,
        "token": response.json()["access_token"],
        "user_id": response.json()["user"]["id"]
    }


@pytest.fixture
async def user_b(client):
    """创建用户 B"""
    email = f"user_b_{uuid.uuid4().hex[:8]}@test.com"
    response = await client.post("/auth/register", json={
        "email": email,
        "password": "password123",
        "nickname": "User B"
    })
    return {
        "email": email,
        "token": response.json()["access_token"],
        "user_id": response.json()["user"]["id"]
    }


@pytest.mark.asyncio
async def test_user_registration(client):
    """测试用户注册"""
    email = f"new_user_{uuid.uuid4().hex[:8]}@test.com"
    response = await client.post("/auth/register", json={
        "email": email,
        "password": "password123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == email


@pytest.mark.asyncio
async def test_user_login(client, user_a):
    """测试用户登录"""
    response = await client.post("/auth/login", json={
        "email": user_a["email"],
        "password": "password123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data


@pytest.mark.asyncio
async def test_create_classroom(client, user_a):
    """测试创建课程"""
    response = await client.post(
        "/classrooms",
        json={"name": "测试课程", "description": "这是一个测试课程"},
        headers={"Authorization": f"Bearer {user_a['token']}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert data["name"] == "测试课程"


@pytest.mark.asyncio
async def test_list_classrooms(client, user_a):
    """测试获取课程列表"""
    # 先创建一个课程
    await client.post(
        "/classrooms",
        json={"name": "课程 A"},
        headers={"Authorization": f"Bearer {user_a['token']}"}
    )

    # 获取列表
    response = await client.get(
        "/classrooms",
        headers={"Authorization": f"Bearer {user_a['token']}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_user_data_isolation(client, user_a, user_b):
    """测试用户数据隔离"""
    # 用户 A 创建课程
    response_a = await client.post(
        "/classrooms",
        json={"name": "用户 A 的私密课程", "description": "私密"},
        headers={"Authorization": f"Bearer {user_a['token']}"}
    )
    classroom_id = response_a.json()["id"]

    # 用户 B 尝试访问用户 A 的课程
    response_b = await client.get(
        f"/classrooms/{classroom_id}",
        headers={"Authorization": f"Bearer {user_b['token']}"}
    )

    # 应返回 404（找不到）或 403（无权限）
    assert response_b.status_code in [404, 403]


@pytest.mark.asyncio
async def test_cross_user_delete(client, user_a, user_b):
    """测试跨用户删除（应失败）"""
    # 用户 A 创建课程
    response_a = await client.post(
        "/classrooms",
        json={"name": "重要课程"},
        headers={"Authorization": f"Bearer {user_a['token']}"}
    )
    classroom_id = response_a.json()["id"]

    # 用户 B 尝试删除用户 A 的课程
    response_b = await client.delete(
        f"/classrooms/{classroom_id}",
        headers={"Authorization": f"Bearer {user_b['token']}"}
    )

    # 应返回 404
    assert response_b.status_code == 404


@pytest.mark.asyncio
async def test_generate_outlines(client, user_a):
    """测试生成大纲"""
    response = await client.post(
        "/generate/outlines",
        json={"requirement": "教我 Python 基础", "language": "zh-CN"},
        headers={"Authorization": f"Bearer {user_a['token']}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "outlines" in data
    assert isinstance(data["outlines"], list)


@pytest.mark.asyncio
async def test_health_check(client):
    """测试健康检查"""
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_update_user_info(client, user_a):
    """测试更新用户信息"""
    response = await client.put(
        "/auth/me",
        json={"nickname": "新昵称", "avatar_url": "https://example.com/avatar.jpg"},
        headers={"Authorization": f"Bearer {user_a['token']}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["nickname"] == "新昵称"
    assert data["avatar_url"] == "https://example.com/avatar.jpg"


@pytest.mark.asyncio
async def test_change_password(client, user_a):
    """测试修改密码"""
    response = await client.post(
        "/auth/password",
        json={"old_password": "password123", "new_password": "newpassword456"},
        headers={"Authorization": f"Bearer {user_a['token']}"}
    )
    assert response.status_code == 200

    # 用新密码登录
    response = await client.post("/auth/login", json={
        "email": user_a["email"],
        "password": "newpassword456"
    })
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_change_password_wrong_old(client, user_a):
    """测试修改密码（旧密码错误）"""
    response = await client.post(
        "/auth/password",
        json={"old_password": "wrongpassword", "new_password": "newpassword"},
        headers={"Authorization": f"Bearer {user_a['token']}"}
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_export_user_data(client, user_a):
    """测试导出用户数据"""
    # 创建一些数据
    await client.post(
        "/classrooms",
        json={"name": "导出测试课程"},
        headers={"Authorization": f"Bearer {user_a['token']}"}
    )

    response = await client.get(
        "/auth/me/export",
        headers={"Authorization": f"Bearer {user_a['token']}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "exported_at" in data
    assert "user" in data
    assert "classrooms" in data
    assert len(data["classrooms"]) >= 1


@pytest.mark.asyncio
async def test_get_user_stats(client, user_a):
    """测试获取用户统计"""
    # 创建一些数据
    await client.post(
        "/classrooms",
        json={"name": "统计测试课程"},
        headers={"Authorization": f"Bearer {user_a['token']}"}
    )

    response = await client.get(
        "/auth/me/stats",
        headers={"Authorization": f"Bearer {user_a['token']}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "total_classrooms" in data
    assert data["total_classrooms"] >= 1


@pytest.mark.asyncio
async def test_delete_account(client):
    """测试注销账号"""
    # 创建临时用户
    email = f"temp_{uuid.uuid4().hex[:8]}@test.com"
    response = await client.post("/auth/register", json={
        "email": email,
        "password": "password123"
    })
    token = response.json()["access_token"]

    # 创建一些数据
    await client.post(
        "/classrooms",
        json={"name": "待删除课程"},
        headers={"Authorization": f"Bearer {token}"}
    )

    # 注销账号
    response = await client.delete(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200

    # 尝试再次登录应失败
    response = await client.post("/auth/login", json={
        "email": email,
        "password": "password123"
    })
    assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v"])