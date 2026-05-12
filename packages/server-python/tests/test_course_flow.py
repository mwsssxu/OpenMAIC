"""
课程创建流程测试脚本

测试各个阶段：
1. 用户认证（获取token）
2. 大纲生成（SSE流式）
3. 智能体生成
4. 课程创建（create-full）
5. 场景创建（单个场景）
6. 后台场景批量创建

使用方法：
    python tests/test_course_flow.py --stage all           # 测试所有阶段
    python tests/test_course_flow.py --stage auth          # 只测试认证
    python tests/test_course_flow.py --stage outlines      # 只测试大纲生成
    python tests/test_course_flow.py --stage agents        # 只测试智能体生成
    python tests/test_course_flow.py --stage classroom     # 只测试课程创建
    python tests/test_course_flow.py --stage scenes        # 只测试场景创建
    python tests/test_course_flow.py --stage background    # 只测试后台批量创建
"""

import asyncio
import argparse
import json
import logging
import sys
import time
import uuid
from typing import Dict, Any, List, Optional

import aiohttp

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# API配置
API_BASE_URL = "http://localhost:8000"

# 测试用户配置（需要提前在数据库中创建）
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "test123456"


class CourseFlowTester:
    """课程创建流程测试器"""

    def __init__(self):
        self.token: Optional[str] = None
        self.user_id: Optional[str] = None
        self.classroom_id: Optional[str] = None
        self.outlines: List[Dict[str, Any]] = []
        self.agents: List[Dict[str, Any]] = []
        self.session: Optional[aiohttp.ClientSession] = None

    async def init_session(self):
        """初始化HTTP session"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=300)
            )

    async def close_session(self):
        """关闭HTTP session"""
        if self.session and not self.session.closed:
            await self.session.close()

    # ==================== Stage 1: 认证 ====================

    async def test_auth(self) -> bool:
        """测试用户认证"""
        logger.info("\n" + "="*50)
        logger.info("Stage 1: 用户认证测试")
        logger.info("="*50)

        await self.init_session()

        # 尝试登录
        try:
            async with self.session.post(
                f"{API_BASE_URL}/auth/login",
                json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    self.token = data.get("access_token")
                    self.user_id = data.get("user_id")
                    logger.info(f"✓ 登录成功 - user_id: {self.user_id}")
                    logger.info(f"  Token: {self.token[:20]}...")
                    return True
                elif resp.status == 401:
                    logger.warning("✗ 登录失败：用户不存在，尝试注册...")
                    # 尝试注册
                    async with self.session.post(
                        f"{API_BASE_URL}/auth/register",
                        json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD, "nickname": "测试用户"}
                    ) as reg_resp:
                        if reg_resp.status == 200:
                            reg_data = await reg_resp.json()
                            self.token = reg_data.get("access_token")
                            self.user_id = reg_data.get("user_id")
                            logger.info(f"✓ 注册成功 - user_id: {self.user_id}")
                            return True
                        else:
                            error = await reg_resp.text()
                            logger.error(f"✗ 注册失败: {error}")
                            return False
                else:
                    error = await resp.text()
                    logger.error(f"✗ 登录失败: {error}")
                    return False
        except Exception as e:
            logger.error(f"✗ 认证异常: {e}")
            return False

    # ==================== Stage 2: 大纲生成 ====================

    async def test_outlines(self) -> bool:
        """测试大纲生成（SSE流式）"""
        logger.info("\n" + "="*50)
        logger.info("Stage 2: 大纲生成测试（SSE流式）")
        logger.info("="*50)

        if not self.token:
            logger.error("✗ 需要先完成认证")
            return False

        requirement = "为初中生创建一个关于光合作用的生物课程，包含基本概念讲解、实验演示和知识检测"
        language = "zh-CN"

        logger.info(f"需求: {requirement}")
        logger.info(f"语言: {language}")

        start_time = time.time()
        outlines = []

        try:
            # SSE流式生成
            url = f"{API_BASE_URL}/generate/outlines-stream"
            headers = {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
            }
            payload = {
                "requirement": requirement,
                "language": language,
                "total_count": 5,
            }

            async with self.session.post(url, headers=headers, json=payload) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    logger.error(f"✗ 大纲生成失败: {resp.status} - {error}")
                    return False

                # 解析SSE流
                current_event = ""
                async for line in resp.content:
                    line_str = line.decode('utf-8').strip()
                    if not line_str:
                        continue

                    if line_str.startswith("event:"):
                        current_event = line_str[6:].strip()
                    elif line_str.startswith("data:"):
                        data_str = line_str[5:].strip()
                        if not data_str:
                            continue

                        try:
                            data = json.loads(data_str)
                            if current_event == "outline":
                                outlines.append(data)
                                logger.info(f"  ✓ 大纲 #{len(outlines)}: {data.get('title')}")
                            elif current_event == "done":
                                elapsed = time.time() - start_time
                                logger.info(f"✓ 大纲生成完成 - 共 {data.get('count', len(outlines))} 个")
                                logger.info(f"  耗时: {elapsed:.1f}s")
                            elif current_event == "error":
                                logger.error(f"✗ 生成错误: {data.get('error')}")
                                return False
                        except json.JSONDecodeError:
                            continue

            self.outlines = outlines
            return len(outlines) > 0

        except Exception as e:
            logger.error(f"✗ 大纲生成异常: {e}")
            return False

    # ==================== Stage 3: 智能体生成 ====================

    async def test_agents(self) -> bool:
        """测试智能体生成"""
        logger.info("\n" + "="*50)
        logger.info("Stage 3: 智能体生成测试")
        logger.info("="*50)

        if not self.token:
            logger.error("✗ 需要先完成认证")
            return False

        if not self.outlines:
            logger.warning("⚠ 没有大纲数据，使用默认大纲")
            self.outlines = [
                {"id": "1", "type": "slide", "title": "课程介绍", "description": "介绍课程主题", "key_points": ["主题概述", "学习目标"], "order": 1},
                {"id": "2", "type": "slide", "title": "核心内容", "description": "讲解核心知识", "key_points": ["概念定义", "原理说明"], "order": 2},
                {"id": "3", "type": "quiz", "title": "知识检测", "description": "检验学习效果", "key_points": ["基础题目", "进阶题目"], "order": 3},
            ]

        start_time = time.time()

        try:
            url = f"{API_BASE_URL}/generate/agent-profiles"
            headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
            payload = {
                "stageInfo": {"name": "光合作用课程", "description": "为初中生创建的生物课程"},
                "language": "zh-CN",
                "sceneOutlines": self.outlines,
                "availableAvatars": [
                    "/avatars/teacher.png",
                    "/avatars/assistant.png",
                    "/avatars/student1.png",
                    "/avatars/student2.png",
                ],
            }

            async with self.session.post(url, headers=headers, json=payload) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    logger.error(f"✗ 智能体生成失败: {resp.status} - {error}")
                    return False

                data = await resp.json()
                agents = data.get("agents", [])
                elapsed = time.time() - start_time

                logger.info(f"✓ 智能体生成完成 - 共 {len(agents)} 个")
                logger.info(f"  耗时: {elapsed:.1f}s")
                for agent in agents:
                    logger.info(f"    - {agent.get('name')} ({agent.get('role')}): {agent.get('persona', '')[:30]}...")

                self.agents = agents
                return len(agents) > 0

        except Exception as e:
            logger.error(f"✗ 智能体生成异常: {e}")
            return False

    # ==================== Stage 4: 课程创建 ====================

    async def test_classroom_create(self) -> bool:
        """测试课程创建（create-full）"""
        logger.info("\n" + "="*50)
        logger.info("Stage 4: 课程创建测试")
        logger.info("="*50)

        if not self.token:
            logger.error("✗ 需要先完成认证")
            return False

        if not self.outlines:
            logger.warning("⚠ 没有大纲数据，使用默认大纲")
            self.outlines = [
                {"id": "1", "type": "slide", "title": "课程介绍", "description": "介绍课程主题", "key_points": ["主题概述"], "order": 1},
                {"id": "2", "type": "slide", "title": "核心内容", "description": "讲解核心知识", "key_points": ["概念定义"], "order": 2},
            ]

        start_time = time.time()

        try:
            url = f"{API_BASE_URL}/classrooms/create-full"
            headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

            # 清理agent配置（移除UI状态属性）
            clean_agents = []
            for a in self.agents[:5]:  # 最多5个
                clean_agents.append({
                    "id": a.get("id"),
                    "name": a.get("name"),
                    "role": a.get("role"),
                    "color": a.get("color"),
                    "persona": a.get("persona"),
                })

            payload = {
                "name": "测试课程-" + str(uuid.uuid4())[:8],
                "description": "自动化测试创建的课程",
                "language": "zh-CN",
                "agent_ids": [a.get("id") for a in clean_agents],
                "agent_configs": clean_agents,
                "outlines": self.outlines,
            }

            async with self.session.post(url, headers=headers, json=payload) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    logger.error(f"✗ 课程创建失败: {resp.status} - {error}")
                    return False

                data = await resp.json()
                elapsed = time.time() - start_time

                self.classroom_id = data.get("id")
                logger.info(f"✓ 课程创建成功")
                logger.info(f"  课程ID: {self.classroom_id}")
                logger.info(f"  大纲数量: {data.get('outlines_count')}")
                logger.info(f"  耗时: {elapsed:.1f}s")

                return True

        except Exception as e:
            logger.error(f"✗ 课程创建异常: {e}")
            return False

    # ==================== Stage 5: 单个场景创建 ====================

    async def test_scene_create(self) -> bool:
        """测试单个场景创建"""
        logger.info("\n" + "="*50)
        logger.info("Stage 5: 单个场景创建测试")
        logger.info("="*50)

        if not self.token or not self.classroom_id:
            logger.error("✗ 需要先完成认证和课程创建")
            return False

        if not self.outlines:
            logger.warning("⚠ 没有大纲数据，使用默认大纲")
            self.outlines = [{"id": "1", "type": "slide", "title": "测试场景", "description": "测试描述", "key_points": ["要点1"], "order": 1}]

        outline = self.outlines[0]
        order_index = 1

        logger.info(f"创建场景: {outline.get('title')} (order: {order_index})")
        start_time = time.time()

        try:
            url = f"{API_BASE_URL}/classrooms/{self.classroom_id}/scenes/create"
            headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
            payload = {
                "outline": outline,
                "order_index": order_index,
                "language": "zh-CN",
                "agents": self.agents[:3] if self.agents else None,
            }

            async with self.session.post(url, headers=headers, json=payload) as resp:
                if resp.status != 200:
                    error = await resp.text()
                    logger.error(f"✗ 场景创建失败: {resp.status} - {error}")
                    return False

                data = await resp.json()
                elapsed = time.time() - start_time

                logger.info(f"✓ 场景创建成功")
                logger.info(f"  场景ID: {data.get('id')}")
                logger.info(f"  标题: {data.get('title')}")
                logger.info(f"  类型: {data.get('type')}")
                logger.info(f"  耗时: {elapsed:.1f}s")

                # 检查内容是否为LLM生成（而非fallback）
                # 获取场景详情检查内容丰富度
                await self._verify_scene_content(data.get("id"))

                return True

        except Exception as e:
            logger.error(f"✗ 场景创建异常: {e}")
            return False

    async def _verify_scene_content(self, scene_id: str):
        """验证场景内容是否丰富"""
        try:
            url = f"{API_BASE_URL}/classrooms/{self.classroom_id}"
            headers = {"Authorization": f"Bearer {self.token}"}

            async with self.session.get(url, headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    scenes = data.get("scenes", [])

                    for scene in scenes:
                        if scene.get("id") == scene_id:
                            content = scene.get("content", {})
                            elements = content.get("canvas", {}).get("elements", [])
                            actions = scene.get("actions", [])

                            # 检查内容丰富度
                            element_count = len(elements)
                            action_count = len(actions)

                            # Fallback模板通常只有3-5个元素（标题+描述+要点）
                            # LLM生成的内容通常有更多元素和装饰
                            if element_count <= 5:
                                logger.warning(f"  ⚠ 内容可能是fallback模板 - 元素数: {element_count}")
                            else:
                                logger.info(f"  ✓ 内容丰富 - 元素数: {element_count}, 动作数: {action_count}")

                            # 打印元素概览
                            for el in elements[:5]:
                                el_type = el.get("type")
                                el_content = el.get("content", "")[:30] if el.get("content") else ""
                                logger.info(f"    元素: {el_type} - {el_content}...")
                            break

        except Exception as e:
            logger.warning(f"  无法验证场景内容: {e}")

    # ==================== Stage 6: 后台批量创建 ====================

    async def test_background_creation(self) -> bool:
        """测试后台批量场景创建"""
        logger.info("\n" + "="*50)
        logger.info("Stage 6: 后台批量场景创建测试")
        logger.info("="*50)

        if not self.token or not self.classroom_id:
            logger.error("✗ 需要先完成认证和课程创建")
            return False

        # 剩余场景（跳过第一个，因为已在Stage 5创建）
        remaining_outlines = self.outlines[1:] if len(self.outlines) > 1 else []

        if not remaining_outlines:
            logger.warning("⚠ 没有剩余大纲，跳过测试")
            return True

        logger.info(f"创建剩余 {len(remaining_outlines)} 个场景...")
        start_time = time.time()
        success_count = 0

        for i, outline in enumerate(remaining_outlines):
            order_index = i + 2  # 第一个场景是order=1，剩余从2开始

            try:
                url = f"{API_BASE_URL}/classrooms/{self.classroom_id}/scenes/create"
                headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
                payload = {
                    "outline": outline,
                    "order_index": order_index,
                    "language": "zh-CN",
                    "agents": self.agents[:3] if self.agents else None,
                }

                scene_start = time.time()
                async with self.session.post(url, headers=headers, json=payload) as resp:
                    scene_elapsed = time.time() - scene_start

                    if resp.status == 200:
                        data = await resp.json()
                        success_count += 1
                        logger.info(f"  ✓ 场景 #{order_index}: {outline.get('title')} ({scene_elapsed:.1f}s)")
                    else:
                        error = await resp.text()
                        logger.warning(f"  ✗ 场景 #{order_index} 失败: {error[:50]}")

                # 每创建2个场景刷新一次（模拟前端行为）
                if (i + 1) % 2 == 0:
                    await asyncio.sleep(0.5)  # 小延迟避免并发问题

            except Exception as e:
                logger.warning(f"  ✗ 场景 #{order_index} 异常: {e}")

        elapsed = time.time() - start_time
        logger.info(f"✓ 后台创建完成 - 成功 {success_count}/{len(remaining_outlines)}")
        logger.info(f"  总耗时: {elapsed:.1f}s")

        # 最终检查课程场景总数
        await self._check_final_scenes()

        return success_count == len(remaining_outlines)

    async def _check_final_scenes(self):
        """检查最终场景数量"""
        try:
            url = f"{API_BASE_URL}/classrooms/{self.classroom_id}"
            headers = {"Authorization": f"Bearer {self.token}"}

            async with self.session.get(url, headers=headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    scenes = data.get("scenes", [])
                    logger.info(f"  课程最终场景数: {len(scenes)}")
                    for scene in scenes:
                        logger.info(f"    - #{scene.get('order_index')}: {scene.get('title')} ({scene.get('type')})")

        except Exception as e:
            logger.warning(f"  无法检查最终场景: {e}")

    # ==================== 全流程测试 ====================

    async def test_all(self) -> Dict[str, bool]:
        """测试所有阶段"""
        results = {}

        results["auth"] = await self.test_auth()
        if not results["auth"]:
            logger.error("\n认证失败，无法继续测试")
            return results

        results["outlines"] = await self.test_outlines()
        results["agents"] = await self.test_agents()
        results["classroom"] = await self.test_classroom_create()
        results["scene"] = await self.test_scene_create()
        results["background"] = await self.test_background_creation()

        # 打印总结
        logger.info("\n" + "="*50)
        logger.info("测试结果总结")
        logger.info("="*50)

        for stage, success in results.items():
            status = "✓ 成功" if success else "✗ 失败"
            logger.info(f"  {stage}: {status}")

        total_success = sum(1 for v in results.values() if v)
        total_count = len(results)
        logger.info(f"\n总计: {total_success}/{total_count} 阶段通过")

        return results

    async def cleanup(self):
        """清理测试数据"""
        logger.info("\n" + "="*50)
        logger.info("清理测试数据")
        logger.info("="*50)

        if self.classroom_id and self.token:
            try:
                url = f"{API_BASE_URL}/classrooms/{self.classroom_id}"
                headers = {"Authorization": f"Bearer {self.token}"}

                async with self.session.delete(url, headers=headers) as resp:
                    if resp.status == 200:
                        logger.info(f"✓ 已删除测试课程: {self.classroom_id}")
                    else:
                        logger.warning(f"⚠ 删除课程失败: {resp.status}")

            except Exception as e:
                logger.warning(f"⚠ 清理异常: {e}")

        await self.close_session()


def main():
    parser = argparse.ArgumentParser(description="课程创建流程测试")
    parser.add_argument(
        "--stage",
        choices=["all", "auth", "outlines", "agents", "classroom", "scene", "background"],
        default="all",
        help="测试的阶段（默认全部）"
    )
    parser.add_argument(
        "--cleanup",
        action="store_true",
        help="测试完成后清理数据"
    )
    parser.add_argument(
        "--url",
        default="http://localhost:8000",
        help="API地址（默认localhost:8000）"
    )

    args = parser.parse_args()

    # 更新API地址
    global API_BASE_URL
    API_BASE_URL = args.url

    async def run_tests():
        tester = CourseFlowTester()

        try:
            if args.stage == "all":
                results = await tester.test_all()
                return results
            else:
                await tester.init_session()

                stage_map = {
                    "auth": tester.test_auth,
                    "outlines": tester.test_outlines,
                    "agents": tester.test_agents,
                    "classroom": tester.test_classroom_create,
                    "scene": tester.test_scene_create,
                    "background": tester.test_background_creation,
                }

                # 执行前置依赖
                dependencies = {
                    "outlines": ["auth"],
                    "agents": ["auth"],
                    "classroom": ["auth", "outlines"],
                    "scene": ["auth", "classroom"],
                    "background": ["auth", "classroom"],
                }

                if args.stage in dependencies:
                    for dep in dependencies[args.stage]:
                        logger.info(f"执行前置依赖: {dep}")
                        success = await stage_map[dep]()
                        if not success:
                            logger.error(f"前置依赖 {dep} 失败")
                            return False

                success = await stage_map[args.stage]()
                logger.info(f"\n阶段 {args.stage}: {'✓ 成功' if success else '✗ 失败'}")

                if args.cleanup:
                    await tester.cleanup()

                return success

        except KeyboardInterrupt:
            logger.info("\n测试中断")
            await tester.close_session()
        except Exception as e:
            logger.error(f"\n测试异常: {e}")
            await tester.close_session()
            raise

    try:
        asyncio.run(run_tests())
    except Exception as e:
        logger.error(f"测试失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()