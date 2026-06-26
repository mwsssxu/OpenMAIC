# OpenMAIC 移动端

基于 Expo + React Native 的多智能体交互课堂移动应用。

## 功能

### 核心功能
- 用户认证（登录、注册）
- 课程播放
- Token/积分余额显示
- 钱包详情页面

### Phase 2 功能
- 问答悬赏系统（问题列表、发布、回答）
- 邀请系统（邀请码分享、奖励统计）
- 支付系统（Token购买套餐、订单记录）

### Phase 3 功能
- 学习搭子（选择搭子类型、查看消息）
- 共享笔记（笔记市场、发布、购买）
- 学习匹配（设置偏好、搜索匹配、接受/拒绝）
- 游戏化系统（联赛等级、每日任务、打卡奖励）

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm expo start

# iOS 模拟器
pnpm expo start --ios

# Android 模拟器
pnpm expo start --android

# 构建
pnpm expo build
```

## 配置

### 后端 URL 配置

创建 `.env` 文件配置后端地址：

```bash
# 本地开发
EXPO_PUBLIC_API_URL=http://localhost:8000

# 真机调试（使用 WiFi IP）
EXPO_PUBLIC_API_URL=http://192.168.1.110:8000

# 生产环境
EXPO_PUBLIC_API_URL=https://api.palansoft.cn
```

代码中通过环境变量读取（`lib/api-client/index.ts`）：

```typescript
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
```

### 真机调试注意事项

Expo 默认使用网卡 IP，手机扫码可能无法连接。解决方法：

```bash
# 方法一：使用 WiFi IP 启动
REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.110 npx expo start

# 方法二：使用 tunnel 模式（无需同 WiFi）
npx expo start --tunnel

# 方法三：使用启动脚本
./start-expo.sh
```

> **注意：** 此配置仅影响开发阶段，生产部署不受影响。

## 目录结构

```
app/
├── (tabs)/             # Tab 导航页面
│   ├── index.tsx       # 首页（我的课程）
│   ├── discover.tsx    # 发现
│   ├── questions.tsx   # 问答悬赏
│   ├── notes.tsx       # 共享笔记
│   ├── buddy.tsx       # 学习搭子
│   ├── matching.tsx    # 学习匹配
│   ├── gamification.tsx # 游戏化（联赛、任务）
│   ├── invite.tsx      # 邀请系统
│   ├── payment.tsx     # 支付充值
│   └── profile.tsx     # 个人资料（含 Token/积分）
├── auth/               # 认证页面
│   ├── login.tsx       # 登录
│   └── register.tsx    # 注册
├── classroom/          # 课程页面
│   └── [id].tsx        # 课程播放
├── wallet.tsx          # 钱包详情
├── _layout.tsx         # 导航布局
lib/
├── api-client/         # API 客户端
│   └── index.ts        # Python 后端 API
```

## API 客户端

支持以下 API：

### 认证
- 登录、注册、Token 刷新
- 用户信息、修改密码、删除账户

### 课程
- 课程 CRUD
- 课程生成（大纲、场景）

### Token/积分
- 余额查询、交易流水
- 积分兑换 Token
- Token 套餐列表

### Phase 2 API
- 问答系统（问题列表、发布、回答、投票、采纳）
- 邀请系统（邀请码、统计、应用）
- 支付系统（套餐、订单、模拟支付）

### Phase 3 API
- 学习搭子（类型、配置、消息）
- 共享笔记（列表、发布、购买、评分）
- 学习匹配（偏好、搜索、接受/拒绝）
- 游戏化（联赛、任务、打卡奖励）
- 成就系统（列表、进度、检查）

## 页面导航

| 路径 | 功能 |
|------|------|
| `/` | 首页 |
| `/discover` | 发现 |
| `/questions` | 问答悬赏 |
| `/notes` | 共享笔记 |
| `/buddy` | 学习搭子 |
| `/matching` | 学习匹配 |
| `/gamification` | 游戏化系统 |
| `/invite` | 邀请系统 |
| `/payment` | 支付充值 |
| `/profile` | 个人资料 |
| `/auth/login` | 登录 |
| `/auth/register` | 注册 |
| `/classroom/[id]` | 课程播放 |
| `/wallet` | 钱包详情 |

## 待实现

- WebSocket 多人课堂
- 白板绘制
- 课程创建
- 答题详情页
- 笔记详情页