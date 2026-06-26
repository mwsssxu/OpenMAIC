"""
支付宝集成服务 — H5 手机网站支付 (alipay.trade.wap.pay)

公钥模式 + AES 内容加密
APPID: 2021006168684071
依赖: python-alipay-sdk (pip install python-alipay-sdk)
文档: https://opendocs.alipay.com/open/02ivbs

配置 (config.py / .env):
    ALIPAY_APP_ID              应用 APPID
    ALIPAY_APP_PRIVATE_KEY     应用私钥（PKCS1/PKCS8，可含或不含 PEM 标记）
    ALIPAY_PUBLIC_KEY          支付宝公钥（可含或不含 PEM 标记）
    ALIPAY_AES_KEY             AES 内容加密密钥（base64 编码，16字节；为空则不加密）
    ALIPAY_GATEWAY             网关地址（生产/沙箱）
    ALIPAY_NOTIFY_URL          异步回调地址（公网可达）
    ALIPAY_RETURN_URL          同步跳转地址
    ALIPAY_SANDBOX             是否沙箱模式
"""

import base64
import json
import logging
from functools import lru_cache

from app.core.config import settings

logger = logging.getLogger(__name__)


def _normalize_key(key: str, is_private: bool = True) -> str:
    """将裸密钥文本规范化为合法 PEM 格式。

    环境变量中存储的密钥通常不含 BEGIN/END 标记（避免换行问题），
    pycryptodome 的 RSA.importKey 需要完整 PEM 格式才能解析。
    """
    key = key.strip()
    if "-----BEGIN" in key:
        return key  # 已有 PEM 标记

    body = "".join(key.split())
    lines = [body[i : i + 64] for i in range(0, len(body), 64)]

    if is_private:
        header = "-----" + "BEGIN PRIVATE KEY" + "-----"
        footer = "-----" + "END PRIVATE KEY" + "-----"
    else:
        header = "-----BEGIN PUBLIC KEY-----"
        footer = "-----END PUBLIC KEY-----"
    return f"{header}\n" + "\n".join(lines) + f"\n{footer}"


def _aes_encrypt(plaintext: str, aes_key_b64: str) -> str:
    """AES-128-CBC 加密（支付宝内容加密标准）。

    支付宝 AES 加密规范：
    - 算法: AES-128-CBC
    - IV: 16 字节全零
    - Padding: PKCS7
    - 输出: base64 编码
    """
    from Cryptodome.Cipher import AES
    from Cryptodome.Util.Padding import pad

    key = base64.b64decode(aes_key_b64)
    iv = b"\x00" * 16
    cipher = AES.new(key, AES.MODE_CBC, iv)
    encrypted = cipher.encrypt(pad(plaintext.encode("utf-8"), AES.block_size))
    return base64.b64encode(encrypted).decode("utf-8")


def _aes_decrypt(ciphertext_b64: str, aes_key_b64: str) -> str:
    """AES-128-CBC 解密（用于解析加密的 API 响应）。"""
    from Cryptodome.Cipher import AES
    from Cryptodome.Util.Padding import unpad

    key = base64.b64decode(aes_key_b64)
    iv = b"\x00" * 16
    cipher = AES.new(key, AES.MODE_CBC, iv)
    decrypted = unpad(cipher.decrypt(base64.b64decode(ciphertext_b64)), AES.block_size)
    return decrypted.decode("utf-8")


def is_alipay_configured() -> bool:
    """检查支付宝必要配置是否齐全（公钥模式）。"""
    return bool(
        settings.ALIPAY_APP_ID
        and settings.ALIPAY_APP_PRIVATE_KEY
        and settings.ALIPAY_PUBLIC_KEY
    )


@lru_cache(maxsize=1)
def get_alipay_client():
    """获取 AliPay 客户端单例（线程安全，配置不变时复用）。

    公钥模式：使用应用私钥签名 + 支付宝公钥验签。
    """
    if not is_alipay_configured():
        raise RuntimeError(
            "支付宝未配置: 需设置 ALIPAY_APP_ID / ALIPAY_APP_PRIVATE_KEY / ALIPAY_PUBLIC_KEY"
        )

    from alipay import AliPay

    client = AliPay(
        appid=settings.ALIPAY_APP_ID,
        app_notify_url=settings.ALIPAY_NOTIFY_URL or None,
        app_private_key_string=_normalize_key(settings.ALIPAY_APP_PRIVATE_KEY, is_private=True),
        alipay_public_key_string=_normalize_key(settings.ALIPAY_PUBLIC_KEY, is_private=False),
        sign_type="RSA2",
        debug=settings.ALIPAY_SANDBOX,
    )
    logger.info(
        f"[Alipay] 客户端已初始化 (appid={settings.ALIPAY_APP_ID}, "
        f"sandbox={settings.ALIPAY_SANDBOX}, mode=public_key, "
        f"aes={'on' if settings.ALIPAY_AES_KEY else 'off'})"
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

    若配置了 ALIPAY_AES_KEY，biz_content 会先 AES 加密再 RSA 签名。

    Args:
        out_trade_no: 商户订单号（对应 orders.id 的 hex，唯一）
        total_amount: 订单金额，字符串，单位元（如 "6.00"）
        subject: 订单标题

    Returns:
        已签名的支付页面完整 URL，前端用 WebBrowser 打开即可。
    """
    client = get_alipay_client()

    biz_content = {
        "subject": subject,
        "out_trade_no": out_trade_no,
        "total_amount": total_amount,
        "product_code": "QUICK_WAP_WAY",
    }
    biz_str = json.dumps(biz_content, ensure_ascii=False)

    # AES 内容加密（若配置了密钥）
    extra_kwargs = {}
    if settings.ALIPAY_AES_KEY:
        biz_str = _aes_encrypt(biz_str, settings.ALIPAY_AES_KEY)
        extra_kwargs["encrypt_type"] = "AES"

    data = client.build_body(
        "alipay.trade.wap.pay",
        biz_str,
        return_url=settings.ALIPAY_RETURN_URL or None,
        notify_url=settings.ALIPAY_NOTIFY_URL or None,
        **extra_kwargs,
    )
    signed_query = client.sign_data(data)
    url = f"{_get_gateway()}?{signed_query}"
    logger.info(f"[Alipay] wap.pay URL 已生成: out_trade_no={out_trade_no}, amount={total_amount}")
    return url


def verify_callback(params: dict) -> bool:
    """验证支付宝异步回调签名。

    异步通知不使用 AES 加密，仅需 RSA2 验签。

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

    data = {k: v for k, v in params.items() if k not in ("sign", "sign_type")}
    try:
        return client.verify(data, sign)
    except Exception as e:
        logger.error(f"[Alipay] 回调验签异常: {e}")
        return False
