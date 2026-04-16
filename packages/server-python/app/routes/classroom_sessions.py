"""
实时课堂路由 - WebSocket 多人同时讨论
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from app.db.database import get_db
from app.middleware.auth import verify_token_from_ws
import asyncpg
import uuid
import json
from datetime import datetime
from typing import Dict, Set, Optional
import asyncio

router = APIRouter()


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

    def add_participant(self, user_id: str, ws: WebSocket, nickname: str, role: str = "participant"):
        self.participants[user_id] = ws
        self.user_info[user_id] = {"nickname": nickname, "role": role, "joined_at": datetime.utcnow()}

    def remove_participant(self, user_id: str):
        if user_id in self.participants:
            del self.participants[user_id]
        if user_id in self.user_info:
            del self.user_info[user_id]

    def get_participant_count(self) -> int:
        return len(self.participants)

    def get_participant_list(self) -> list:
        return [
            {"user_id": uid, "nickname": info["nickname"], "role": info["role"]}
            for uid, info in self.user_info.items()
        ]


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
        from app.routes.sharing import get_shared_stage_id
        stage = await db.fetchrow(
            """
            SELECT s.id, s.name FROM stages s
            JOIN shared_classrooms sc ON s.id = sc.stage_id
            WHERE sc.share_code = $1 AND sc.is_public = TRUE
            """,
            classroom_id
        )
        if not stage:
            return {"error": "课程不存在或无权限"}

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

    # 获取房间
    room = room_manager.get_room(room_id)
    if not room:
        await websocket.send_json({"type": "error", "data": {"message": "房间不存在"}})
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

    # 加入房间
    room_manager.join_room(room_id, user_id, websocket, nickname, role)

    # 发送欢迎消息
    await websocket.send_json({
        "type": "joined",
        "data": {
            "room_id": room_id,
            "user_id": user_id,
            "nickname": nickname,
            "role": role,
            "participant_count": room.get_participant_count(),
            "participants": room.get_participant_list(),
            "whiteboard_state": room.whiteboard_state,
            "current_scene": room.current_scene,
        }
    })

    # 广播用户加入通知
    await broadcast_to_room(room, {
        "type": "user_joined",
        "data": {
            "user_id": user_id,
            "nickname": nickname,
            "role": role,
            "participant_count": room.get_participant_count(),
        }
    }, exclude_user=user_id)

    try:
        while True:
            # 接收消息
            data = await websocket.receive_json()
            message_type = data.get("type")
            message_data = data.get("data", {})

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
    content = data.get("content", "")
    message_id = uuid.uuid4().hex

    message = {
        "id": message_id,
        "type": "chat",
        "user_id": user_id,
        "nickname": nickname,
        "content": content,
        "timestamp": datetime.utcnow().isoformat(),
    }

    # 存储消息
    room.message_history.append(message)

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
    action_type = data.get("action")  # draw, clear, add_shape, etc.
    action_data = data.get("data", {})

    # 更新白板状态
    if action_type == "clear":
        room.whiteboard_state = {}
    else:
        element_id = data.get("element_id", uuid.uuid4().hex)
        room.whiteboard_state[element_id] = {
            "type": action_type,
            "data": action_data,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat(),
        }

    # 广播给所有参与者
    await broadcast_to_room(room, {
        "type": "whiteboard_action",
        "data": {
            "action": action_type,
            "element_id": element_id if action_type != "clear" else None,
            "data": action_data,
            "user_id": user_id,
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