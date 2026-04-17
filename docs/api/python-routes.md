# Python 后端路由 API

## 路由结构

```python
app/routes/
├── auth.py
├── classrooms.py
├── chat.py
├── generate.py
├── collaboration.py
├── tokens.py
├── points.py
├── questions.py
├── answers.py
├── notes.py
├── streaks.py
├── tasks.py
├── leagues.py
├── badges.py
├── buddies.py
├── matches.py
├── invitations.py
├── payment.py
├── admin.py
```

## 认证路由 (auth.py)

### POST /api/auth/register

```python
@router.post("/register")
async def register(request: RegisterRequest):
    """
    用户注册
    
    Args:
        email: 邮箱地址
        password: 密码
        nickname: 昵称（可选）
    
    Returns:
        AuthResponse: Token + User信息
    """
    # 验证邮箱格式
    # 检查邮箱是否已注册
    # 哈希密码
    # 创建用户
    # 发放新用户礼包
    # 返回Token
```

### POST /api/auth/login

```python
@router.post("/login")
async def login(request: LoginRequest):
    """
    用户登录
    
    Args:
        email: 邮箱地址
        password: 密码
    
    Returns:
        AuthResponse: Token + User信息
    """
```

### POST /api/auth/refresh

```python
@router.post("/refresh")
async def refresh_token(refresh_token: str):
    """
    Token刷新
    
    Args:
        refresh_token: 刷新Token
    
    Returns:
        AuthResponse: 新Token + User信息
    """
```

## 课程路由 (classrooms.py)

### POST /api/classrooms

```python
@router.post("/")
async def create_classroom(
    request: CreateClassroomRequest,
    user: User = Depends(get_current_user)
):
    """
    创建课程
    
    Args:
        title: 课程标题
        source: 来源类型（upload/topic）
        content: 文件ID或主题描述
    
    Returns:
        ClassroomResponse: 课程ID + 任务ID + 状态
    """
    # 检查Token余额
    # 扣减Token
    # 创建课程记录
    # 提交异步生成任务
    # 返回任务ID
```

### GET /api/classrooms/{id}

```python
@router.get("/{id}")
async def get_classroom(
    id: str,
    user: User = Depends(get_current_user)
):
    """
    获取课程详情
    
    Returns:
        Classroom: 课程完整信息（大纲、场景）
    """
```

### GET /api/classrooms/{id}/status

```python
@router.get("/{id}/status")
async def get_classroom_status(id: str):
    """
    获取课程生成状态（SSE）
    
    Returns:
        SSE流: 进度更新消息
    """
    async def event_stream():
        while True:
            status = await get_job_status(id)
            yield f"Event: progress\nData: {json.dumps(status)}"
            if status['completed']:
                break
            await asyncio.sleep(1)
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream"
    )
```

## 讨论路由 (chat.py)

### POST /api/chat/{classroom_id}

```python
@router.post("/{classroom_id}")
async def start_discussion(
    classroom_id: str,
    user: User = Depends(get_current_user)
):
    """
    发起讨论
    
    Args:
        classroom_id: 课程ID
    
    Returns:
        DiscussionResponse: 讨论ID + 初始状态
    """
    # 检查Token余额
    # 扣减Token
    # 创建讨论记录
    # 启动LangGraph状态机
```

### GET /api/chat/{classroom_id}/stream

```python
@router.get("/{classroom_id}/stream")
async def stream_discussion(
    classroom_id: str,
    user: User = Depends(get_current_user)
):
    """
    流式讨论（SSE）
    
    Returns:
        SSE流: 智能体发言 + 用户输入机会
    """
    async def event_stream():
        # 初始化LangGraph
        # 轮转智能体发言
        # 推送消息
        # 提供用户输入机会
        pass
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream"
    )
```

## 生成路由 (generate.py)

### POST /api/generate/outline

```python
@router.post("/outline")
async def generate_outline(
    request: OutlineRequest,
    user: User = Depends(get_current_user)
):
    """
    生成课程大纲
    
    Args:
        source: 来源类型
        content: 内容
    
    Returns:
        OutlineItem[]: 大纲结构
    """
    # 解析文档或主题
    # 调用LLM生成大纲
    # 返回大纲JSON
```

### POST /api/generate/scene

```python
@router.post("/scene")
async def generate_scene(
    request: SceneRequest,
    user: User = Depends(get_current_user)
):
    """
    生成场景
    
    Args:
        outline_item: 大纲项
        scene_type: 场景类型
    
    Returns:
        Scene: 场景数据
    """
```

### POST /api/generate/tts

```python
@router.post("/tts")
async def generate_tts(
    request: TTSRequest,
    user: User = Depends(get_current_user)
):
    """
    TTS合成
    
    Args:
        text: 文本内容
        voice: 语音角色
    
    Returns:
        TTSResponse: 音频URL
    """
```

## Token路由 (tokens.py)

### GET /api/tokens/balance

```python
@router.get("/balance")
async def get_token_balance(user: User = Depends(get_current_user)):
    """
    获取Token余额
    
    Returns:
        TokenAccount: 余额信息
    """
```

### POST /api/tokens/purchase

```python
@router.post("/purchase")
async def purchase_tokens(
    request: PurchaseRequest,
    user: User = Depends(get_current_user)
):
    """
    购买Token
    
    Args:
        package: 套餐类型
        payment_method: 支付方式
    
    Returns:
        OrderResponse: 订单信息 + 支付参数
    """
```

### POST /api/tokens/exchange

```python
@router.post("/exchange")
async def exchange_points_to_tokens(
    request: ExchangeRequest,
    user: User = Depends(get_current_user)
):
    """
    积分兑换Token
    
    Args:
        points: 积分数量
    
    Returns:
        ExchangeResponse: 兑换结果
    """
```

### GET /api/tokens/transactions

```python
@router.get("/transactions")
async def get_token_transactions(
    page: int = 1,
    limit: int = 20,
    user: User = Depends(get_current_user)
):
    """
    Token交易流水
    
    Returns:
        PaginationResponse<TokenTransaction>
    """
```

## 积分路由 (points.py)

### GET /api/points/balance

```python
@router.get("/balance")
async def get_point_balance(user: User = Depends(get_current_user)):
    """
    获取积分余额
    """
```

### POST /api/points/earn

```python
@router.post("/earn")
async def earn_points(
    request: EarnRequest,
    user: User = Depends(get_current_user)
):
    """
    赚取积分
    
    Args:
        source: 来源（course/daily/qanda/notes/invitation）
        reference_id: 关联ID
    
    Returns:
        PointTransaction: 交易记录
    """
```

## 问答路由 (questions.py)

### POST /api/questions

```python
@router.post("/")
async def create_question(
    request: CreateQuestionRequest,
    user: User = Depends(get_current_user)
):
    """
    发布问题
    
    Args:
        title: 标题
        content: 内容
        category: 分类
        bounty: 悬赏积分
    
    Returns:
        Question: 问题信息
    """
    # 扣减悬赏积分
    # 创建问题
```

### POST /api/questions/{id}/answers

```python
@router.post("/{id}/answers")
async def create_answer(
    id: str,
    request: CreateAnswerRequest,
    user: User = Depends(get_current_user)
):
    """
    提交回答
    """
```

### POST /api/questions/{id}/accept

```python
@router.post("/{id}/accept")
async def accept_answer(
    id: str,
    request: AcceptAnswerRequest,
    user: User = Depends(get_current_user)
):
    """
    采纳答案
    
    Args:
        answer_id: 答案ID
    """
    # 积分流转（90%回答者，10%平台）
```

## 打卡路由 (streaks.py)

### POST /api/streaks/checkin

```python
@router.post("/checkin")
async def checkin(user: User = Depends(get_current_user)):
    """
    每日打卡
    
    Returns:
        Streak: 打卡记录 + 奖励
    """
    # 检查今日是否已打卡
    # 计算连续天数
    # 发放积分
```

## 联赛路由 (leagues.py)

### GET /api/leagues/current

```python
@router.get("/current")
async def get_current_league(user: User = Depends(get_current_user)):
    """
    当前联赛状态
    """
```

### GET /api/leagues/rankings

```python
@router.get("/rankings")
async def get_league_rankings(
    season: str,
    level: str = None,
    page: int = 1,
    limit: int = 20
):
    """
    联赛排名
    
    Args:
        season: 赛季（2026-W16）
        level: 等级（可选）
    """
```

## 徽章路由 (badges.py)

### GET /api/badges

```python
@router.get("/")
async def get_user_badges(user: User = Depends(get_current_user)):
    """
    用户徽章列表
    """
```

### POST /api/badges/unlock

```python
@router.post("/unlock")
async def unlock_badge(
    request: UnlockBadgeRequest,
    user: User = Depends(get_current_user)
):
    """
    解锁徽章（系统触发）
    """
```

## 协作路由 (collaboration.py)

### POST /api/collaboration/{classroom_id}/join

```python
@router.post("/{classroom_id}/join")
async def join_collaboration(
    classroom_id: str,
    user: User = Depends(get_current_user)
):
    """
    加入协作课堂
    """
```

### POST /api/collaboration/{classroom_id}/invite

```python
@router.post("/{classroom_id}/invite")
async def create_invite_link(
    classroom_id: str,
    user: User = Depends(get_current_user)
):
    """
    生成邀请链接
    """
```

### WebSocket /ws/collaboration/{classroom_id}

```python
@router.websocket("/{classroom_id}")
async def collaboration_websocket(
    websocket: WebSocket,
    classroom_id: str
):
    """
    协作WebSocket连接
    
    消息类型:
    - join: 用户加入
    - leave: 用户离开
    - whiteboard_update: 白板更新
    - chat_message: 聊天消息
    - note_update: 笔记更新
    """
    # 验证Token
    # 加入Redis连接池
    # 处理消息
    # 广播消息
```

## 支付路由 (payment.py)

### POST /api/payment/create-order

```python
@router.post("/create-order")
async def create_order(
    request: CreateOrderRequest,
    user: User = Depends(get_current_user)
):
    """
    创建支付订单
    """
```

### POST /api/payment/verify

```python
@router.post("/verify")
async def verify_payment(request: VerifyPaymentRequest):
    """
    支付回调验证
    
    Args:
        order_id: 订单ID
        payment_data: 支付数据（含签名）
    """
    # 验证签名
    # 验证金额
    # 入账Token
```

## 管理路由 (admin.py)

### GET /api/admin/users

```python
@router.get("/users")
async def get_users(
    page: int = 1,
    limit: int = 20,
    status: str = None,
    admin: Admin = Depends(get_current_admin)
):
    """
    用户列表（管理后台）
    """
```

### POST /api/admin/users/{id}/action

```python
@router.post("/users/{id}/action")
async def user_action(
    id: str,
    request: AdminActionRequest,
    admin: Admin = Depends(get_current_admin)
):
    """
    用户操作（禁用/调整积分）
    """
```

### GET /api/admin/statistics

```python
@router.get("/statistics")
async def get_statistics(
    metric: str,
    start_date: str,
    end_date: str,
    admin: Admin = Depends(get_current_admin)
):
    """
    数据统计
    """
```