"""
请求上下文 — 通过 contextvar 在请求生命周期内传递元信息（如 user_id），
让深层服务（llm.py、generator 等）无需逐层透传 user_id 也能正确归因。

设计原则：
- 仅由 auth 中间件（get_current_user / get_optional_user_id）写入；
- 业务代码只读不写；
- contextvar 在每个请求/任务的事件循环上下文中独立，跨任务自动隔离；
- 离开请求范围读到的就是 None，安全。
"""

from contextvars import ContextVar
from typing import Optional

# 当前请求的用户 ID（字符串形式的 UUID）
_current_user_id: ContextVar[Optional[str]] = ContextVar(
    "current_user_id", default=None
)


def set_current_user_id(user_id: Optional[str]) -> None:
    """由 auth 依赖注入设置；其它代码不要调用。"""
    _current_user_id.set(user_id)


def get_current_user_id_from_ctx() -> Optional[str]:
    """供 llm.py 等基础设施读取当前请求的 user_id。"""
    return _current_user_id.get()
