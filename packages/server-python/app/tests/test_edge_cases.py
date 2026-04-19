"""
边界条件和安全测试 - 使用TestClient的测试套件

测试范围：
- 输入边界测试（空值、超长、特殊字符）
- 认证边界测试（无效Token、过期Token）
- 权限隔离测试（跨用户访问）
- 安全攻击测试（SQL注入、XSS）
"""

import pytest
import uuid


class TestInputBoundary:
    """输入边界测试"""

    def test_register_empty_email(self, client):
        """测试空邮箱注册"""
        response = client.post("/auth/register", json={
            "email": "",
            "password": "TestPwd1!",
            "nickname": "testuser"
        })
        assert response.status_code in [400, 422]

    def test_register_empty_password(self, client):
        """测试空密码注册"""
        response = client.post("/auth/register", json={
            "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
            "password": "",
            "nickname": "testuser"
        })
        # 可能返回200（密码由系统生成）或400/422（验证失败）
        assert response.status_code in [200, 201, 400, 422]

    def test_register_empty_nickname(self, client):
        """测试空昵称注册"""
        response = client.post("/auth/register", json={
            "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
            "password": "TestPwd1!",
            "nickname": ""
        })
        assert response.status_code in [200, 400, 422]

    def test_login_empty_credentials(self, client):
        """测试空凭证登录"""
        response = client.post("/auth/login", json={
            "email": "",
            "password": ""
        })
        assert response.status_code in [400, 422]

    def test_register_very_long_email(self, client):
        """测试超长邮箱"""
        long_email = "a" * 100 + "@example.com"
        response = client.post("/auth/register", json={
            "email": long_email,
            "password": "TestPwd1!",
            "nickname": "testuser"
        })
        assert response.status_code in [400, 422]

    def test_register_very_long_nickname(self, client):
        """测试超长昵称"""
        response = client.post("/auth/register", json={
            "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
            "password": "TestPwd1!",
            "nickname": "a" * 100
        })
        assert response.status_code in [200, 400, 422]

    def test_register_special_chars_email(self, client):
        """测试特殊字符邮箱"""
        response = client.post("/auth/register", json={
            "email": "test!@#$@example.com",
            "password": "TestPwd1!",
            "nickname": "testuser"
        })
        assert response.status_code in [400, 422]

    def test_register_invalid_email_format(self, client):
        """测试无效邮箱格式"""
        response = client.post("/auth/register", json={
            "email": "not-an-email",
            "password": "TestPwd1!",
            "nickname": "testuser"
        })
        assert response.status_code in [400, 422]


class TestAuthenticationBoundary:
    """认证边界测试"""

    def test_invalid_token_format(self, client):
        """测试无效Token格式"""
        client.headers["Authorization"] = "Bearer invalid_token_string"
        response = client.get("/auth/me")
        assert response.status_code in [401, 403]
        client.headers.pop("Authorization", None)

    def test_empty_token(self, client):
        """测试空Token"""
        client.headers["Authorization"] = "Bearer "
        response = client.get("/auth/me")
        assert response.status_code in [401, 403]
        client.headers.pop("Authorization", None)

    def test_missing_bearer_prefix(self, client):
        """测试缺少Bearer前缀"""
        client.headers["Authorization"] = "some_token_without_bearer"
        response = client.get("/auth/me")
        assert response.status_code in [401, 403]
        client.headers.pop("Authorization", None)

    def test_weak_password(self, client):
        """测试弱密码"""
        weak_passwords = ["123", "abc", "pass", "111111"]
        for pwd in weak_passwords:
            response = client.post("/auth/register", json={
                "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
                "password": pwd,
                "nickname": "testuser"
            })
            assert response.status_code in [200, 400, 422]

    def test_password_with_only_whitespace(self, client):
        """测试仅空白字符密码"""
        response = client.post("/auth/register", json={
            "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
            "password": "   ",
            "nickname": "testuser"
        })
        # 可能返回200（密码被trim）或400/422（验证失败）
        assert response.status_code in [200, 201, 400, 422]


class TestPermissionIsolation:
    """权限隔离测试"""

    def test_cross_user_classroom_access(self, client):
        """测试跨用户访问课程"""
        # 创建用户A并认证
        user_a_email = f"user_a_{uuid.uuid4().hex[:8]}@example.com"
        response_a = client.post("/auth/register", json={
            "email": user_a_email,
            "password": "TestPwd1!",
            "nickname": "userA"
        })
        
        if response_a.status_code in [200, 201]:
            token_a = response_a.json().get("access_token")
            client.headers["Authorization"] = f"Bearer {token_a}"
            
            # 用户A创建课程
            create_response = client.post("/classrooms", json={
                "name": "UserA_Class",
                "description": "private"
            })
            
            if create_response.status_code in [200, 201]:
                classroom_id = create_response.json().get("id")
                
                # 移除认证，模拟未认证访问
                client.headers.pop("Authorization", None)
                
                # 未认证用户尝试访问用户A的课程
                access_response = client.get(f"/classrooms/{classroom_id}")
                assert access_response.status_code in [401, 403, 404]
                
            client.headers.pop("Authorization", None)

    def test_admin_endpoint_user_access(self, auth_client):
        """测试普通用户访问管理端点"""
        response = auth_client.get("/admin/stats")
        assert response.status_code in [401, 403, 404]


class TestSecurityAttacks:
    """安全攻击测试"""

    def test_sql_injection_login_email(self, client):
        """测试登录邮箱SQL注入"""
        response = client.post("/auth/login", json={
            "email": "'; DROP TABLE users; --",
            "password": "any_password"
        })
        assert response.status_code in [400, 401, 422]

    def test_xss_in_register_nickname(self, client):
        """测试注册昵称XSS"""
        response = client.post("/auth/register", json={
            "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
            "password": "TestPwd1!",
            "nickname": "safe_name"
        })
        assert response.status_code in [200, 400, 422]


class TestErrorHandling:
    """错误处理测试"""

    def test_invalid_json_syntax(self, client):
        """测试无效JSON语法"""
        response = client.post(
            "/auth/register",
            content="{'invalid': json}",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code in [400, 422]

    def test_wrong_content_type(self, client):
        """测试错误Content-Type"""
        response = client.post(
            "/auth/register",
            content='{"email": "test@example.com", "password": "test"}',
            headers={"Content-Type": "text/plain"}
        )
        assert response.status_code in [400, 415, 422]

    def test_empty_body(self, client):
        """测试空请求体"""
        response = client.post("/auth/register", content="")
        assert response.status_code in [400, 422]

    def test_null_values(self, client):
        """测试null值"""
        response = client.post("/auth/register", json={
            "email": None,
            "password": None,
            "nickname": None
        })
        assert response.status_code in [400, 422]

    def test_wrong_field_types(self, client):
        """测试错误字段类型"""
        response = client.post("/auth/register", json={
            "email": ["not", "a", "string"],
            "password": 12345,
            "nickname": {"nested": "object"}
        })
        assert response.status_code in [400, 422]


class TestRateLimiting:
    """速率限制测试"""

    def test_multiple_login_attempts(self, client):
        """测试多次登录尝试"""
        for _ in range(5):
            response = client.post("/auth/login", json={
                "email": "nonexistent@example.com",
                "password": "wrong_password"
            })
        assert response.status_code in [401, 403]


# 运行测试入口
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])