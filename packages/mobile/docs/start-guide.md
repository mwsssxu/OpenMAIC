# OpenMAIC 移动端启动指南

> **技术栈:** Expo + React Native  
> **版本:** v0.1.0  
> **位置:** packages/mobile

---

## 一、快速启动

### 方法一：使用启动脚本

```bash
cd packages/mobile
./scripts/start.sh
```

脚本提供以下选项：
1. 开发模式 - Expo 开发服务器
2. Web 模式 - 浏览器预览
3. Android - Android 模拟器
4. iOS - iOS 模拟器
5. 清理缓存

### 方法二：手动启动

### 前置要求

1. **Node.js** >= 18
2. **pnpm** >= 10
3. **Backend 服务** 运行在 http://localhost:8000

### 启动步骤

```bash
# 1. 进入移动端目录
cd packages/mobile

# 2. 安装依赖
pnpm install

# 3. 启动 Expo 开发服务器
pnpm start
# 或
pnpm expo start
```

启动后会显示 Expo CLI 界面：

```
› Press a │ open Android
› Press i │ open iOS simulator
› Press w │ open web
› Press r │ reload app
› Press m │ toggle menu
```

---

## 二、启动模式

### iOS 模拟器

```bash
# macOS 需要 Xcode
pnpm ios
# 或
pnpm expo start --ios
```

### Android 模拟器

```bash
# 需要 Android Studio 和模拟器
pnpm android
# 或
pnpm expo start --android
```

### Web 版本

```bash
# 在浏览器中预览
pnpm web
# 或
pnpm expo start --web
```

### Expo Go (真机测试)

1. 手机安装 Expo Go App
   - iOS: App Store 搜索 "Expo Go"
   - Android: Google Play 搜索 "Expo Go"

2. 启动开发服务器
   ```bash
   pnpm start
   ```

3. 扫描 QR Code 连接

---

## 三、配置 Backend URL

修改 `lib/api-client/index.ts`：

```typescript
// 开发环境（本地）
const API_BASE_URL = 'http://localhost:8000';

// 生产环境
const API_BASE_URL = 'https://api.yourdomain.com';
```

或使用环境变量：

```bash
# 创建 .env 文件
EXPO_PUBLIC_API_URL=http://localhost:8000
```

---

## 四、项目结构

```
packages/mobile/
├── app/                    # 页面目录 (expo-router)
│   ├── _layout.tsx         # 导航布局
│   ├── (tabs)/             # Tab 导航
│   │   ├── index.tsx       # 首页（课程）
│   │   ├── discover.tsx    # 发现
│   │   ├── questions.tsx   # 问答
│   │   ├── notes.tsx       # 笔记
│   │   ├── buddy.tsx       # 学习搭子
│   │   ├── matching.tsx    # 学习匹配
│   │   ├── gamification.tsx # 游戏化
│   │   ├── invite.tsx      # 邀请
│   │   ├── payment.tsx     # 支付
│   │   └── profile.tsx     # 个人资料
│   ├── auth/               # 认证
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── classroom/[id].tsx  # 课程播放
│   ├── wallet.tsx          # 钼包
│   └── enterprise.tsx      # 企业功能
│
├── lib/
│   ├── api-client/         # API 客户端 (931行)
│   │   └── index.ts
│   ├── auth-context.tsx    # 认证上下文
│   └── storage.ts          # 本地存储
│
├── components/             # UI 组件
│
├── assets/                 # 图片资源
│   ├── icon.png
│   ├── splash.png
│   └── adaptive-icon.png
│
├── app.json                # Expo 配置
├── package.json
└── tsconfig.json
```

---

## 五、功能页面

| 页面 | 路径 | 功能 |
|------|------|------|
| 首页 | `/` | 我的课程列表 |
| 发现 | `/discover` | 发现新课程 |
| 问答 | `/questions` | 问答悬赏系统 |
| 笔记 | `/notes` | 共享笔记市场 |
| 学习搭子 | `/buddy` | AI学习助手 |
| 学习匹配 | `/matching` | 匹配学习伙伴 |
| 游戏化 | `/gamification` | 联赛/任务/打卡 |
| 邀请 | `/invite` | 邀请奖励 |
| 支付 | `/payment` | Token充值 |
| 个人资料 | `/profile` | Token/积分余额 |
| 登录 | `/auth/login` | 用户登录 |
| 注册 | `/auth/register` | 用户注册 |
| 课程播放 | `/classroom/[id]` | 播放课程 |
| 鼼包 | `/wallet` | 鼼包详情 |
| 企业 | `/enterprise` | 企业管理 |
| 测评 | `/classroom/[id]/assessment` | 学习测评 |

---

## 六、API 客户端

移动端 API 客户端 (`lib/api-client/index.ts`) 包含：

### 认证 API
- `login()` - 登录
- `register()` - 注册
- `refreshToken()` - Token刷新
- `getCurrentUser()` - 获取用户信息
- `updateProfile()` - 更新资料
- `changePassword()` - 修改密码

### 课程 API
- `getClassrooms()` - 课程列表
- `getClassroom(id)` - 课程详情
- `createClassroom()` - 创建课程
- `deleteClassroom(id)` - 删除课程
- `generateClassroom()` - AI生成课程

### Token/积分 API
- `getTokenBalance()` - Token余额
- `getPointBalance()` - 积分余额
- `getTokenTransactions()` - Token流水
- `getPointTransactions()` - 积分流水

### 测评 API
- `getAssessmentTypes()` - 测评类型
- `createAssessment()` - 创建测评
- `submitAssessment()` - 提交答案
- `getAssessmentResults()` - 测评结果

### 企业 API
- `getMyEnterprise()` - 我的鼼业
- `createEnterprise()` - 创建鼼业
- `getEnterpriseMembers()` - 成员列表
- `inviteMembers()` - 邀请成员
- `getEnterpriseStats()` - 统计数据

---

## 七、开发调试

### 清除缓存

```bash
pnpm expo start --clear
```

### 查看日志

```bash
# 在 Expo CLI 中按 j 打开调试菜单
# 或运行：
pnpm expo start --dev-client
```

### 类型检查

```bash
pnpm tsc --noEmit
```

### 代码检查

```bash
pnpm lint
```

---

## 八、构建发布

### 构建 Preview

```bash
# iOS
pnpm expo build:ios --type preview

# Android
pnpm expo build:android --type preview
```

### EAS Build (推荐)

```bash
# 安装 EAS CLI
npm install -g eas-cli

# 登录
eas login

# 配置
eas build:configure

# 构建
eas build --platform ios
eas build --platform android
```

### 独立 APK/IPA

```bash
# 构建独立应用
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

---

## 九、常见问题

### Q1: 无法连接 Backend

**问题:** API请求失败

**解决:**
```bash
# 检查 Backend 运行状态
curl http://localhost:8000/health

# 检查 API_BASE_URL 配置
grep API_BASE_URL lib/api-client/index.ts

# 真机测试需要使用局域网IP
# 修改为：http://192.168.x.x:8000
```

### Q2: iOS模拟器启动失败

**问题:** Xcode相关错误

**解决:**
```bash
# 确保Xcode安装
xcode-select --install

# 打开模拟器
open -a Simulator

# 重试
pnpm ios
```

### Q3: Android模拟器启动失败

**问题:** Android Studio相关错误

**解决:**
```bash
# 确保Android Studio安装
# 打开Android Studio > Tools > Device Manager

# 创建模拟器后运行
pnpm android
```

### Q4: Expo Go无法连接

**问题:** 真机无法连接开发服务器

**解决:**
```bash
# 使用隧道模式
pnpm expo start --tunnel

# 或使用局域网模式
pnpm expo start --lan
```

### Q5: 依赖安装失败

**问题:** pnpm install报错

**解决:**
```bash
# 清除缓存
pnpm store prune

# 删除node_modules
rm -rf node_modules

# 重装
pnpm install
```

### Q6: 热重载不生效

**问题:** 修改代码后页面不更新

**解决:**
```bash
# 在Expo CLI中按 r 强制重载
# 或清除缓存重启
pnpm expo start --clear
```

### Q7: React 版本冲突

**问题:** monorepo 中 React 版本不一致

**解决:**
```bash
# 使用独立目录运行
cp -r packages/mobile ~/openmaic-mobile
cd ~/openmaic-mobile
rm -rf node_modules
pnpm install
npx expo start
```

### Q8: Web 版本组件报错

**问题:** Skia 组件在 Web 不支持

**解决:** 项目已移除 @shopify/react-native-skia 依赖，使用标准 React Native 组件替代。

---

## 十、开发流程

### 1. 启动Backend

```bash
cd packages/server-python
docker-compose up -d
# 或
uvicorn app.main:app --reload
```

### 2. 启动移动端

```bash
cd packages/mobile
pnpm install
pnpm start
```

### 3. 选择平台

- 按 `i` 启动iOS模拟器
- 按 `a` 启动Android模拟器
- 按 `w` 启动Web版本
- 扫码在真机测试

### 4. 开发调试

- 修改代码自动热重载
- 按 `j` 打开调试菜单
- 按 `m` 打开开发菜单

---

## 相关文档

- [Expo 官方文档](https://docs.expo.dev/)
- [React Native 文档](https://reactnative.dev/)
- [项目 README](./README.md)

---

**最后更新:** 2026-04-18