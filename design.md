---
name: Palansoft
description: 柏兰软件 / 侧伴 品牌设计系统
colors:
  primary: "#1E40AF"
  secondary: "#64748B"
  tertiary: "#2563EB"
  neutral: "#F8FAFC"
  accent: "#F59E0B"
  success: "#10B981"
  danger: "#EF4444"
  text-primary: "#0F172A"
  text-secondary: "#475569"
  text-inverse: "#FFFFFF"
  background: "#FFFFFF"
  border: "#E2E8F0"
typography:
  h1:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: 2.5rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  h2:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: 1.75rem
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  h3:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: 1.25rem
    fontWeight: 600
    lineHeight: 1.4
  body-lg:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: 1.125rem
    fontWeight: 400
    lineHeight: 1.7
  body-md:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.05em"
rounded:
  sm: 6px
  md: 10px
  lg: 16px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-inverse}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 12px 24px
  button-primary-hover:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.text-inverse}"
    rounded: "{rounded.sm}"
    padding: 12px 24px
  button-secondary:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: 12px 24px
  card:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
    borderColor: "{colors.border}"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: 10px 14px
    borderColor: "{colors.border}"
  badge:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.text-inverse}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 4px 12px
---

## Overview

专业、可信赖的企业级软件品牌。视觉风格简洁克制，以蓝色为主色调传递科技感，琥珀色点缀用于关键操作。整体呈现干净、现代、专业的印象。

## Colors

- **Primary (#1E40AF):** 深蓝 — 品牌主色，用于标题、主要按钮、导航
- **Secondary (#64748B):** 石板灰 — 辅助文字、次要信息
- **Tertiary (#2563EB):** 亮蓝 — 悬停状态、链接、交互反馈
- **Neutral (#F8FAFC):** 冷白灰 — 背景底色，比纯白更柔和
- **Accent (#F59E0B):** 琥珀 — 强调色，用于徽章、通知、CTA
- **Success (#10B981):** 翠绿 — 成功状态、正向指标
- **Danger (#EF4444):** 红色 — 错误、警告、删除操作

## Typography

全体系使用 Inter 字体族，系统级 sans-serif 回退。

- 标题层级分明：H1 40px / H2 28px / H3 20px
- 正文行高宽松（1.6-1.7），保证长文可读性
- 标签使用大写字母 + 宽字间距，增强识别度

## Layout

- 内容区最大宽度 1200px，居中布局
- 间距遵循 4px 基准网格（4/8/16/24/32/48）
- 卡片间距 24px，内边距 24px

## Elevation & Depth

- 卡片使用 1px 边框 + 圆角 10px，不用阴影（扁平化）
- 按钮悬停通过颜色变化提供反馈
- 模态框使用半透明遮罩层

## Shapes

- 按钮：小圆角 6px
- 卡片：中圆角 10px
- 徽章/标签：完全圆角（胶囊形）
- 输入框：小圆角 6px

## Components

### 主按钮（Button Primary）
深蓝底白字，12px 上下 24px 左右内边距。悬停变为亮蓝。

### 次按钮（Button Secondary）
白底蓝字，12px 上下 24px 左右内边距。用于次要操作。

### 卡片（Card）
白底，10px 圆角，24px 内边距，1px 浅灰边框。

### 输入框（Input）
白底，6px 圆角，10px 上下 14px 左右内边距，1px 边框。

### 徽章（Badge）
琥珀色胶囊形，4px 上下 12px 左右，小字大写标签。

## Do's and Don'ts

**Do:**
- 使用蓝色系表达专业和信任
- 保持大量留白，不要拥挤
- 用琥珀色突出最重要的操作
- 保持字体层级清晰

**Don't:**
- 不要在正文中使用大写（仅标签用）
- 不要使用渐变或阴影（扁平化设计）
- 不要用红色作为品牌主色（仅用于错误）
- 不要在同一个页面使用超过 3 种颜色
