"""
SSRF 安全验证 - 验证客户端传递的 URL
"""

import re
import logging
from typing import Optional
from urllib.parse import urlparse, unquote

logger = logging.getLogger(__name__)

# 禁止访问的内部 IP 和域名
BLOCKED_IP_PATTERNS = [
    r"^127\.",
    r"^10\.",
    r"^172\.16\.",
    r"^172\.17\.",
    r"^172\.18\.",
    r"^172\.19\.",
    r"^172\.20\.",
    r"^172\.21\.",
    r"^172\.22\.",
    r"^172\.23\.",
    r"^172\.24\.",
    r"^172\.25\.",
    r"^172\.26\.",
    r"^172\.27\.",
    r"^172\.28\.",
    r"^172\.29\.",
    r"^172\.30\.",
    r"^172\.31\.",
    r"^192\.168\.",
    r"^0\.0\.0\.0",
    r"^localhost",
    r"^::1",
    r"^fc00:",
    r"^fe80:",
    r"^::ffff:",  # IPv4-mapped IPv6 addresses bypass
]

BLOCKED_HOSTS = [
    "localhost",
    "localhost.localdomain",
    "127.0.0.1",
    "0.0.0.0",
    "[::1]",
    "internal",
    "intranet",
]


def validate_url_for_ssrf(url: str) -> Optional[str]:
    """
    验证 URL 是否存在 SSRF 风险

    Args:
        url: 要验证的 URL

    Returns:
        None if valid, error message if invalid
    """
    if not url:
        return None

    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)

        # 验证协议
        if parsed.scheme not in ["http", "https"]:
            return f"Invalid URL scheme: {parsed.scheme}. Only http and https are allowed."

        host = parsed.hostname or parsed.netloc.split(":")[0]

        # URL 解码 hostname（防止编码绕过）
        host = unquote(host)

        # 验证禁止的主机名
        for blocked_host in BLOCKED_HOSTS:
            if host.lower() == blocked_host.lower():
                return f"Access to internal host '{host}' is blocked for security reasons."

        # 验证禁止的 IP 段
        for pattern in BLOCKED_IP_PATTERNS:
            if re.match(pattern, host):
                return f"Access to internal IP '{host}' is blocked for security reasons."

        # 验证端口（禁止敏感端口）
        port = parsed.port
        if port:
            blocked_ports = [22, 23, 25, 53, 110, 143, 993, 995, 3306, 5432, 6379, 8080]
            if port in blocked_ports:
                return f"Access to port {port} is blocked for security reasons."

        return None

    except Exception as e:
        logger.warning(f"URL parsing error: {e}")
        return f"Invalid URL format: {url}"


def is_safe_url(url: str) -> bool:
    """
    检查 URL 是否安全

    Args:
        url: 要检查的 URL

    Returns:
        True if safe, False if potentially dangerous
    """
    return validate_url_for_ssrf(url) is None