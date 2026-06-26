"""
支付宝集成服务 — H5 手机网站支付 (alipay.trade.wap.pay)

公钥模式 + AES 接口内容加密（APPID: 2021006168684071）
SDK: alipay-sdk-python（支付宝官方 Python SDK）
文档: https://opendocs.alipay.com/open/02ivbs

配置 (config.py / .env):
    ALIPAY_APP_ID          — 支付宝应用 APPID
    ALIPAY_APP_PRIVATE_KEY — 应用私钥（去头去尾去回车，单行字符串）
    ALIPAY_PUBLIC_KEY      — 支付宝公钥（去头去尾去回车，单行字符串）
    ALIPAY_AES_KEY         — AES 内容加密密钥（base64 编码）
    ALIPAY_GATEWAY         — 网关地址（生产 https://openapi.alipay.com/gateway.do）
    ALIPAY_NOTIFY_URL      — 异步通知地址（公网可达 HTTPS）
    ALIPAY_RETURN_URL      — 同步跳转地址
    ALIPAY_SANDBOX         — 沙箱模式
"""

import base64
import logging
import re
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

_client: Any = None

# ---------------------------------------------------------------------------
# DEBT: 官方SDK (alipay-sdk-python) 存在两个兼容性问题：
#   1. AES 加密的 IV 传了 str('\0'*16) 而非 bytes，pycryptodome>=3.20 报 TypeError
#   2. RSA 签名用 rsa 库，不支持 PKCS8 格式私钥（我们的私钥是 PKCS8）
# monkey-patch 为 pycryptodome 实现，升级 SDK 版本后可移除。
# 在模块导入时执行，确保 verify_callback 也能用到 patched 版本。
# ---------------------------------------------------------------------------
_BLOCK_SIZE = 16

try:
    import alipay.aop.api.util.EncryptUtils as _enc
    import alipay.aop.api.util.SignatureUtils as _sig
    from Crypto.Cipher import AES as _AES
    from Crypto.PublicKey import RSA as _RSA
    from Crypto.Signature import PKCS1_v1_5 as _PKCS1
    from Crypto.Hash import SHA256 as _SHA256, SHA1 as _SHA1
    from Crypto.Util.Padding import pad as _pad, unpad as _unpad

    def _aes_encrypt(content, encrypt_key, charset):
        raw = content.encode(charset)
        padded = _pad(raw, _BLOCK_SIZE)
        iv = b"\x00" * _BLOCK_SIZE
        cipher = _AES.new(base64.b64decode(encrypt_key), _AES.MODE_CBC, iv)
        return base64.b64encode(cipher.encrypt(padded)).decode(charset)

    def _aes_decrypt(encrypted, encrypt_key, charset):
        iv = b"\x00" * _BLOCK_SIZE
        cipher = _AES.new(base64.b64decode(encrypt_key), _AES.MODE_CBC, iv)
        return _unpad(cipher.decrypt(base64.b64decode(encrypted)), _BLOCK_SIZE).decode(charset)

    def _import_key(key_str):
        """从 PEM 字符串或裸 base64 加载 RSA 密钥，兼容 PKCS1/PKCS8。"""
        if "-----BEGIN" in key_str:
            b64 = re.sub(r"-----[^-]+-----", "", key_str).replace("\n", "").replace("\r", "").strip()
            return _RSA.import_key(base64.b64decode(b64))
        # 裸 base64（SDK setter 不加 PEM 标记）
        return _RSA.import_key(base64.b64decode(key_str))

    def _sign_rsa2(private_key, sign_content, charset):
        key = _import_key(private_key)
        signer = _PKCS1.new(key)
        h = _SHA256.new(sign_content.encode(charset))
        return base64.b64encode(signer.sign(h)).decode(charset)

    def _sign_rsa(private_key, sign_content, charset):
        key = _import_key(private_key)
        signer = _PKCS1.new(key)
        h = _SHA1.new(sign_content.encode(charset))
        return base64.b64encode(signer.sign(h)).decode(charset)

    def _verify_rsa(public_key, message, sign):
        key = _import_key(public_key)
        signer = _PKCS1.new(key)
        if isinstance(sign, str):
            sign = sign.encode()
        if isinstance(message, str):
            message = message.encode()
        sign_bytes = base64.b64decode(sign)
        # SDK 的 verify_with_rsa 用于 RSA 和 RSA2 两种验签，
        # 原始实现用 rsa.verify() 自动检测哈希算法。
        # 这里先试 SHA256(RSA2)，再试 SHA1(RSA)，保持兼容。
        for hash_cls in (_SHA256, _SHA1):
            digest = hash_cls.new(message)
            if signer.verify(digest, sign_bytes):
                return True
        return False

    _enc.aes_encrypt_content = _aes_encrypt
    _enc.aes_decrypt_content = _aes_decrypt
    _sig.sign_with_rsa2 = _sign_rsa2
    _sig.sign_with_rsa = _sign_rsa
    _sig.verify_with_rsa = _verify_rsa
except ImportError:
    pass  # SDK 未安装（开发环境），实际调用时会报错


def _get_client() -> Any:
    """获取支付宝客户端（单例），AES 加密由 SDK 自动处理。"""
    global _client
    if _client is not None:
        return _client

    if not is_alipay_configured():
        raise RuntimeError("支付宝未配置，请检查 ALIPAY_APP_ID / ALIPAY_APP_PRIVATE_KEY / ALIPAY_PUBLIC_KEY")

    from alipay.aop.api.AlipayClientConfig import AlipayClientConfig
    from alipay.aop.api.DefaultAlipayClient import DefaultAlipayClient

    config = AlipayClientConfig(sandbox_debug=settings.ALIPAY_SANDBOX)
    config.server_url = settings.ALIPAY_GATEWAY
    config.app_id = settings.ALIPAY_APP_ID
    config.app_private_key = settings.ALIPAY_APP_PRIVATE_KEY
    config.alipay_public_key = settings.ALIPAY_PUBLIC_KEY
    config.sign_type = "RSA2"

    # AES 接口内容加密（SDK 自动加密 biz_content）
    if settings.ALIPAY_AES_KEY:
        config.encrypt_type = "AES"
        config.encrypt_key = settings.ALIPAY_AES_KEY

    _client = DefaultAlipayClient(config, logger)
    logger.info("[Alipay] 客户端初始化成功 (APPID=%s, AES=%s)", settings.ALIPAY_APP_ID, bool(settings.ALIPAY_AES_KEY))
    return _client


def is_alipay_configured() -> bool:
    """检查支付宝必填配置是否就绪。"""
    return bool(
        settings.ALIPAY_APP_ID
        and settings.ALIPAY_APP_PRIVATE_KEY
        and settings.ALIPAY_PUBLIC_KEY
    )


def create_wap_pay_url(
    out_trade_no: str,
    total_amount: str,
    subject: str,
    notify_url: str | None = None,
    return_url: str | None = None,
    **kwargs: Any,
) -> str:
    """
    生成手机网站支付跳转 URL（alipay.trade.wap.pay）。

    Args:
        out_trade_no: 商户订单号（唯一）
        total_amount: 订单金额（字符串，如 "0.01"）
        subject: 订单标题
        notify_url: 异步通知地址（覆盖默认）
        return_url: 同步跳转地址（覆盖默认）
        **kwargs: 额外业务参数（如 quit_url, time_expire 等）

    Returns:
        支付宝跳转 URL（GET 方式，直接用浏览器打开）
    """
    from alipay.aop.api.domain.AlipayTradeWapPayModel import AlipayTradeWapPayModel
    from alipay.aop.api.request.AlipayTradeWapPayRequest import AlipayTradeWapPayRequest

    client = _get_client()

    model = AlipayTradeWapPayModel()
    model.out_trade_no = out_trade_no
    model.total_amount = total_amount
    model.subject = subject
    model.product_code = "QUICK_WAP_PAY"

    # 额外业务参数
    for key, value in kwargs.items():
        if hasattr(model, key):
            setattr(model, key, value)

    request = AlipayTradeWapPayRequest(biz_model=model)
    request.notify_url = notify_url or settings.ALIPAY_NOTIFY_URL or None
    request.return_url = return_url or settings.ALIPAY_RETURN_URL or None

    # page_execute(GET) 返回完整跳转 URL
    pay_url = client.page_execute(request, http_method="GET")
    logger.info("[Alipay] 生成支付URL: out_trade_no=%s, amount=%s", out_trade_no, total_amount)
    return pay_url


def verify_callback(params: dict) -> bool:
    """
    验证支付宝异步通知签名（明文，不涉及 AES 解密）。

    Args:
        params: 支付宝 POST 过来的所有参数（form data → dict）

    Returns:
        True 签名验证通过，False 验证失败
    """
    from alipay.aop.api.util.SignatureUtils import verify_with_rsa

    sign = params.get("sign", "")
    sign_type = params.get("sign_type", "")

    if not sign:
        logger.warning("[Alipay] 回调缺少 sign 参数")
        return False

    # 按字典序拼接参数（排除 sign 和 sign_type）
    sorted_params = sorted((k, v) for k, v in params.items() if k not in ("sign", "sign_type"))
    raw_content = "&".join(f"{k}={v}" for k, v in sorted_params)

    try:
        result = verify_with_rsa(
            settings.ALIPAY_PUBLIC_KEY,
            raw_content,
            sign,
        )
        if not result:
            logger.warning("[Alipay] 回调验签失败")
        return bool(result)
    except Exception as e:
        logger.error("[Alipay] 回调验签异常: %s", e)
        return False
