"""
测试初始化模块
"""

import pytest
import asyncio

# 配置asyncio
@pytest.fixture(scope="session")
def event_loop():
    """创建事件循环"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()