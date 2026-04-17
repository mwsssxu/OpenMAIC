"""
实时课堂路由 - WebSocket 多人同时讨论

安全措施：
- Token 验证
- 消息长度限制 (1000 字符)
- 消息历史大小限制 (1000 条)
- 房间最大参与者 (50 人)
- 白板状态定期持久化
- 用户 ID 哈希显示
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from app.db.database import get_db
from app.middleware.auth import verify_token_from_ws, get_current_user_id
import asyncpg
import uuid
import json
from datetime import datetime
from typing import Dict, Set, Optional
import asyncio
import hashlib
import re

router = APIRouter()

# ==================== 安全配置 ====================

MAX_MESSAGE_LENGTH = 1000       # 单条消息最大长度
MAX_MESSAGE_HISTORY = 1000      # 消息历史最大条数
MAX_PARTICIPANTS = 50           # 房间最大参与者
MAX_WHITEBOARD_ELEMENTS = 200   # 白板最大元素数
RATE_LIMIT_MESSAGES = 10        # 每秒最大消息数
WHITEBOARD_PERSIST_INTERVAL = 30  # 白板持久化间隔（秒）


# ==================== 房间管理 ====================

class ClassroomRoom:
    """课堂房间"""
    def __init__(self, room_id: str, owner_id: str, stage_id: str):
        self.room_id = room_id
        self.owner_id = owner_id
        self.stage_id = stage_id
        self.participants: Dict[str, WebSocket] = {}  # user_id -> WebSocket
        self.user_info: Dict[str, dict] = {}  # user_id -> {nickname, role}
        self.message_history: list = []
        self.whiteboard_state: dict = {}
        self.current_scene: int = 0
        self.is_active: bool = True
        self.created_at = datetime.utcnow()
        self.last_persist_at = datetime.utcnow()
        self.user_message_times: Dict[str, list] = {}  # user_id -> [timestamps] for rate limiting

    def check_rate_limit(self, user_id: str) -> bool:
        """检查用户是否超过消息速率限制"""
        now = datetime.utcnow()
        times = self.user_message_times.get(user_id, [])

        # 移除超过 1 秒的旧时间戳
        times = [t for t in times if (now - t).total_seconds() < 1]

        # 检查是否超过限制
        if len(times) >= RATE_LIMIT_MESSAGES:
            return False  # 超过限制

        # 添加当前时间戳
        times.append(now)
        self.user_message_times[user_id] = times
        return True  # 允许发送

    def add_participant(self, user_id: str, ws: WebSocket, nickname: str, role: str = "participant"):
        # 检查参与者数量限制
        if len(self.participants) >= MAX_PARTICIPANTS:
            raise ValueError("房间已满")
        self.participants[user_id] = ws
        self.user_info[user_id] = {"nickname": nickname, "role": role, "joined_at": datetime.utcnow()}

    def remove_participant(self, user_id: str):
        if user_id in self.participants:
            del self.participants[user_id]
        if user_id in self.user_info:
            del self.user_info[user_id]
        if user_id in self.user_message_times:
            del self.user_message_times[user_id]  # 清理速率限制记录

    def get_participant_count(self) -> int:
        return len(self.participants)

    def get_participant_list(self) -> list:
        # 用户 ID 哈希后显示，保护隐私
        return [
            {"user_hash": hash_user_id(uid), "nickname": info["nickname"], "role": info["role"]}
            for uid, info in self.user_info.items()
        ]

    def add_message(self, message: dict):
        """添加消息并限制历史大小"""
        self.message_history.append(message)
        # 超过限制时删除旧消息
        if len(self.message_history) > MAX_MESSAGE_HISTORY:
            self.message_history = self.message_history[-MAX_MESSAGE_HISTORY:]


class RoomManager:
    """房间管理器"""
    def __init__(self):
        self.rooms: Dict[str, ClassroomRoom] = {}
        self.user_rooms: Dict[str, str] = {}  # user_id -> room_id

    def create_room(self, room_id: str, owner_id: str, stage_id: str) -> ClassroomRoom:
        room = ClassroomRoom(room_id, owner_id, stage_id)
        self.rooms[room_id] = room
        return room

    def get_room(self, room_id: str) -> Optional[ClassroomRoom]:
        return self.rooms.get(room_id)

    def join_room(self, room_id: str, user_id: str, ws: WebSocket, nickname: str, role: str = "participant"):
        room = self.get_room(room_id)
        if room:
            room.add_participant(user_id, ws, nickname, role)
            self.user_rooms[user_id] = room_id
            return room
        return None

    def leave_room(self, user_id: str):
        room_id = self.user_rooms.get(user_id)
        if room_id:
            room = self.get_room(room_id)
            if room:
                room.remove_participant(user_id)
            del self.user_rooms[user_id]
            # 如果房间空了且超过一定时间，可以清理
            if room and room.get_participant_count() == 0:
                # 保留房间供后续重新进入
                pass

    def get_user_room(self, user_id: str) -> Optional[ClassroomRoom]:
        room_id = self.user_rooms.get(user_id)
        if room_id:
            return self.get_room(room_id)
        return None


# 全局房间管理器
room_manager = RoomManager()


# ==================== 安全辅助函数 ====================

def hash_user_id(user_id: str) -> str:
    """哈希用户 ID 用于显示，保护隐私"""
    return hashlib.sha256(user_id.encode()).hexdigest()[:8]


def sanitize_content(content: str) -> str:
    """清理消息内容，防止 XSS"""
    # 限制长度
    if len(content) > MAX_MESSAGE_LENGTH:
        content = content[:MAX_MESSAGE_LENGTH]
    # 移除潜在危险字符
    content = re.sub(r'<[^>]*>', '', content)  # 移除 HTML 标签
    content = content.replace('\x00', '')  # 移除空字节
    return content.strip()


def validate_room_id(room_id: str) -> bool:
    """验证房间 ID 格式"""
    # 格式: room_{classroom_id}_{8位hex}
    pattern = r'^room_[a-f0-9\-]+_[a-f0-9]{8}$'
    return bool(re.match(pattern, room_id))


# ==================== API 端点 ====================

@router.post("/create")
async def create_classroom_session(
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """创建课堂讨论会"""
    user_uuid = uuid.UUID(current_user_id)
    classroom_id = body.get("classroom_id")

    # 验证课程所有权
    stage = await db.fetchrow(
        "SELECT id, name FROM stages WHERE id = $1 AND user_id = $2",
        uuid.UUID(classroom_id), user_uuid
    )

    if not stage:
        # 检查是否是分享的课程
        stage = await db.fetchrow(
            """
            SELECT s.id, s.name FROM stages s
            JOIN shared_classrooms sc ON s.id = sc.stage_id
            WHERE sc.share_code = $1 AND sc.is_public = TRUE
            """,
            classroom_id
        )
        if not stage:
            raise HTTPException(status_code=403, detail="课程不存在或无权限")

    # 创建房间 ID
    room_id = f"room_{classroom_id}_{uuid.uuid4().hex[:8]}"

    # 创建房间
    room = room_manager.create_room(room_id, current_user_id, str(stage["id"]))

    # 获取用户昵称
    user = await db.fetchrow(
        "SELECT nickname FROM users WHERE id = $1", user_uuid
    )
    nickname = user["nickname"] or "主持人"

    # 创建者作为主持人加入
    # WebSocket 连接在后续建立

    # 存储会话记录
    await db.execute(
        """
        INSERT INTO classroom_sessions (id, stage_id, owner_id, room_id, status, created_at)
        VALUES ($1, $2, $3, $4, 'active', $5)
        """,
        uuid.uuid4(), uuid.UUID(classroom_id) if len(classroom_id) > 10 else None,
        user_uuid, room_id, datetime.utcnow()
    )

    return {
        "room_id": room_id,
        "classroom_name": stage["name"],
        "invite_code": room_id.split("_")[-1],  # 8位邀请码
        "invite_url": f"/classroom/join/{room_id}",
        "role": "owner",
        "message": "课堂讨论会已创建，等待参与者加入",
    }


@router.get("/{room_id}/info")
async def get_room_info(
    room_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """获取房间信息"""
    room = room_manager.get_room(room_id)

    if not room:
        return {"error": "房间不存在或已结束"}

    # 获取课程信息
    stage = await db.fetchrow(
        "SELECT name, description FROM stages WHERE id = $1",
        uuid.UUID(room.stage_id)
    )

    return {
        "room_id": room_id,
        "stage_name": stage["name"] if stage else "未知课程",
        "stage_description": stage["description"] if stage else "",
        "owner_id": room.owner_id,
        "participant_count": room.get_participant_count(),
        "participants": room.get_participant_list(),
        "is_owner": current_user_id == room.owner_id,
        "current_scene": room.current_scene,
        "created_at": room.created_at.isoformat(),
    }


@router.post("/{room_id}/invite")
async def generate_invite_link(
    room_id: str,
    body: dict,
    current_user_id: str = Depends(get_current_user_id),
):
    """生成邀请链接"""
    room = room_manager.get_room(room_id)

    if not room or room.owner_id != current_user_id:
        return {"error": "无权限生成邀请链接"}

    invite_code = uuid.uuid4().hex[:6]
    max_participants = body.get("max_participants", 10)
    expires_in = body.get("expires_in_hours", 24)

    return {
        "invite_code": invite_code,
        "invite_url": f"/classroom/join/{room_id}?code={invite_code}",
        "max_participants": max_participants,
        "expires_at": datetime.utcnow().isoformat(),  # TODO: 实际过期时间
    }


@router.post("/{room_id}/end")
async def end_classroom_session(
    room_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """结束课堂讨论"""
    room = room_manager.get_room(room_id)

    if not room or room.owner_id != current_user_id:
        return {"error": "无权限结束课堂"}

    # 通知所有参与者
    for user_id, ws in room.participants.items():
        try:
            await ws.send_json({
                "type": "session_end",
                "data": {"message": "课堂已结束，感谢参与！"}
            })
        except:
            pass

    # 更新数据库
    await db.execute(
        """
        UPDATE classroom_sessions
        SET status = 'ended', ended_at = $1, participant_count = $2
        WHERE room_id = $3
        """,
        datetime.utcnow(), room.get_participant_count(), room_id
    )

    # 清理房间
    room.is_active = False
    del room_manager.rooms[room_id]

    return {
        "message": "课堂已结束",
        "duration_minutes": int((datetime.utcnow() - room.created_at).total_seconds() / 60),
        "total_participants": room.get_participant_count(),
    }


# ==================== WebSocket 连接 ====================

@router.websocket("/{room_id}/ws")
async def websocket_classroom(
    websocket: WebSocket,
    room_id: str,
    token: str,  # 通过 query parameter 传递 token
    db: asyncpg.Connection = Depends(get_db)
):
    """WebSocket 实时课堂讨论"""
    await websocket.accept()

    # 验证 token
    user_id = await verify_token_from_ws(token)
    if not user_id:
        await websocket.send_json({"type": "error", "data": {"message": "认证失败"}})
        await websocket.close()
        return

    # 验证房间 ID 格式
    if not validate_room_id(room_id):
        await websocket.send_json({"type": "error", "data": {"message": "无效的房间 ID"}})
        await websocket.close()
        return

    # 获取房间
    room = room_manager.get_room(room_id)
    if not room:
        await websocket.send_json({"type": "error", "data": {"message": "房间不存在"}})
        await websocket.close()
        return

    # 检查房间是否已满
    if room.get_participant_count() >= MAX_PARTICIPANTS:
        await websocket.send_json({"type": "error", "data": {"message": "房间已满，无法加入"}})
        await websocket.close()
        return

    # 获取用户信息
    user = await db.fetchrow(
        "SELECT nickname, avatar_url FROM users WHERE id = $1",
        uuid.UUID(user_id)
    )
    nickname = user["nickname"] or "参与者"
    avatar_url = user["avatar_url"]

    # 确定角色
    role = "owner" if user_id == room.owner_id else "participant"

    # 加入房间（带错误处理）
    try:
        room_manager.join_room(room_id, user_id, websocket, nickname, role)
    except ValueError as e:
        await websocket.send_json({"type": "error", "data": {"message": str(e)}})
        await websocket.close()
        return

    # 发送欢迎消息
    await websocket.send_json({
        "type": "joined",
        "data": {
            "room_id": room_id,
            "user_hash": hash_user_id(user_id),  # 使用哈希 ID
            "nickname": nickname,
            "role": role,
            "participant_count": room.get_participant_count(),
            "participants": room.get_participant_list(),
            "whiteboard_state": room.whiteboard_state,
            "current_scene": room.current_scene,
            "message_history": room.message_history[-50:],  # 只发送最近 50 条
        }
    })

    # 广播用户加入通知
    await broadcast_to_room(room, {
        "type": "user_joined",
        "data": {
            "user_hash": hash_user_id(user_id),
            "nickname": nickname,
            "role": role,
            "participant_count": room.get_participant_count(),
        }
    }, exclude_user=user_id)

    try:
        while True:
            # 接收消息（带异常处理）
            try:
                raw_data = await websocket.receive_text()
                # 检查消息大小（防止超大消息）
                if len(raw_data) > 10000:  # 10KB 限制
                    await websocket.send_json({"type": "error", "data": {"message": "消息过大"}})
                    continue
                data = json.loads(raw_data)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "data": {"message": "无效的 JSON 格式"}})
                continue

            message_type = data.get("type")
            message_data = data.get("data", {})

            # 速率限制检查（对所有消息类型）
            # 排除 ping 心跳消息
            if message_type not in ("ping", "scene_change") and not room.check_rate_limit(user_id):
                await websocket.send_json({
                    "type": "error",
                    "data": {"message": "发送过快，请稍后再试", "code": "rate_limit"}
                })
                continue

            # 处理不同类型消息
            if message_type == "chat":
                # 用户聊天消息
                await handle_chat_message(room, user_id, nickname, message_data, db)

            elif message_type == "whiteboard_action":
                # 白板操作
                await handle_whiteboard_action(room, user_id, message_data)

            elif message_type == "scene_change":
                # 场景切换（仅主持人）
                if role == "owner":
                    await handle_scene_change(room, message_data)

            elif message_type == "request_agent":
                # 请求 Agent 回答
                await handle_agent_request(room, user_id, nickname, message_data, websocket)

            elif message_type == "reaction":
                # 表情反应
                await handle_reaction(room, user_id, nickname, message_data)

            elif message_type == "ping":
                # 心跳
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        # 用户断开连接
        room_manager.leave_room(user_id)

        # 广播用户离开
        await broadcast_to_room(room, {
            "type": "user_left",
            "data": {
                "user_id": user_id,
                "nickname": nickname,
                "participant_count": room.get_participant_count(),
            }
        })

        # 如果主持人离开，结束课堂
        if role == "owner":
            await broadcast_to_room(room, {
                "type": "session_end",
                "data": {"message": "主持人已离开，课堂结束"}
            })


# ==================== 消息处理 ====================

async def handle_chat_message(room: ClassroomRoom, user_id: str, nickname: str, data: dict, db):
    """处理聊天消息"""
    # 速率限制检查
    if not room.check_rate_limit(user_id):
        return  # 超过速率限制，忽略消息

    content = data.get("content", "")

    # 安全检查：清理内容
    content = sanitize_content(content)
    if not content:
        return  # 空消息不处理

    message_id = uuid.uuid4().hex

    message = {
        "id": message_id,
        "type": "chat",
        "user_hash": hash_user_id(user_id),  # 使用哈希 ID
        "nickname": nickname,
        "content": content,
        "timestamp": datetime.utcnow().isoformat(),
    }

    # 存储消息（使用限制后的历史）
    room.add_message(message)

    # 存储到数据库
    await db.execute(
        """
        INSERT INTO classroom_messages (id, session_id, user_id, content, created_at)
        VALUES ($1, (SELECT id FROM classroom_sessions WHERE room_id = $2), $3, $4, $5)
        """,
        uuid.UUID(message_id), room.room_id, uuid.UUID(user_id), content, datetime.utcnow()
    )

    # 广播给所有参与者
    await broadcast_to_room(room, {
        "type": "chat",
        "data": message
    })


async def handle_whiteboard_action(room: ClassroomRoom, user_id: str, data: dict):
    """处理白板操作"""
    # 速率限制检查（白板操作也可能有频繁更新）
    if not room.check_rate_limit(user_id):
        return  # 超过速率限制，忽略操作

    action_type = data.get("action")  # draw, clear, add_shape, etc.
    action_data = data.get("data", {})

    # 更新白板状态
    if action_type == "clear":
        room.whiteboard_state = {}
    else:
        # 检查元素数量限制
        if len(room.whiteboard_state) >= MAX_WHITEBOARD_ELEMENTS:
            # 删除最早的元素
            oldest_key = min(room.whiteboard_state.keys(),
                           key=lambda k: room.whiteboard_state[k].get("timestamp", ""))
            del room.whiteboard_state[oldest_key]

        element_id = data.get("element_id", uuid.uuid4().hex)
        room.whiteboard_state[element_id] = {
            "type": action_type,
            "data": action_data,
            "user_hash": hash_user_id(user_id),  # 使用哈希 ID
            "timestamp": datetime.utcnow().isoformat(),
        }

    # 广播给所有参与者
    await broadcast_to_room(room, {
        "type": "whiteboard_action",
        "data": {
            "action": action_type,
            "element_id": element_id if action_type != "clear" else None,
            "data": action_data,
            "user_hash": hash_user_id(user_id),
        }
    })


async def handle_scene_change(room: ClassroomRoom, data: dict):
    """处理场景切换"""
    new_scene = data.get("scene_index", 0)
    room.current_scene = new_scene

    # 广播给所有参与者
    await broadcast_to_room(room, {
        "type": "scene_change",
        "data": {"scene_index": new_scene}
    })


async def handle_agent_request(room: ClassroomRoom, user_id: str, nickname: str, data: dict, ws: WebSocket):
    """处理 Agent 请求"""
    from app.services.orchestration.director_graph import stream_agent_response

    question = data.get("question", "")
    agent_id = data.get("agent_id", "teacher")

    # 先广播用户的问题
    await broadcast_to_room(room, {
        "type": "chat",
        "data": {
            "id": uuid.uuid4().hex,
            "type": "user_to_agent",
            "user_id": user_id,
            "nickname": nickname,
            "content": f"@{agent_id} {question}",
            "timestamp": datetime.utcnow().isoformat(),
        }
    })

    # 流式发送 Agent 回复
    # 注意：这里只发送给请求者，或者广播给所有人
    async for event in stream_agent_response(
        agent_id=agent_id,
        agent_role="teacher",
        prompt=question,
        context={"topic": "多人课堂讨论"},
        model="gpt-4o-mini",
    ):
        await broadcast_to_room(room, {
            "type": "agent_response",
            "data": {
                "agent_id": agent_id,
                "event": event,
                "target_user": user_id,  # 可选：指定接收者
            }
        })


async def handle_reaction(room: ClassroomRoom, user_id: str, nickname: str, data: dict):
    """处理表情反应"""
    reaction_type = data.get("reaction")  # 👍, 👏, ❓, etc.

    await broadcast_to_room(room, {
        "type": "reaction",
        "data": {
            "user_id": user_id,
            "nickname": nickname,
            "reaction": reaction_type,
            "timestamp": datetime.utcnow().isoformat(),
        }
    })


async def broadcast_to_room(room: ClassroomRoom, message: dict, exclude_user: str = None):
    """广播消息给房间所有参与者"""
    for user_id, ws in room.participants.items():
        if exclude_user and user_id == exclude_user:
            continue
        try:
            await ws.send_json(message)
        except:
            # 连接可能已断开
            pass