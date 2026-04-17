"""
Video to Course generation API.
Converts YouTube/Bilibili videos into structured courses.

Workflow:
1. Submit video URL
2. Extract video metadata (title, duration, thumbnail)
3. Fetch or generate subtitles (via ASR if needed)
4. AI analyzes content, generates course outline
5. Create course with scenes from outline
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from pydantic import BaseModel, HttpUrl
from typing import Optional, List
from datetime import datetime
import asyncpg
import uuid
import re
import asyncio
from app.db.database import get_db
from app.middleware.auth import get_current_user_id

router = APIRouter(prefix="/video-course", tags=["video-course"])


# ============ Models ============

class VideoCourseRequest(BaseModel):
    video_url: str
    language: str = "zh-CN"
    depth: str = "understand"  # skim, understand, master
    include_quiz: bool = True


class VideoInfo(BaseModel):
    id: str
    platform: str
    title: str
    duration: int
    thumbnail: Optional[str]
    subtitles_available: bool


class VideoSourceStatus(BaseModel):
    id: str
    video_url: str
    platform: str
    title: Optional[str]
    status: str
    progress: int
    created_at: datetime


class CourseOutline(BaseModel):
    topics: List[dict]


# ============ URL Parsing ============

def parse_youtube_url(url: str) -> Optional[str]:
    """Extract YouTube video ID from URL."""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)',
        r'youtube\.com\/v\/([^&\?\/]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def parse_bilibili_url(url: str) -> Optional[str]:
    """Extract Bilibili BV ID from URL."""
    patterns = [
        r'bilibili\.com\/video\/(BV[a-zA-Z0-9]+)',
        r'b23\.tv\/(BV[a-zA-Z0-9]+)',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def detect_platform(url: str) -> str:
    """Detect video platform from URL."""
    if 'youtube.com' in url or 'youtu.be' in url:
        return 'youtube'
    elif 'bilibili.com' in url or 'b23.tv' in url:
        return 'bilibili'
    return 'other'


# ============ Video Info Fetching ============

async def fetch_youtube_info(video_id: str) -> dict:
    """Fetch YouTube video metadata."""
    # In production, use YouTube Data API
    # For now, return mock data
    return {
        "video_id": video_id,
        "platform": "youtube",
        "title": f"YouTube Video {video_id}",
        "duration": 600,
        "thumbnail": f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
        "subtitles_available": True,
    }


async def fetch_bilibili_info(bv_id: str) -> dict:
    """Fetch Bilibili video metadata."""
    # In production, use Bilibili API
    # For now, return mock data
    return {
        "video_id": bv_id,
        "platform": "bilibili",
        "title": f"Bilibili Video {bv_id}",
        "duration": 900,
        "thumbnail": None,
        "subtitles_available": True,
    }


# ============ Subtitle Processing ============

async def fetch_youtube_subtitles(video_id: str, language: str = "zh-CN") -> Optional[str]:
    """Fetch YouTube subtitles."""
    # In production, use youtube-transcript-api or similar
    # For now, return mock subtitles
    return """
    [00:00] 大家好，今天我们来学习机器学习的基础概念
    [00:15] 机器学习是人工智能的一个重要分支
    [00:30] 它让计算机能够从数据中学习模式
    [00:45] 主要分为三类：监督学习、无监督学习、强化学习
    [01:00] 监督学习需要标注数据来训练模型
    [01:15] 无监督学习则从无标注数据中发现隐藏结构
    [01:30] 强化学习通过与环境交互来优化决策
    [01:45] 让我们看几个实际应用案例
    [02:00] 图像识别、语音识别、自然语言处理
    [02:15] 这些都是机器学习的成功应用
    """


async def fetch_bilibili_subtitles(bv_id: str) -> Optional[str]:
    """Fetch Bilibili subtitles."""
    # In production, use Bilibili API or fetch from subtitle files
    # For now, return mock subtitles
    return """
    [00:00] Python编程入门教程
    [00:15] Python是一门简单易学的编程语言
    [00:30] 它广泛应用于数据分析、Web开发等领域
    [00:45] 基础语法包括变量、函数、类
    [01:00] 让我们从变量开始学习
    [01:15] 变量用于存储数据值
    [01:30] Python支持多种数据类型
    """


async def generate_subtitles_via_asr(video_url: str) -> str:
    """Generate subtitles using ASR (Whisper or similar)."""
    # In production, call Whisper API or local model
    # For now, return mock output
    return """
    [00:00] AI生成的字幕内容
    [00:15] 这是一个示例课程
    """


# ============ Course Generation ============

async def analyze_subtitles_and_generate_outline(
    subtitles: str,
    depth: str = "understand",
    language: str = "zh-CN"
) -> List[dict]:
    """Use AI to analyze subtitles and generate course outline."""
    # In production, call LLM API (Claude/OpenAI)
    # For now, parse mock subtitles into topics

    lines = subtitles.strip().split('\n')
    topics = []
    current_topic = None
    topic_start = 0

    for i, line in enumerate(lines):
        if not line.strip():
            continue

        # Parse timestamp and text
        match = re.match(r'\[(\d+:\d+)\]\s*(.+)', line)
        if match:
            time_str = match.group(1)
            text = match.group(2)

            # Convert time to seconds
            parts = time_str.split(':')
            seconds = int(parts[0]) * 60 + int(parts[1])

            # Group into topics (every ~30 seconds)
            if not current_topic or seconds - topic_start >= 30:
                if current_topic:
                    topics.append(current_topic)

                current_topic = {
                    "title": text[:50] if len(text) <= 50 else text[:47] + "...",
                    "content": text,
                    "start_time": seconds,
                    "end_time": seconds + 30,
                    "key_points": [],
                }
                topic_start = seconds
            else:
                current_topic["content"] += "\n" + text
                current_topic["key_points"].append(text)
                current_topic["end_time"] = seconds

    if current_topic:
        topics.append(current_topic)

    return topics


async def create_course_from_outline(
    user_id: str,
    video_info: dict,
    outline: List[dict],
    depth: str,
    include_quiz: bool,
    db: asyncpg.Connection
) -> str:
    """Create course database records from outline."""
    # Create course
    course_name = f"视频课程: {video_info.get('title', 'Untitled')}"
    course_id = await db.fetchval(
        """
        INSERT INTO stages (user_id, name, description, created_at)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        """,
        uuid.UUID(user_id),
        course_name,
        f"从{video_info['platform']}视频生成的课程",
        datetime.utcnow()
    )

    # Create scenes for each topic
    for i, topic in enumerate(outline):
        scene_id = await db.fetchval(
            """
            INSERT INTO scenes (stage_id, name, position, created_at)
            VALUES ($1, $2, $3, $4)
            RETURNING id
            """,
            course_id,
            topic["title"],
            i + 1,
            datetime.utcnow()
        )

        # In production, generate actual slide content via LLM
        # For now, use topic content as description

    return str(course_id)


# ============ Background Processing ============

async def process_video_to_course(
    source_id: str,
    user_id: str,
    video_url: str,
    language: str,
    depth: str,
    include_quiz: bool,
    db_url: str
):
    """Background task to process video and generate course."""
    # Connect to database
    conn = await asyncpg.connect(db_url)

    try:
        # Get video source record
        source = await conn.fetchrow(
            "SELECT * FROM video_sources WHERE id = $1",
            uuid.UUID(source_id)
        )

        if not source:
            return

        platform = source["platform"]
        video_id = source["video_id"]

        # Update status to processing
        await conn.execute(
            "UPDATE video_sources SET status = 'processing', updated_at = $2 WHERE id = $1",
            uuid.UUID(source_id),
            datetime.utcnow()
        )

        # Fetch video info
        video_info = {}
        if platform == "youtube":
            video_info = await fetch_youtube_info(video_id)
        elif platform == "bilibili":
            video_info = await fetch_bilibili_info(video_id)

        # Update video info
        await conn.execute(
            """
            UPDATE video_sources SET
                title = $2, duration_seconds = $3, thumbnail_url = $4,
                subtitles_available = $5, updated_at = $6
            WHERE id = $1
            """,
            uuid.UUID(source_id),
            video_info.get("title"),
            video_info.get("duration"),
            video_info.get("thumbnail"),
            video_info.get("subtitles_available", False),
            datetime.utcnow()
        )

        # Fetch or generate subtitles
        subtitles = None
        if platform == "youtube":
            subtitles = await fetch_youtube_subtitles(video_id, language)
        elif platform == "bilibili":
            subtitles = await fetch_bilibili_subtitles(video_id)

        if not subtitles:
            subtitles = await generate_subtitles_via_asr(video_url)

        # Store subtitles
        await conn.execute(
            """
            UPDATE video_sources SET subtitles_text = $2, updated_at = $3 WHERE id = $1
            """,
            uuid.UUID(source_id),
            subtitles,
            datetime.utcnow()
        )

        # Analyze and generate outline
        outline = await analyze_subtitles_and_generate_outline(subtitles, depth, language)

        # Create course
        course_id = await create_course_from_outline(
            user_id, video_info, outline, depth, include_quiz, conn
        )

        # Update status to completed
        await conn.execute(
            """
            UPDATE video_sources SET status = 'completed', updated_at = $2 WHERE id = $1
            """,
            uuid.UUID(source_id),
            datetime.utcnow()
        )

        # Create mapping
        for i, topic in enumerate(outline):
            await conn.execute(
                """
                INSERT INTO course_video_mappings
                (course_id, video_source_id, topic_index, timestamp_start, timestamp_end, created_at)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                uuid.UUID(course_id),
                uuid.UUID(source_id),
                i,
                topic.get("start_time", 0),
                topic.get("end_time", 30),
                datetime.utcnow()
            )

    except Exception as e:
        # Update status to failed
        await conn.execute(
            """
            UPDATE video_sources SET status = 'failed', error_message = $2, updated_at = $3
            WHERE id = $1
            """,
            uuid.UUID(source_id),
            str(e),
            datetime.utcnow()
        )

    finally:
        await conn.close()


# ============ Routes ============

@router.post("/submit")
async def submit_video_course(
    request: VideoCourseRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Submit a video URL for course generation."""
    # Parse URL
    platform = detect_platform(request.video_url)
    video_id = None

    if platform == "youtube":
        video_id = parse_youtube_url(request.video_url)
    elif platform == "bilibili":
        video_id = parse_bilibili_url(request.video_url)

    if not video_id:
        raise HTTPException(status_code=400, detail="Could not parse video URL")

    # Create video source record
    source_id = await db.fetchval(
        """
        INSERT INTO video_sources
        (user_id, video_url, platform, video_id, language, status, created_at)
        VALUES ($1, $2, $3, $4, $5, 'pending', $6)
        RETURNING id
        """,
        uuid.UUID(user_id),
        request.video_url,
        platform,
        video_id,
        request.language,
        datetime.utcnow()
    )

    # Start background processing
    # In production, use proper async task queue (Celery, RQ, etc.)
    # For now, use FastAPI BackgroundTasks
    db_url = "postgresql://postgres:postgres@localhost/openmaic"  # Should be from config

    background_tasks.add_task(
        process_video_to_course,
        str(source_id),
        user_id,
        request.video_url,
        request.language,
        request.depth,
        request.include_quiz,
        db_url
    )

    return {
        "source_id": str(source_id),
        "status": "pending",
        "message": "Video processing started"
    }


@router.get("/status/{source_id}", response_model=VideoSourceStatus)
async def get_video_course_status(
    source_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Get status of video-to-course conversion."""
    source = await db.fetchrow(
        """
        SELECT id, video_url, platform, title, status, created_at
        FROM video_sources
        WHERE id = $1 AND user_id = $2
        """,
        uuid.UUID(source_id),
        uuid.UUID(user_id)
    )

    if not source:
        raise HTTPException(status_code=404, detail="Video source not found")

    return VideoSourceStatus(
        id=str(source["id"]),
        video_url=source["video_url"],
        platform=source["platform"],
        title=source["title"],
        status=source["status"],
        progress=0 if source["status"] == "pending" else 50 if source["status"] == "processing" else 100,
        created_at=source["created_at"]
    )


@router.get("/list")
async def list_video_courses(
    limit: int = Query(20, le=50),
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """List user's video-to-course conversions."""
    sources = await db.fetch(
        """
        SELECT vs.id, vs.video_url, vs.platform, vs.title, vs.status, vs.created_at,
               s.name as course_name
        FROM video_sources vs
        LEFT JOIN course_video_mappings cvm ON vs.id = cvm.video_source_id
        LEFT JOIN stages s ON cvm.course_id = s.id
        WHERE vs.user_id = $1
        ORDER BY vs.created_at DESC
        LIMIT $2
        """,
        uuid.UUID(user_id),
        limit
    )

    return {
        "sources": [
            {
                "id": str(s["id"]),
                "video_url": s["video_url"],
                "platform": s["platform"],
                "title": s["title"],
                "status": s["status"],
                "course_name": s["course_name"],
                "created_at": s["created_at"].isoformat()
            }
            for s in sources
        ]
    }


@router.get("/info")
async def get_video_info_preview(
    url: str,
    db: asyncpg.Connection = Depends(get_db)
):
    """Preview video info without creating course."""
    platform = detect_platform(url)
    video_id = None

    if platform == "youtube":
        video_id = parse_youtube_url(url)
        if video_id:
            info = await fetch_youtube_info(video_id)
            return VideoInfo(**info)
    elif platform == "bilibili":
        video_id = parse_bilibili_url(url)
        if video_id:
            info = await fetch_bilibili_info(video_id)
            return VideoInfo(**info)

    raise HTTPException(status_code=400, detail="Could not fetch video info")


@router.delete("/{source_id}")
async def delete_video_course(
    source_id: str,
    user_id: str = Depends(get_current_user_id),
    db: asyncpg.Connection = Depends(get_db)
):
    """Delete a video-to-course conversion."""
    # Check ownership
    source = await db.fetchrow(
        "SELECT id FROM video_sources WHERE id = $1 AND user_id = $2",
        uuid.UUID(source_id),
        uuid.UUID(user_id)
    )

    if not source:
        raise HTTPException(status_code=404, detail="Video source not found")

    # Delete mappings and source
    await db.execute(
        "DELETE FROM course_video_mappings WHERE video_source_id = $1",
        uuid.UUID(source_id)
    )
    await db.execute(
        "DELETE FROM video_sources WHERE id = $1",
        uuid.UUID(source_id)
    )

    return {"success": True}