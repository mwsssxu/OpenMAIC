# EduDash 资源清单

## 目录结构

```
packages/mobile/assets/
├── fonts/                      # 字体资源
│   ├── PublicSans.css         # Google Fonts CSS 引用
│   ├── PublicSans-Light.ttf   # Light (300)
│   ├── PublicSans-Regular.ttf # Regular (400)
│   ├── PublicSans-Medium.ttf  # Medium (500)
│   ├── PublicSans-SemiBold.ttf # SemiBold (600)
│   ├── PublicSans-Bold.ttf    # Bold (700)
│   └── PublicSans-ExtraBold.ttf # ExtraBold (800)
├── icons/                      # 图标字体
│   ├── MaterialSymbolsOutlined.css # Google Fonts CSS 引用
│   ├── MaterialSymbolsOutlined-Regular.ttf
│   ├── MaterialSymbolsOutlined-Medium.ttf
│   ├── MaterialSymbolsOutlined-SemiBold.ttf
│   └── MaterialSymbolsOutlined-Bold.ttf
├── tailwind.config.js          # Tailwind 配置
├── edudash.css                 # CSS 变量和组件样式
└── README.md                   # 本文档
```

---

## 字体资源

### Public Sans 字体
- **来源**: Google Fonts
- **用途**: 主字体，用于标题、正文、按钮等
- **字重**: 300 (Light), 400 (Regular), 500 (Medium), 600 (SemiBold), 700 (Bold), 800 (ExtraBold)
- **文件大小**: 每个约 56KB

### Material Symbols Outlined
- **来源**: Google Fonts
- **用途**: 图标字体
- **字重**: 400, 500, 600, 700
- **文件大小**: 每个约 957KB
- **图标列表** (HTML 中使用的):
  - school, notifications, search, group, schedule, autorenew, trending_down
  - meeting_room, person, menu_book, how_to_reg, assignment, quiz, monitoring, description
  - add, person_add, event_note, auto_stories

---

## CSS 配置

### Tailwind 配置 (tailwind.config.js)
```javascript
colors: {
  primary: "#ec5b13",
  background-light: "#f8f6f6",
  background-dark: "#221610",
}
fontFamily: {
  display: ["Public Sans"]
}
borderRadius: {
  DEFAULT: "0.25rem",
  lg: "0.5rem",
  xl: "0.75rem",
  full: "9999px"
}
```

### CSS 变量 (edudash.css)
- 主色调: `--color-primary: #ec5b13`
- 背景: `--color-background-light`, `--color-background-dark`
- 语义色: blue, orange, green, purple, red, teal, indigo, pink, amber
- 圆角: sm(4px), md(8px), lg(12px), xl(16px), 2xl(24px), full
- 阴影: sm, md, lg, xl

---

## React Native 使用说明

### 加载字体
```typescript
import { useFonts } from 'expo-font';

// 在 App 组件中
const [fontsLoaded] = useFonts({
  'PublicSans-Light': require('./assets/fonts/PublicSans-Light.ttf'),
  'PublicSans-Regular': require('./assets/fonts/PublicSans-Regular.ttf'),
  'PublicSans-Medium': require('./assets/fonts/PublicSans-Medium.ttf'),
  'PublicSans-SemiBold': require('./assets/fonts/PublicSans-SemiBold.ttf'),
  'PublicSans-Bold': require('./assets/fonts/PublicSans-Bold.ttf'),
  'PublicSans-ExtraBold': require('./assets/fonts/PublicSans-ExtraBold.ttf'),
  'MaterialSymbols': require('./assets/icons/MaterialSymbolsOutlined-Regular.ttf'),
});

if (!fontsLoaded) return null;
```

### 使用字体样式
```typescript
const styles = StyleSheet.create({
  title: {
    fontFamily: 'PublicSans-Bold',
    fontSize: 24,
    fontWeight: '700',
  },
  body: {
    fontFamily: 'PublicSans-Regular',
    fontSize: 16,
  },
});
```

### Material Symbols 图标
注意: React Native 不直接支持图标字体方式使用 Material Symbols。
推荐替代方案:
1. **@expo/vector-icons** - 使用 Ionicons/MaterialIcons/MaterialCommunityIcons
2. **react-native-vector-icons** - 配置 Material Icons
3. **SVG 图标** - 从 https://fonts.google.com/icons 下载 SVG

---

## 颜色映射到 React Native

```typescript
// lib/constants/theme.ts 中添加 EduDash 颜色
export const EduDashColors = {
  primary: '#ec5b13',
  background: {
    light: '#f8f6f6',
    dark: '#221610',
  },
  semantic: {
    blue: '#2563EB',
    orange: '#F59E0B',
    green: '#10B981',
    purple: '#8B5CF6',
    red: '#EF4444',
    teal: '#14B8A6',
    indigo: '#6366F1',
    pink: '#EC4899',
    amber: '#F59E0B',
  },
};
```

---

## 更新资源

如果需要更新字体到最新版本，重新执行:

```bash
# Public Sans
curl -s "https://fonts.googleapis.com/css2?family=Public+Sans:wght@300;400;500;600;700;800&display=swap" > assets/fonts/PublicSans.css
# 根据 CSS 中的 URL 下载 TTF 文件

# Material Symbols
curl -s "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700" > assets/icons/MaterialSymbolsOutlined.css
# 根据 CSS 中的 URL 下载 TTF 文件
```

---

*文档版本: 1.0*
*创建日期: 2026-05-15*