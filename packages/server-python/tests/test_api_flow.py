"""
OpenMAIC 主流程单元测试
覆盖: 认证、大纲生成、智能体生成、课程创建、场景创建

运行方式:
pytest tests/test_api_flow.py -v --asyncio-mode=auto
pytest tests/test_api_flow.py -v -k "TestAuth" --asyncio-mode=auto
pytest tests/test_api_flow.py -v -k "TestOutline" --asyncio-mode=auto
pytest tests/test_api_flow.py -v -k "TestScene" --asyncio-mode=auto
"""

import pytest
import asyncio
import json
import uuid
import httpx
from typing import Dict, Any, List

# API 配置
API_BASE_URL = "http://localhost:8000"

# 测试用户配置
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "test123456"


# ==================== Helper Functions ====================

async def get_auth_token() -> str:
    """获取认证 token"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{API_BASE_URL}/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        if resp.status_code != 200:
            raise Exception(f"登录失败: {resp.text}")
        return resp.json().get("access_token")


async def generate_test_outlines(token: str) -> List[Dict[str, Any]]:
    """生成测试大纲"""
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{API_BASE_URL}/generate/outlines-stream",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "requirement": "为初中生创建一个关于光合作用的生物课程，包含基本概念讲解、实验演示和知识检测",
                "language": "zh-CN",
                "total_count": 3
            }
        )
        if resp.status_code != 200:
            raise Exception(f"大纲生成失败: {resp.text}")

        outlines = []
        lines = resp.text.split("\n")
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            # SSE格式: event: outline, data: {...}
            if line == "event: outline":
                # 下一行是 data
                if i + 1 < len(lines) and lines[i + 1].startswith("data: "):
                    data_str = lines[i + 1][6:]  # 移除 "data: " 前缀
                    try:
                        outline = json.loads(data_str)
                        outlines.append(outline)
                    except json.JSONDecodeError:
                        pass
                    i += 2
                    continue
            # 备用格式: data: {"event": "outline", ...}
            elif line.startswith("data: "):
                data_str = line[6:]
                try:
                    data = json.loads(data_str)
                    if data.get("event") == "outline":
                        outlines.append(data.get("data", data))
                except json.JSONDecodeError:
                    pass
            i += 1
        return outlines


async def generate_test_agents(token: str, outlines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """生成测试智能体"""
    async with httpx.AsyncClient(timeout=180.0) as client:  # 增加超时到180秒
        resp = await client.post(
            f"{API_BASE_URL}/generate/agent-profiles",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "stageInfo": {"name": "测试课程", "description": "测试"},
                "language": "zh-CN",
                "sceneOutlines": outlines[:3] if outlines else [],
                "availableAvatars": [
                    "/avatars/teacher.png",
                    "/avatars/assistant.png",
                    "/avatars/student1.png",
                ]
            }
        )
        if resp.status_code != 200:
            raise Exception(f"智能体生成失败: {resp.status_code} - {resp.text[:200]}")
        return resp.json().get("agents", [])


def clean_agent_config(agents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """清理智能体配置"""
    clean = []
    for a in agents[:5]:
        clean.append({
            "id": a.get("id"),
            "name": a.get("name"),
            "role": a.get("role"),
            "color": a.get("color"),
            "persona": a.get("persona"),
        })
    return clean


# ==================== Test Classes ====================

class TestAuth:
    """认证模块测试"""

    @pytest.mark.asyncio
    async def test_login_success(self):
        """测试登录成功"""
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{API_BASE_URL}/auth/login",
                json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
            )
            assert resp.status_code == 200
            data = resp.json()
            assert "access_token" in data
            assert len(data["access_token"]) > 20
            assert "user" in data
            assert data["user"]["email"] == TEST_USER_EMAIL

    @pytest.mark.asyncio
    async def test_login_invalid_password(self):
        """测试密码错误"""
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{API_BASE_URL}/auth/login",
                json={"email": TEST_USER_EMAIL, "password": "wrong_password"}
            )
            assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_login_invalid_email(self):
        """测试邮箱不存在"""
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{API_BASE_URL}/auth/login",
                json={"email": "nonexistent@example.com", "password": TEST_USER_PASSWORD}
            )
            assert resp.status_code == 401


class TestOutlineGeneration:
    """大纲生成测试"""

    @pytest.mark.asyncio
    async def test_outline_generation_success(self):
        """测试大纲生成成功"""
        token = await get_auth_token()
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{API_BASE_URL}/generate/outlines-stream",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "requirement": "为初中生创建一个关于光合作用的生物课程，包含基本概念讲解、实验演示和知识检测",
                    "language": "zh-CN",
                    "total_count": 3
                }
            )
            assert resp.status_code == 200

            outlines = []
            lines = resp.text.split("\n")
            i = 0
            while i < len(lines):
                line = lines[i].strip()
                if line == "event: outline":
                    if i + 1 < len(lines) and lines[i + 1].startswith("data: "):
                        data_str = lines[i + 1][6:]
                        try:
                            outline = json.loads(data_str)
                            outlines.append(outline)
                        except json.JSONDecodeError:
                            pass
                        i += 2
                        continue
                elif line.startswith("data: ") and not line.startswith("data: :"):
                    data_str = line[6:]
                    try:
                        data = json.loads(data_str)
                        if data.get("event") == "outline":
                            outlines.append(data.get("data", data))
                    except json.JSONDecodeError:
                        pass
                i += 1

            assert len(outlines) >= 3, f"大纲数量不足: {len(outlines)}"

            for outline in outlines:
                assert "title" in outline
                assert "type" in outline
                assert outline["type"] in ["slide", "quiz", "interactive", "pbl"]

    @pytest.mark.asyncio
    async def test_outline_generation_unauthorized(self):
        """测试未认证用户"""
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{API_BASE_URL}/generate/outlines-stream",
                json={
                    "requirement": "测试课程",
                    "language": "zh-CN",
                    "total_count": 1
                }
            )
            # 401 或 403 都表示认证失败
            assert resp.status_code in [401, 403]


class TestAgentGeneration:
    """智能体生成测试"""

    @pytest.mark.asyncio
    async def test_agent_generation_success(self):
        """测试智能体生成成功"""
        token = await get_auth_token()
        outlines = await generate_test_outlines(token)

        async with httpx.AsyncClient(timeout=180.0) as client:  # 增加超时
            resp = await client.post(
                f"{API_BASE_URL}/generate/agent-profiles",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "stageInfo": {"name": "测试课程", "description": "测试"},
                    "language": "zh-CN",
                    "sceneOutlines": outlines[:3] if outlines else [],
                    "availableAvatars": [
                        "/avatars/teacher.png",
                        "/avatars/assistant.png",
                        "/avatars/student1.png",
                    ]
                }
            )
            assert resp.status_code == 200, f"智能体生成失败: {resp.status_code} - {resp.text[:200]}"

            data = resp.json()
            assert "agents" in data
            assert len(data["agents"]) >= 3

            for agent in data["agents"]:
                assert "id" in agent
                assert "name" in agent
                assert "role" in agent
                assert agent["role"].lower() in ["teacher", "assistant", "student"]  # 支持大小写
                assert "persona" in agent


class TestClassroomCRUD:
    """课程 CRUD 测试"""

    @pytest.mark.asyncio
    async def test_create_classroom(self):
        """测试创建课程"""
        token = await get_auth_token()
        outlines = await generate_test_outlines(token)
        agents = await generate_test_agents(token, outlines)
        clean_agents = clean_agent_config(agents)

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{API_BASE_URL}/classrooms/create-full",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "name": f"单元测试课程-{str(uuid.uuid4())[:8]}",
                    "description": "测试描述",
                    "language": "zh-CN",
                    "agent_configs": clean_agents,
                    "outlines": outlines[:2] if outlines else []
                }
            )
            assert resp.status_code == 200, f"创建课程失败: {resp.status_code} - {resp.text[:200]}"

            data = resp.json()
            assert "id" in data
            classroom_id = data["id"]

            # 清理
            await client.delete(
                f"{API_BASE_URL}/classrooms/{classroom_id}",
                headers={"Authorization": f"Bearer {token}"}
            )

    @pytest.mark.asyncio
    async def test_list_classrooms(self):
        """测试获取课程列表"""
        token = await get_auth_token()

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{API_BASE_URL}/classrooms",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data, list)

    @pytest.mark.asyncio
    async def test_get_classroom_detail(self):
        """测试获取课程详情"""
        token = await get_auth_token()
        outlines = await generate_test_outlines(token)
        agents = await generate_test_agents(token, outlines)
        clean_agents = clean_agent_config(agents)

        async with httpx.AsyncClient(timeout=120.0) as client:  # 增加超时
            # 先创建课程
            create_resp = await client.post(
                f"{API_BASE_URL}/classrooms/create-full",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "name": f"详情测试-{str(uuid.uuid4())[:8]}",
                    "language": "zh-CN",
                    "agent_configs": clean_agents,
                    "outlines": outlines[:2] if outlines else []
                }
            )
            assert create_resp.status_code == 200, f"创建课程失败: {create_resp.status_code} - {create_resp.text[:200]}"
            classroom_id = create_resp.json()["id"]

            # 获取详情
            resp = await client.get(
                f"{API_BASE_URL}/classrooms/{classroom_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert resp.status_code == 200

            data = resp.json()
            assert "stage" in data
            assert "scenes" in data
            assert data["stage"]["id"] == classroom_id

            # 清理
            await client.delete(
                f"{API_BASE_URL}/classrooms/{classroom_id}",
                headers={"Authorization": f"Bearer {token}"}
            )

    @pytest.mark.asyncio
    async def test_delete_classroom(self):
        """测试删除课程"""
        token = await get_auth_token()
        outlines = await generate_test_outlines(token)

        async with httpx.AsyncClient(timeout=30.0) as client:
            # 先创建
            create_resp = await client.post(
                f"{API_BASE_URL}/classrooms/create-full",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "name": f"待删除课程-{str(uuid.uuid4())[:8]}",
                    "language": "zh-CN",
                    "outlines": outlines[:1] if outlines else []
                }
            )
            assert create_resp.status_code == 200
            classroom_id = create_resp.json()["id"]

            # 再删除
            delete_resp = await client.delete(
                f"{API_BASE_URL}/classrooms/{classroom_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert delete_resp.status_code == 200

            # 确认已删除
            get_resp = await client.get(
                f"{API_BASE_URL}/classrooms/{classroom_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert get_resp.status_code == 404


class TestSceneCreation:
    """场景创建测试"""

    @pytest.mark.asyncio
    async def test_create_single_scene(self):
        """测试创建单个场景"""
        token = await get_auth_token()
        outlines = await generate_test_outlines(token)
        agents = await generate_test_agents(token, outlines)
        clean_agents = clean_agent_config(agents)

        async with httpx.AsyncClient(timeout=400.0) as client:  # 场景创建需要更长时间
            # 先创建课程
            create_resp = await client.post(
                f"{API_BASE_URL}/classrooms/create-full",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "name": f"场景测试-{str(uuid.uuid4())[:8]}",
                    "language": "zh-CN",
                    "agent_configs": clean_agents,
                    "outlines": outlines[:2] if outlines else []
                }
            )
            assert create_resp.status_code == 200, f"创建课程失败: {create_resp.status_code} - {create_resp.text[:200]}"
            classroom_id = create_resp.json()["id"]

            outline = (outlines[0] if outlines else
                       {"id": "1", "type": "slide", "title": "测试场景", "description": "测试", "key_points": ["要点1"], "order": 1})

            # 创建场景
            resp = await client.post(
                f"{API_BASE_URL}/classrooms/{classroom_id}/scenes/create",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "outline": outline,
                    "order_index": 1,
                    "language": "zh-CN",
                    "agents": clean_agents
                }
            )
            assert resp.status_code == 200, f"创建场景失败: {resp.status_code} - {resp.text[:200]}"

            data = resp.json()
            assert "id" in data
            assert "title" in data

            scene_id = data["id"]

            # 获取课程详情检查场景
            detail_resp = await client.get(
                f"{API_BASE_URL}/classrooms/{classroom_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert detail_resp.status_code == 200

            detail_data = detail_resp.json()
            scenes = detail_data.get("scenes", [])

            created_scene = None
            for scene in scenes:
                if scene["id"] == scene_id:
                    created_scene = scene
                    break

            assert created_scene is not None

            # 检查内容结构
            content = created_scene.get("content", {})
            elements = content.get("canvas", {}).get("elements", content.get("elements", []))

            # LLM 生成的场景应该有多个元素（不是 fallback）
            assert len(elements) >= 3, f"元素数量不足: {len(elements)}"

            # 检查动作
            actions = created_scene.get("actions", [])
            assert len(actions) >= 2, f"动作数量不足: {len(actions)}"

            action_types = [a.get("type") for a in actions]
            assert "speech" in action_types, "应该有 speech 动作"

            # 清理
            await client.delete(
                f"{API_BASE_URL}/classrooms/{classroom_id}",
                headers={"Authorization": f"Bearer {token}"}
            )


class TestFullFlow:
    """完整流程测试"""

    @pytest.mark.asyncio
    async def test_full_course_creation_flow(self):
        """测试完整课程创建流程"""
        async with httpx.AsyncClient(timeout=500.0) as client:
            # 1. 认证
            auth_resp = await client.post(
                f"{API_BASE_URL}/auth/login",
                json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
            )
            assert auth_resp.status_code == 200
            token = auth_resp.json().get("access_token")

            # 2. 生成大纲
            outlines_resp = await client.post(
                f"{API_BASE_URL}/generate/outlines-stream",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "requirement": "创建一个关于Python编程基础的课程，包含变量、函数和控制流",
                    "language": "zh-CN",
                    "total_count": 2
                }
            )
            assert outlines_resp.status_code == 200

            outlines = []
            lines = outlines_resp.text.split("\n")
            i = 0
            while i < len(lines):
                line = lines[i].strip()
                if line == "event: outline":
                    if i + 1 < len(lines) and lines[i + 1].startswith("data: "):
                        data_str = lines[i + 1][6:]
                        try:
                            outline = json.loads(data_str)
                            outlines.append(outline)
                        except json.JSONDecodeError:
                            pass
                        i += 2
                        continue
                elif line.startswith("data: ") and not line.startswith("data: :"):
                    data_str = line[6:]
                    try:
                        data = json.loads(data_str)
                        if data.get("event") == "outline":
                            outlines.append(data.get("data", data))
                    except json.JSONDecodeError:
                        pass
                i += 1

            assert len(outlines) >= 2

            # 3. 生成智能体
            agents_resp = await client.post(
                f"{API_BASE_URL}/generate/agent-profiles",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "stageInfo": {"name": "测试", "description": "测试"},
                    "language": "zh-CN",
                    "sceneOutlines": outlines,
                    "availableAvatars": ["/avatars/teacher.png"]
                }
            )
            assert agents_resp.status_code == 200
            agents = agents_resp.json().get("agents", [])
            clean_agents = clean_agent_config(agents)

            # 4. 创建课程
            classroom_resp = await client.post(
                f"{API_BASE_URL}/classrooms/create-full",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "name": f"完整流程测试-{str(uuid.uuid4())[:8]}",
                    "language": "zh-CN",
                    "agent_configs": clean_agents,
                    "outlines": outlines[:2]
                }
            )
            assert classroom_resp.status_code == 200
            classroom_id = classroom_resp.json()["id"]

            # 5. 创建场景
            scene_resp = await client.post(
                f"{API_BASE_URL}/classrooms/{classroom_id}/scenes/create",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "outline": outlines[0],
                    "order_index": 1,
                    "language": "zh-CN",
                    "agents": clean_agents
                }
            )
            assert scene_resp.status_code == 200
            scene_id = scene_resp.json()["id"]
            assert scene_id is not None

            # 6. 验证场景内容
            detail_resp = await client.get(
                f"{API_BASE_URL}/classrooms/{classroom_id}",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert detail_resp.status_code == 200

            # 清理
            await client.delete(
                f"{API_BASE_URL}/classrooms/{classroom_id}",
                headers={"Authorization": f"Bearer {token}"}
            )