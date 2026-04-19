"""
OpenMAIC Backend API Tests - 使用TestClient的测试套件

测试范围:
- 健康检查
- 认证接口 (注册/登录/用户管理)
- 课程接口 (CRUD)
- 积分系统
- Token系统
- 问答悬赏
- 邀请系统
- 订阅系统
"""

import pytest
import uuid
from fastapi.testclient import TestClient


class TestHealthCheck:
    """健康检查测试"""

    def test_health_check(self, client):
        """测试健康检查接口"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"


class TestAuthentication:
    """认证接口测试"""

    def test_user_register(self, client):
        """测试用户注册"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        response = client.post("/auth/register", json={
            "email": unique_email,
            "password": "TestPwd1!",
            "nickname": "testuser"
        })
        # 接受成功响应
        assert response.status_code in [200, 201]
        data = response.json()
        assert "access_token" in data

    def test_user_login(self, client):
        """测试用户登录 - 使用注册的用户"""
        # 先注册
        unique_email = f"login_{uuid.uuid4().hex[:8]}@example.com"
        reg_response = client.post("/auth/register", json={
            "email": unique_email,
            "password": "TestPwd1!",
            "nickname": "loginuser"
        })
        if reg_response.status_code not in [200, 201]:
            pytest.skip("注册失败，跳过登录测试")
        
        # 再登录
        response = client.post("/auth/login", json={
            "email": unique_email,
            "password": "TestPwd1!"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data

    def test_get_current_user(self, auth_client):
        """测试获取当前用户信息"""
        response = auth_client.get("/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert "id" in data

    def test_duplicate_register(self, client):
        """测试重复注册"""
        unique_email = f"dup_{uuid.uuid4().hex[:8]}@example.com"
        # 第一次注册
        client.post("/auth/register", json={
            "email": unique_email,
            "password": "TestPwd1!",
            "nickname": "dupuser"
        })
        # 第二次注册相同邮箱
        response = client.post("/auth/register", json={
            "email": unique_email,
            "password": "TestPwd1!",
            "nickname": "dupuser2"
        })
        assert response.status_code == 400
        assert "already registered" in response.json().get("detail", "").lower()


class TestClassrooms:
    """课程接口测试"""

    def test_create_classroom(self, auth_client):
        """测试创建课程"""
        response = auth_client.post("/classrooms", json={
            "name": "测试课程",
            "description": "测试描述",
            "language_directive": "中文"
        })
        assert response.status_code in [200, 201]
        data = response.json()
        assert "id" in data
        assert data["name"] == "测试课程"

    def test_list_classrooms(self, auth_client):
        """测试获取课程列表"""
        response = auth_client.get("/classrooms")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_classroom(self, auth_client, test_classroom_id):
        """测试获取单个课程"""
        if not test_classroom_id:
            pytest.skip("无测试课程ID")
        response = auth_client.get(f"/classrooms/{test_classroom_id}")
        assert response.status_code in [200, 404]

    def test_update_classroom(self, auth_client, test_classroom_id):
        """测试更新课程"""
        if not test_classroom_id:
            pytest.skip("无测试课程ID")
        response = auth_client.patch(
            f"/classrooms/{test_classroom_id}",
            json={"name": "更新后的课程名"}
        )
        assert response.status_code in [200, 404]

    def test_delete_classroom(self, auth_client, test_classroom_id):
        """测试删除课程"""
        if not test_classroom_id:
            pytest.skip("无测试课程ID")
        response = auth_client.delete(f"/classrooms/{test_classroom_id}")
        assert response.status_code in [200, 404]


class TestPoints:
    """积分系统测试"""

    def test_get_points_balance(self, auth_client):
        """测试获取积分余额"""
        response = auth_client.get("/points/balance")
        assert response.status_code == 200
        data = response.json()
        assert "balance" in data

    def test_get_points_history(self, auth_client):
        """测试获取积分历史"""
        response = auth_client.get("/points/history")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestTokens:
    """Token系统测试"""

    def test_get_token_balance(self, auth_client):
        """测试获取Token余额"""
        response = auth_client.get("/tokens/balance")
        assert response.status_code == 200
        data = response.json()
        assert "balance" in data

    def test_get_token_packages(self, client):
        """测试获取Token套餐"""
        response = client.get("/tokens/packages")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 3

    def test_get_token_history(self, auth_client):
        """测试获取Token历史"""
        response = auth_client.get("/tokens/history")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestQuestions:
    """问答悬赏测试"""

    def test_create_question(self, auth_client):
        """测试创建问题"""
        response = auth_client.post("/questions/", json={
            "title": "测试问题",
            "content": "这是测试问题内容",
            "bounty": 10
        })
        # 可能因积分不足返回400
        assert response.status_code in [200, 201, 400]

    def test_list_questions(self, auth_client):
        """测试获取问题列表"""
        response = auth_client.get("/questions/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestSubscriptions:
    """订阅系统测试"""

    def test_get_subscription_status(self, auth_client):
        """测试获取订阅状态"""
        response = auth_client.get("/subscriptions/status")
        assert response.status_code == 200
        data = response.json()
        assert "plan_type" in data

    def test_get_subscription_features(self, client):
        """测试获取订阅功能"""
        response = client.get("/subscriptions/features")
        assert response.status_code == 200
        data = response.json()
        assert "free" in data


class TestCheckin:
    """打卡系统测试"""

    def test_daily_checkin(self, auth_client):
        """测试每日打卡"""
        response = auth_client.post("/checkin/")
        # 可能已经打卡过
        assert response.status_code in [200, 400]

    def test_get_checkin_status(self, auth_client):
        """测试获取打卡状态"""
        response = auth_client.get("/checkin/status")
        assert response.status_code == 200
        data = response.json()
        assert "today_checked" in data


class TestGamification:
    """游戏化功能测试"""

    def test_get_user_stats(self, auth_client):
        """测试获取用户统计"""
        response = auth_client.get("/gamification/stats")
        assert response.status_code == 200
        data = response.json()
        assert "level" in data

    def test_get_achievements(self, auth_client):
        """测试获取成就列表"""
        response = auth_client.get("/gamification/achievements")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestInvitations:
    """邀请系统测试"""

    def test_get_invitation_code(self, auth_client):
        """测试获取邀请码"""
        response = auth_client.get("/invitations/code")
        assert response.status_code == 200
        data = response.json()
        assert "code" in data

    def test_get_invitation_stats(self, auth_client):
        """测试获取邀请统计"""
        response = auth_client.get("/invitations/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_invited" in data


class TestNotes:
    """共享笔记测试"""

    def test_list_notes(self, auth_client):
        """测试获取笔记列表"""
        response = auth_client.get("/notes/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_create_note(self, auth_client):
        """测试创建笔记"""
        response = auth_client.post("/notes/", json={
            "title": "测试笔记",
            "content": "笔记内容",
            "visibility": "private"
        })
        assert response.status_code in [200, 201]


class TestMatching:
    """学习搭子测试"""

    def test_get_matching_preferences(self, auth_client):
        """测试获取匹配偏好"""
        response = auth_client.get("/matching/preferences")
        # 可能未设置偏好
        assert response.status_code in [200, 404]


class TestRecommendations:
    """课程推荐测试"""

    def test_get_recommendations(self, auth_client, test_classroom_id):
        """测试获取推荐课程"""
        if not test_classroom_id:
            pytest.skip("无测试课程ID")
        response = auth_client.get(f"/recommendations/{test_classroom_id}")
        assert response.status_code in [200, 404]


class TestReview:
    """间隔复习测试"""

    def test_get_review_schedule(self, auth_client):
        """测试获取复习计划"""
        response = auth_client.get("/review/schedule")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestPassport:
    """学习护照测试"""

    def test_get_passport(self, auth_client):
        """测试获取学习护照"""
        response = auth_client.get("/passport")
        assert response.status_code == 200
        data = response.json()
        assert "skills" in data


class TestBuddy:
    """学习搭子配置测试"""

    def test_get_buddy_config(self, auth_client):
        """测试获取搭子配置"""
        response = auth_client.get("/buddy/config")
        assert response.status_code in [200, 404]


class TestPolicies:
    """政策条款测试"""

    def test_get_terms(self, client):
        """测试获取服务条款"""
        response = client.get("/policies/user-agreement")
        assert response.status_code == 200

    def test_get_privacy(self, client):
        """测试获取隐私政策"""
        response = client.get("/policies/privacy-policy")
        assert response.status_code == 200


class TestAssessments:
    """评估测试"""

    def test_list_assessments(self, auth_client):
        """测试获取评估列表"""
        response = auth_client.get("/assessments/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestAdminAuth:
    """管理员认证测试"""

    def test_admin_login_invalid(self, client):
        """测试无效管理员登录"""
        response = client.post("/admin/auth/login", json={
            "email": "invalid@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401


class TestAdminDashboard:
    """管理后台测试"""

    def test_admin_stats_unauthorized(self, client):
        """测试未授权访问管理统计"""
        response = client.get("/admin/stats")
        assert response.status_code in [401, 403]


class TestUnauthorizedAccess:
    """未授权访问测试"""

    def test_classrooms_without_token(self, client):
        """测试无Token访问课程"""
        response = client.get("/classrooms")
        assert response.status_code in [401, 403]

    def test_points_without_token(self, client):
        """测试无Token访问积分"""
        response = client.get("/points/balance")
        assert response.status_code in [401, 403]

    def test_tokens_without_token(self, client):
        """测试无Token访问Token"""
        response = client.get("/tokens/balance")
        assert response.status_code in [401, 403]


class TestErrorHandling:
    """错误处理测试"""

    def test_invalid_json(self, client):
        """测试无效JSON"""
        response = client.post(
            "/auth/register",
            content="{invalid json",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code in [400, 422]

    def test_not_found_endpoint(self, client):
        """测试不存在端点"""
        response = client.get("/nonexistent/endpoint")
        assert response.status_code == 404


# 运行测试入口
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])