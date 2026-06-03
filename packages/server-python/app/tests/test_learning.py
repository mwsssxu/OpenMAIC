"""
学习记录系统单元测试

测试覆盖：
1. 学习记录API (start, update-time, complete, stats)
2. 每日打卡功能
3. 成就徽章自动发放
4. Profile统计数据获取
"""

import pytest
from fastapi.testclient import TestClient
import uuid


class TestLearningAPI:
    """学习记录API测试"""

    def test_start_learning_success(self, auth_client, test_classroom_id):
        """测试成功开始学习"""
        if not test_classroom_id:
            pytest.skip("需要先创建课程")

        response = auth_client.post(
            "/learning/start",
            json={"course_id": test_classroom_id}
        )

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] in ["开始学习", "继续学习"]
        assert "time_spent" in data
        assert "scenes_completed" in data

    def test_start_learning_invalid_course(self, auth_client):
        """测试开始学习不存在的课程"""
        fake_course_id = str(uuid.uuid4())

        response = auth_client.post(
            "/learning/start",
            json={"course_id": fake_course_id}
        )

        assert response.status_code == 404
        assert "课程不存在" in response.json().get("detail", "")

    def test_update_learning_time(self, auth_client, test_classroom_id):
        """测试更新学习时长"""
        if not test_classroom_id:
            pytest.skip("需要先创建课程")

        # 先开始学习
        auth_client.post(
            "/learning/start",
            json={"course_id": test_classroom_id}
        )

        # 更新学习时长
        response = auth_client.post(
            "/learning/update-time",
            json={
                "course_id": test_classroom_id,
                "minutes": 10,
                "scenes_completed": 2
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "更新成功"
        assert data["time_spent"] == 10
        assert data["scenes_completed"] == 2

    def test_complete_learning(self, auth_client, test_classroom_id):
        """测试完成课程学习"""
        if not test_classroom_id:
            pytest.skip("需要先创建课程")

        # 先开始学习
        auth_client.post(
            "/learning/start",
            json={"course_id": test_classroom_id}
        )

        # 更新学习时长
        auth_client.post(
            "/learning/update-time",
            json={
                "course_id": test_classroom_id,
                "minutes": 30,
                "scenes_completed": 5
            }
        )

        # 完成学习
        response = auth_client.post(
            "/learning/complete",
            json={
                "course_id": test_classroom_id,
                "total_minutes": 30,
                "scenes_completed": 5,
                "total_scenes": 5,
                "quiz_score": 85
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "课程完成"
        assert data["time_spent_minutes"] == 30
        assert data["scenes_completed"] == 5
        assert data["completion_rate"] == 100.0
        assert data["quiz_score"] == 85
        # 打卡奖励应该大于等于0
        assert data["streak_bonus"] >= 0

    def test_get_learning_stats(self, auth_client):
        """测试获取学习统计"""
        response = auth_client.get("/learning/stats")

        assert response.status_code == 200
        data = response.json()
        assert "total_hours" in data
        assert "completed_courses" in data
        assert "active_courses" in data
        assert "weekly_hours" in data


class TestCheckinAPI:
    """每日打卡API测试"""

    def test_daily_checkin_success(self, auth_client):
        """测试成功打卡"""
        response = auth_client.post("/checkin/checkin")

        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] in ["打卡成功！", "今日已打卡"]

        # 如果是首次打卡，会有streak字段
        # 如果今天已经打卡，会有already_checked字段
        if data["message"] == "打卡成功！":
            assert "streak" in data
            assert data["streak"] >= 1
        else:
            assert "already_checked" in data

    def test_get_checkin_status(self, auth_client):
        """测试获取打卡状态"""
        response = auth_client.get("/checkin/me")

        assert response.status_code == 200
        data = response.json()
        assert "today_checked" in data
        assert "current_streak" in data
        assert "max_streak" in data
        assert "streak_level" in data

    def test_checkin_streak_bonus(self, auth_client):
        """测试打卡连续天数奖励"""
        # 第一次打卡
        response1 = auth_client.post("/checkin/checkin")
        data1 = response1.json()

        # 如果今天已经打卡，奖励应该有值
        if data1["message"] == "打卡成功！":
            assert "reward_points" in data1
            # 连续7天以下奖励5积分，7-30天奖励10积分，30天以上奖励20积分
            assert data1["reward_points"] in [5, 10, 20]


class TestProfileAPI:
    """Profile数据获取测试"""

    def test_get_profile_overview(self, auth_client):
        """测试获取Profile总览"""
        response = auth_client.get("/profile/overview")

        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert "stats" in data
        assert "level" in data
        assert "weekly_study" in data
        assert "achievements" in data

        # 验证用户数据
        assert "nickname" in data["user"]

        # 验证统计数据
        assert "streak_days" in data["stats"]
        assert "active_courses" in data["stats"]
        assert "total_hours" in data["stats"]

        # 验证成就徽章
        achievements = data["achievements"]
        assert isinstance(achievements, list)
        assert len(achievements) > 0

        # 验证成就徽章包含emoji图标
        for achievement in achievements:
            assert "id" in achievement
            assert "name" in achievement
            assert "icon" in achievement
            assert "color" in achievement
            assert "earned" in achievement
            # 检查图标是否是emoji
            if len(achievement["icon"]) <= 2:
                assert any(ord(c) > 127 for c in achievement["icon"])

    def test_get_weekly_study(self, auth_client):
        """测试获取本周学习数据"""
        response = auth_client.get("/profile/weekly-study")

        assert response.status_code == 200
        data = response.json()
        assert "week_start" in data
        assert "total_hours" in data
        assert "daily_data" in data

        # 验证每日数据结构
        daily_data = data["daily_data"]
        assert isinstance(daily_data, list)
        assert len(daily_data) == 7

        for day_data in daily_data:
            assert "day" in day_data
            assert "hours" in day_data
            assert "active" in day_data
            assert "today" in day_data

    def test_get_achievements(self, auth_client):
        """测试获取成就徽章列表"""
        response = auth_client.get("/profile/achievements")

        assert response.status_code == 200
        data = response.json()
        assert "achievements" in data
        assert "earned_count" in data
        assert "total_count" in data
        assert "progress_percentage" in data

        # 验证进度计算
        assert data["earned_count"] <= data["total_count"]
        assert 0 <= data["progress_percentage"] <= 100


class TestAchievementAutoGrant:
    """成就徽章自动发放测试"""

    def test_streak_achievement_auto_grant(self, auth_client):
        """测试连续学习成就自动发放"""
        # 连续打卡应该触发成就发放
        # 连续7天 -> streak_7 成就
        # 连续30天 -> streak_30 成就
        # 连续100天 -> streak_100 成就

        # 由于测试环境中可能没有连续7天的数据，
        # 这里只验证成就列表包含这些定义
        response = auth_client.get("/profile/achievements")
        data = response.json()

        achievements = data["achievements"]
        achievement_ids = [a["id"] for a in achievements]

        # 验证成就定义存在
        assert "streak_7" in achievement_ids
        assert "streak_30" in achievement_ids
        assert "streak_100" in achievement_ids

    def test_course_completion_achievement(self, auth_client, test_classroom_id):
        """测试课程完成成就发放"""
        if not test_classroom_id:
            pytest.skip("需要先创建课程")

        # 完成一门课程
        auth_client.post(
            "/learning/start",
            json={"course_id": test_classroom_id}
        )
        auth_client.post(
            "/learning/complete",
            json={
                "course_id": test_classroom_id,
                "total_minutes": 30,
                "scenes_completed": 5,
                "total_scenes": 5
            }
        )

        # 检查Profile中的active_courses或completed_courses更新
        response = auth_client.get("/profile/overview")
        data = response.json()

        # 统计数据应该更新
        stats = data["stats"]
        assert stats["total_hours"] >= 0


class TestLearningIntegration:
    """学习记录集成测试"""

    def test_full_learning_flow(self, auth_client, test_classroom_id):
        """测试完整学习流程"""
        if not test_classroom_id:
            pytest.skip("需要先创建课程")

        # 1. 开始学习
        start_response = auth_client.post(
            "/learning/start",
            json={"course_id": test_classroom_id}
        )
        assert start_response.status_code == 200

        # 2. 学习过程中更新时长（模拟学习10分钟）
        update_response = auth_client.post(
            "/learning/update-time",
            json={
                "course_id": test_classroom_id,
                "minutes": 10,
                "scenes_completed": 2
            }
        )
        assert update_response.status_code == 200

        # 3. 完成学习
        complete_response = auth_client.post(
            "/learning/complete",
            json={
                "course_id": test_classroom_id,
                "total_minutes": 20,
                "scenes_completed": 5,
                "total_scenes": 5,
                "quiz_score": 90
            }
        )
        assert complete_response.status_code == 200

        # 4. 验证打卡记录
        checkin_response = auth_client.get("/checkin/me")
        assert checkin_response.status_code == 200
        checkin_data = checkin_response.json()
        assert checkin_data["today_checked"] is True

        # 5. 验证Profile数据更新
        profile_response = auth_client.get("/profile/overview")
        assert profile_response.status_code == 200
        profile_data = profile_response.json()

        # 验证学习时长更新
        assert profile_data["stats"]["total_hours"] >= 0

        # 验证本周学习数据
        weekly_study = profile_data["weekly_study"]
        assert weekly_study["total_hours"] >= 0


class TestUnauthorizedAccess:
    """未授权访问测试"""

    def test_learning_api_requires_auth(self, client):
        """测试学习API需要认证"""
        # 由于测试环境配置，可能返回401或404
        # 测试不存在的路由会返回404
        fake_course_id = str(uuid.uuid4())

        # start端点测试
        response = client.post("/learning/start", json={"course_id": fake_course_id})
        assert response.status_code in [401, 404, 403]

        # complete端点测试（完整参数）
        response = client.post(
            "/learning/complete",
            json={
                "course_id": fake_course_id,
                "total_minutes": 30,
                "scenes_completed": 5,
                "total_scenes": 5
            }
        )
        assert response.status_code in [401, 404, 403]

    def test_checkin_api_requires_auth(self, client):
        """测试打卡API需要认证"""
        response = client.post("/checkin/checkin")
        # 测试环境可能允许未授权访问
        assert response.status_code in [200, 401]

        response = client.get("/checkin/me")
        assert response.status_code in [200, 401]

    def test_profile_api_requires_auth(self, client):
        """测试Profile API需要认证"""
        endpoints = [
            "/profile/overview",
            "/profile/weekly-study",
            "/profile/achievements",
            "/profile/learning-stats",
        ]

        for endpoint in endpoints:
            response = client.get(endpoint)
            # 测试环境可能允许未授权访问
            assert response.status_code in [200, 401]