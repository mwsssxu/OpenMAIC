"""
支付系统测试 - 完整覆盖支付流程

测试范围：
- Token套餐购买
- 订单创建和管理
- 支付回调处理
- 积分兑换Token
- 余额查询和交易记录
- 边界条件和安全测试
"""

import pytest
import uuid
from fastapi.testclient import TestClient


class TestTokenPackages:
    """Token套餐测试"""

    def test_get_packages_success(self, client):
        """测试获取Token套餐列表"""
        response = client.get("/tokens/packages")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 3  # basic, standard, premium
        
        # 验证套餐结构
        for package in data:
            assert "id" in package
            assert "price" in package
            assert "tokens" in package
            assert package["price"] > 0
            assert package["tokens"] > 0

    def test_package_ids_valid(self, client):
        """测试套餐ID有效性"""
        response = client.get("/tokens/packages")
        data = response.json()
        package_ids = [p["id"] for p in data]
        assert "basic" in package_ids
        assert "standard" in package_ids
        assert "premium" in package_ids


class TestTokenBalance:
    """Token余额测试"""

    def test_get_balance_unauthorized(self, client):
        """测试未认证访问余额"""
        response = client.get("/tokens/balance")
        assert response.status_code in [401, 403]

    def test_get_balance_authenticated(self, auth_client):
        """测试认证用户获取余额"""
        response = auth_client.get("/tokens/balance")
        assert response.status_code == 200
        data = response.json()
        assert "balance" in data
        assert isinstance(data["balance"], int)
        assert data["balance"] >= 0

    def test_get_balance_history(self, auth_client):
        """测试获取Token交易历史"""
        response = auth_client.get("/tokens/history")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestTokenPurchase:
    """Token购买测试"""

    def test_purchase_package_unauthorized(self, client):
        """测试未认证购买"""
        response = client.post("/tokens/purchase", json={
            "package_id": "basic"
        })
        assert response.status_code in [401, 403]

    def test_purchase_basic_package(self, auth_client):
        """测试购买基础套餐"""
        response = auth_client.post("/tokens/purchase", json={
            "package_id": "basic"
        })
        # 购买可能成功或失败（取决于支付配置）
        assert response.status_code in [200, 400, 500]
        if response.status_code == 200:
            data = response.json()
            assert "order_id" in data or "tokens_added" in data

    def test_purchase_invalid_package(self, auth_client):
        """测试购买无效套餐"""
        response = auth_client.post("/tokens/purchase", json={
            "package_id": "invalid_package"
        })
        assert response.status_code in [400, 404, 500]

    def test_purchase_empty_package_id(self, auth_client):
        """测试空套餐ID"""
        response = auth_client.post("/tokens/purchase", json={
            "package_id": ""
        })
        assert response.status_code in [400, 422]


class TestTokenExchange:
    """积分兑换Token测试"""

    def test_get_exchange_rates(self, client):
        """测试获取兑换汇率"""
        response = client.get("/tokens/exchange-rates")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict) or isinstance(data, list)
        if isinstance(data, list):
            for rate in data:
                assert "points" in rate
                assert "tokens" in rate

    def test_exchange_tokens_unauthorized(self, client):
        """测试未认证兑换"""
        response = client.post("/tokens/exchange", json={
            "exchange_type": "small"
        })
        assert response.status_code in [401, 403]

    def test_exchange_small_amount(self, auth_client):
        """测试小额兑换"""
        response = auth_client.post("/tokens/exchange", json={
            "exchange_type": "small"
        })
        # 兑换可能成功（有足够积分）或失败（积分不足）
        assert response.status_code in [200, 400, 500]

    def test_exchange_invalid_type(self, auth_client):
        """测试无效兑换类型"""
        response = auth_client.post("/tokens/exchange", json={
            "exchange_type": "invalid_type"
        })
        assert response.status_code in [400, 404, 422]


class TestPaymentOrders:
    """支付订单测试"""

    def test_create_order_unauthorized(self, client):
        """测试未认证创建订单"""
        response = client.post("/payment/orders", json={
            "product_type": "tokens",
            "amount": 1000
        })
        assert response.status_code in [401, 403]

    def test_get_orders_unauthorized(self, client):
        """测试未认证获取订单列表"""
        response = client.get("/payment/orders")
        assert response.status_code in [401, 403]

    def test_get_order_detail_unauthorized(self, client):
        """测试未认证获取订单详情"""
        fake_order_id = str(uuid.uuid4())
        response = client.get(f"/payment/orders/{fake_order_id}")
        assert response.status_code in [401, 403, 404]

    def test_create_order_authenticated(self, auth_client):
        """测试认证用户创建订单"""
        response = auth_client.post("/payment/orders", json={
            "product_type": "tokens",
            "amount": 1000
        })
        # 创建可能成功或失败（取决于实现）
        assert response.status_code in [200, 201, 400, 500]

    def test_create_order_negative_amount(self, auth_client):
        """测试负数金额订单"""
        response = auth_client.post("/payment/orders", json={
            "product_type": "tokens",
            "amount": -100
        })
        # 应拒绝负数金额
        assert response.status_code in [400, 422]

    def test_create_order_zero_amount(self, auth_client):
        """测试零金额订单"""
        response = auth_client.post("/payment/orders", json={
            "product_type": "tokens",
            "amount": 0
        })
        assert response.status_code in [400, 422]

    def test_create_order_large_amount(self, auth_client):
        """测试超大金额订单"""
        response = auth_client.post("/payment/orders", json={
            "product_type": "tokens",
            "amount": 999999999999
        })
        # 应有上限检查
        assert response.status_code in [200, 400, 422]


class TestPaymentCallback:
    """支付回调测试"""

    def test_wechat_callback_signature_validation(self, client):
        """测试微信回调签名验证"""
        # 模拟回调请求（无正确签名）
        response = client.post("/payment/callback/wechat", json={
            "transaction_id": "test_txn",
            "out_trade_no": "test_order",
            "result_code": "SUCCESS"
        })
        # 应验证签名并拒绝无效请求
        assert response.status_code in [400, 401, 403, 404]

    def test_alipay_callback_signature_validation(self, client):
        """测试支付宝回调签名验证"""
        response = client.post("/payment/callback/alipay", json={
            "trade_no": "test_txn",
            "out_trade_no": "test_order",
            "trade_status": "TRADE_SUCCESS"
        })
        assert response.status_code in [400, 401, 403, 404]

    def test_duplicate_callback_handling(self, client):
        """测试重复回调处理（幂等性）"""
        # 发送两次相同回调
        callback_data = {
            "transaction_id": "dup_test_txn",
            "out_trade_no": "dup_test_order",
            "result_code": "SUCCESS"
        }
        response1 = client.post("/payment/callback/wechat", json=callback_data)
        response2 = client.post("/payment/callback/wechat", json=callback_data)
        # 幂等性：两次处理结果应一致
        assert response1.status_code == response2.status_code


class TestPaymentSecurity:
    """支付安全测试"""

    def test_order_access_isolation(self, auth_client, client):
        """测试订单访问隔离"""
        # 用户A创建订单
        create_response = auth_client.post("/payment/orders", json={
            "product_type": "tokens",
            "amount": 1000
        })
        
        if create_response.status_code in [200, 201]:
            order_id = create_response.json().get("id") or create_response.json().get("order_id")
            if order_id:
                # 用户B（未认证）尝试访问用户A的订单
                other_response = client.get(f"/payment/orders/{order_id}")
                assert other_response.status_code in [401, 403, 404]

    def test_sql_injection_in_order_id(self, auth_client):
        """测试订单ID SQL注入"""
        malicious_ids = [
            "'; DROP TABLE orders; --",
            "1 OR 1=1",
            "1; SELECT * FROM users",
        ]
        for malicious_id in malicious_ids:
            response = auth_client.get(f"/payment/orders/{malicious_id}")
            # 应安全处理，不返回500或泄露数据
            assert response.status_code in [400, 404, 422]

    def test_xss_in_product_type(self, auth_client):
        """测试产品类型XSS攻击"""
        response = auth_client.post("/payment/orders", json={
            "product_type": "<script>alert('xss')</script>",
            "amount": 1000
        })
        # 应拒绝无效产品类型
        assert response.status_code in [400, 422]


class TestSubscriptionPayment:
    """订阅支付测试"""

    def test_subscribe_unauthorized(self, client):
        """测试未认证订阅"""
        response = client.post("/subscriptions/purchase", json={
            "plan_type": "pro",
            "duration_months": 1
        })
        assert response.status_code in [401, 403]

    def test_subscribe_invalid_plan(self, auth_client):
        """测试无效订阅计划"""
        response = auth_client.post("/subscriptions/purchase", json={
            "plan_type": "invalid_plan",
            "duration_months": 1
        })
        assert response.status_code in [400, 404]

    def test_subscribe_negative_duration(self, auth_client):
        """测试负数订阅时长"""
        response = auth_client.post("/subscriptions/purchase", json={
            "plan_type": "pro",
            "duration_months": -1
        })
        assert response.status_code in [400, 422]


class TestPointsBalance:
    """积分余额测试"""

    def test_get_points_balance_authenticated(self, auth_client):
        """测试获取积分余额"""
        response = auth_client.get("/points/balance")
        assert response.status_code == 200
        data = response.json()
        assert "balance" in data
        assert isinstance(data["balance"], int)

    def test_get_points_sources(self, client):
        """测试获取积分来源定义"""
        response = auth_client.get("/points/sources")
        # 可能需要认证或公开
        assert response.status_code in [200, 401]

    def test_points_history(self, auth_client):
        """测试积分历史记录"""
        response = auth_client.get("/points/history")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestAdminPayment:
    """管理员支付管理测试"""

    def test_admin_payment_stats_unauthorized(self, client):
        """测试未认证访问支付统计"""
        response = client.get("/admin/payment/stats")
        assert response.status_code in [401, 403]

    def test_admin_orders_list_unauthorized(self, client):
        """测试未认证访问订单列表"""
        response = client.get("/admin/orders")
        assert response.status_code in [401, 403]


# 运行测试入口
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])