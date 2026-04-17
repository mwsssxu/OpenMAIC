# 数据类型定义

## 用户类型

### User

```typescript
interface User {
  id: string; // UUID
  email: string;
  nickname?: string;
  avatar_url?: string;
  invitation_code: string;
  invited_by?: string; // UUID
  created_at: string; // ISO 8601
  updated_at?: string; // ISO 8601
}
```

### AuthResponse

```typescript
interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}
```

## 课程类型

### Classroom

```typescript
interface Classroom {
  id: string; // UUID
  user_id: string; // UUID
  title: string;
  description?: string;
  outline: OutlineItem[];
  scenes: Scene[];
  status: 'draft' | 'generating' | 'completed';
  created_at: string; // ISO 8601
  updated_at?: string; // ISO 8601
}
```

### OutlineItem

```typescript
interface OutlineItem {
  id: string; // UUID
  title: string;
  type: 'chapter' | 'section' | 'interactive' | 'quiz';
  children?: OutlineItem[];
}
```

### Scene

```typescript
interface Scene {
  id: string; // UUID
  type: 'slide' | 'quiz' | 'interactive' | 'pbl';
  title: string;
  content: SlideContent | QuizContent | InteractiveContent | PBLContent;
  position: number;
  duration?: number; // seconds
}
```

### SlideContent

```typescript
interface SlideContent {
  elements: SlideElement[];
  audio_url?: string;
  notes?: string;
}
```

### SlideElement

```typescript
interface SlideElement {
  id: string; // UUID
  type: 'text' | 'shape' | 'image' | 'chart' | 'latex' | 'table';
  content?: string;
  position: {
    left: number;
    top: number;
    width?: number;
    height?: number;
  };
  style?: {
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
  };
}
```

### QuizContent

```typescript
interface QuizContent {
  question: string;
  options: QuizOption[];
  correct_answer: number; // index
  explanation?: string;
}
```

### QuizOption

```typescript
interface QuizOption {
  id: string; // UUID
  text: string;
  is_correct: boolean;
}
```

## Token/积分类型

### TokenAccount

```typescript
interface TokenAccount {
  id: string; // UUID
  user_id: string; // UUID
  balance: number;
  created_at: string; // ISO 8601
  updated_at?: string; // ISO 8601
}
```

### PointAccount

```typescript
interface PointAccount {
  id: string; // UUID
  user_id: string; // UUID
  balance: number;
  created_at: string; // ISO 8601
  updated_at?: string; // ISO 8601
}
```

### TokenTransaction

```typescript
interface TokenTransaction {
  id: string; // UUID
  user_id: string; // UUID
  type: 'purchase' | 'exchange' | 'spend' | 'reward';
  amount: number;
  balance_after: number;
  description?: string;
  created_at: string; // ISO 8601
}
```

### PointTransaction

```typescript
interface PointTransaction {
  id: string; // UUID
  user_id: string; // UUID
  source: 'course' | 'daily' | 'qanda' | 'notes' | 'invitation';
  amount: number;
  balance_after: number;
  created_at: string; // ISO 8601
}
```

## 问答类型

### Question

```typescript
interface Question {
  id: string; // UUID
  user_id: string; // UUID
  title: string;
  content: string;
  category: 'market' | 'finance' | 'competition' | 'risk' | 'strategy';
  bounty: number; // 积分
  status: 'open' | 'answered' | 'resolved';
  answers?: Answer[];
  created_at: string; // ISO 8601
}
```

### Answer

```typescript
interface Answer {
  id: string; // UUID
  question_id: string; // UUID
  user_id: string; // UUID
  content: string;
  is_accepted: boolean;
  rating?: number; // 1-5
  created_at: string; // ISO 8601
}
```

## 笔记类型

### Note

```typescript
interface Note {
  id: string; // UUID
  user_id: string; // UUID
  classroom_id?: string; // UUID
  content: string; // Markdown
  visibility: 'public' | 'paid' | 'match';
  price?: number; // 积分
  rating?: number; // 1-5
  purchases?: number;
  created_at: string; // ISO 8601
}
```

## 游戏化类型

### Streak

```typescript
interface Streak {
  id: string; // UUID
  user_id: string; // UUID
  checkin_date: string; // YYYY-MM-DD
  streak_count: number; // 连续天数
  created_at: string; // ISO 8601
}
```

### Task

```typescript
interface Task {
  id: string; // UUID
  user_id: string; // UUID
  task_type: 'course' | 'discussion' | 'answer' | 'learning_time';
  is_completed: boolean;
  reward: number; // 积分
  created_at: string; // ISO 8601
}
```

### League

```typescript
interface League {
  id: string; // UUID
  user_id: string; // UUID
  level: 'bronze' | 'silver' | 'gold' | 'diamond' | 'master' | 'champion';
  points: number;
  week_rank?: number;
  created_at: string; // ISO 8601
}
```

### Badge

```typescript
interface Badge {
  id: string; // UUID
  user_id: string; // UUID
  badge_type: 'learning_10' | 'streak_30' | 'invitation_10' | 'answer_20' | 'first_purchase' | 'annual_active';
  unlocked_at: string; // ISO 8601
}
```

## 学习搭子类型

### Buddy

```typescript
interface Buddy {
  id: string; // UUID
  user_id: string; // UUID
  buddy_type: 'encourager' | 'challenger' | 'listener' | 'critic' | 'scholar' | 'partner';
  name: string;
  avatar_url?: string;
  progress?: number; // 虚拟学习进度
  created_at: string; // ISO 8601
}
```

### BuddyMessage

```typescript
interface BuddyMessage {
  id: string; // UUID
  buddy_id: string; // UUID
  trigger: 'checkin' | 'task_complete' | 'streak_break' | 'inactive';
  message: string;
  emotion: 'positive' | 'neutral' | 'negative';
  created_at: string; // ISO 8601
}
```

## 协作类型

### CollaborationMessage

```typescript
interface CollaborationMessage {
  type: 'join' | 'leave' | 'whiteboard_update' | 'chat_message' | 'user_join' | 'user_leave' | 'note_update';
  classroom_id: string; // UUID
  user_id: string; // UUID
  data?: WhiteboardUpdate | ChatMessage | NoteUpdate;
  timestamp: number; // milliseconds
}
```

### WhiteboardUpdate

```typescript
interface WhiteboardUpdate {
  operation: 'draw' | 'erase' | 'clear';
  tool: 'pen' | 'text' | 'shape' | 'chart' | 'eraser';
  points?: Array<{x: number, y: number}>;
  text?: string;
  shape?: 'rect' | 'circle' | 'arrow';
  color?: string;
  width?: number;
}
```

### ChatMessage

```typescript
interface ChatMessage {
  content: string;
  mentions?: string[]; // user IDs
  reactions?: Array<{emoji: string, user_ids: string[]}>;
}
```

## 支付类型

### Order

```typescript
interface Order {
  id: string; // UUID
  user_id: string; // UUID
  amount: number; // 金额
  token_amount: number; // Token数量
  payment_method: 'wechat' | 'alipay';
  status: 'created' | 'paid' | 'cancelled';
  created_at: string; // ISO 8601
}
```

## API 响应类型

### ApiResponse<T>

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiError;
}
```

### ApiError

```typescript
interface ApiError {
  code: string;
  message: string;
  details?: Array<{field: string, message: string}>;
}
```

### PaginationResponse<T>

```typescript
interface PaginationResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```