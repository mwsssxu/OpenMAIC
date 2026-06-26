"""
支付宝集成服务 — H5 手机网站支付 (alipay.trade.wap.pay)

证书模式（APPID: 2021006168684071）
依赖: python-alipay-sdk (pip install python-alipay-sdk)
文档: https://opendocs.alipay.com/open/02ivbs

配置 (config.py / .env):
    ALIPAY_APP_ID              应用 APPID
    ALIPAY_APP_PRIVATE_KEY     应用私钥（PKCS1/PKCS8，可含或不含 PEM 标记）
    ALIPAY_APP_CERT_PATH       应用公钥证书路径（.crt 文件）
    ALIPAY_PUBLIC_CERT_PATH    支付宝公钥证书路径（.crt 文件）
    ALIPAY_ROOT_CERT_PATH      支付宝根证书路径（.crt 文件）
    ALIPAY_GATEWAY             网关地址（生产/沙箱）
    ALIPAY_NOTIFY_URL          异步回调地址（公网可达）
    ALIPAY_RETURN_URL          同步跳转地址
    ALIPAY_SANDBOX             是否沙箱模式
"""

import logging
from functools import lru_cache
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)


def _normalize_private_key(key: str) -> str:
    """将裸私钥文本规范化为合法 PEM 格式。

    环境变量中存储的密钥通常不含 BEGIN/END 标记（避免换行问题），
    pycryptodome 的 RSA.importKey 需要完整 PEM 格式才能解析。
    """
    key = key.strip()
    if "-----BEGIN" in key:
        return key  # 已有 PEM 标记

    # 去除所有空白和换行，按 64 字符宽度重组
    body = "".join(key.split())
    lines = [body[i : i + 64] for i in range(0, len(body), 64)]

    # PKCS8 格式（支付宝密钥工具默认生成）
    header = "-----" + "BEGIN PRIVATE KEY" + "-----"
    footer = "-----" + "END PRIVATE KEY" + "-----"
    return f"{header}\n" + "\n".join(lines) + f"\n{footer}"


def _read_cert(path: str) -> str:
    """读取证书文件内容。"""
    return Path(path).read_text(encoding="utf-8")


def is_alipay_configured() -> bool:
    """检查支付宝必要配置是否齐全（证书模式）。"""
    return bool(
        settings.ALIPAY_APP_ID
        and settings.ALIPAY_APP_PRIVATE_KEY
        and settings.ALIPAY_APP_CERT_PATH
        and settings.ALIPAY_PUBLIC_CERT_PATH
        and settings.ALIPAY_ROOT_CERT_PATH
    )


@lru_cache(maxsize=1)
def get_alipay_client():
    """获取 AliPay 客户端单例（线程安全，配置不变时复用）。

    证书模式：使用三件套证书（应用公钥证书 + 支付宝公钥证书 + 支付宝根证书）。
    """
    if not is_alipay_configured():
        raise RuntimeError(
            "支付宝未配置: 需设置 ALIPAY_APP_ID / ALIPAY_APP_PRIVATE_KEY / "
            "ALIPAY_APP_CERT_PATH / ALIPAY_PUBLIC_CERT_PATH / ALIPAY_ROOT_CERT_PATH"
        )

    from alipay import DCAliPay

    client = DCAliPay(
        appid=settings.ALIPAY_APP_ID,
        app_private_key_string=_normalize_private_key(settings.ALIPAY_APP_PRIVATE_KEY),
        app_public_key_cert_string=_read_cert(settings.ALIPAY_APP_CERT_PATH),
        alipay_public_key_cert_string=_read_cert(settings.ALIPAY_PUBLIC_CERT_PATH),
        alipay_root_cert_string=_read_cert(settings.ALIPAY_ROOT_CERT_PATH),
        app_notify_url=settings.ALIPAY_NOTIFY_URL or None,
        sign_type="RSA2",
        debug=settings.ALIPAY_SANDBOX,
    )
    logger.info(
        f"[Alipay] 客户端已初始化 (appid={settings.ALIPAY_APP_ID}, "
        f"sandbox={settings.ALIPAY_SANDBOX}, mode=certificate)"
    )
    return client


def _get_gateway() -> str:
    """获取支付网关 URL — 沙箱模式自动使用沙箱网关。"""
    if settings.ALIPAY_SANDBOX:
        return "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
    return settings.ALIPAY_GATEWAY


def create_wap_pay_url(
    out_trade_no: str,
    total_amount: str,
    subject: str,
) -> str:
    """生成 alipay.trade.wap.pay 支付页面完整 URL（已签名）。

    Args:
        out_trade_no: 商户订单号（对应 orders.id 的 hex，唯一）
        total_amount: 订单金额，字符串，单位元（如 "6.00"）
        subject: 订单标题

    Returns:
        已签名的支付页面完整 URL，前端用 WebBrowser 打开即可。
    """
    client = get_alipay_client()
    # SDK 返回签名后的查询字符串（不含网关前缀）
    signed_query = client.api_alipay_trade_wap_pay(
        subject=subject,
        out_trade_no=out_trade_no,
        total_amount=total_amount,
        return_url=settings.ALIPAY_RETURN_URL or None,
        notify_url=settings.ALIPAY_NOTIFY_URL or None,
    )
    url = f"{_get_gateway()}?{signed_query}"
    logger.info(f"[Alipay] wap.pay URL 已生成: out_trade_no={out_trade_no}, amount={total_amount}")
    return url


def verify_callback(params: dict) -> bool:
    """验证支付宝异步回调签名。

    Args:
        params: 回调 POST form 数据（dict）

    Returns:
        True=签名合法，False=伪造或篡改
    """
    if not is_alipay_configured():
        logger.warning("[Alipay] 回调验签跳过——未配置支付宝密钥")
        return False

    client = get_alipay_client()
    sign = params.get("sign", "")

    # python-alipay-sdk 的 verify 需要剔除 sign 和 sign_type 后的数据
    data = {k: v for k, v in params.items() if k not in ("sign", "sign_type")}
    try:
        return client.verify(data, sign)
    except Exception as e:
        logger.error(f"[Alipay] 回调验签异常: {e}")
        return False
