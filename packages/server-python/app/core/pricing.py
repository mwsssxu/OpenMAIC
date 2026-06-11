"""
统一价格配置 — 避免在 payment.py / tokens.py / subscriptions.py 中重复定义
修改价格只需改此文件
"""

# ==================== Token 套餐 ====================

TOKEN_PACKAGES = {
    "starter": {"price": 600, "tokens": 50, "bonus": 0, "name": "体验包"},      # ¥6 = 50 Token
    "learning": {"price": 1800, "tokens": 180, "bonus": 20, "name": "学习包"},   # ¥18 = 200 Token
    "unlimited": {"price": 4800, "tokens": 500, "bonus": 100, "name": "畅学包"}, # ¥48 = 600 Token
}

# ==================== 订阅套餐 ====================

PLAN_PRICES = {
    "pro_monthly": {"price": 1900, "days": 30, "name": "Pro 月卡"},       # ¥19/月
    "pro_yearly": {"price": 19000, "days": 365, "name": "Pro 年卡"},      # ¥190/年（省¥38）
}

# payment.py 中的 SUBSCRIPTION_PACKAGES 与 PLAN_PRICES 同义
SUBSCRIPTION_PACKAGES = PLAN_PRICES

# ==================== Pro 订阅赠送 Token ====================

PRO_MONTHLY_TOKEN_GRANT = 50  # Pro 月赠送 50 Token
