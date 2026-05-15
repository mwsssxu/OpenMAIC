# EduDash Mobile UI Design Standard

## Overview
This document defines the UI design standards for EduDash mobile application, extracted from the reference HTML design file. All mobile UI components should follow these guidelines to ensure visual consistency.

---

## 1. Color System

### Primary Colors
| Color Name | Light Mode | Dark Mode | Usage |
|------------|------------|-----------|-------|
| Primary | `#ec5b13` | `#ec5b13` | Brand color, accents, CTAs, active states |
| Background | `#f8f6f6` | `#221610` | Main background color |

### Semantic Colors (Stats & Status)
| Category | Light Background | Light Icon | Dark Background | Dark Icon | Usage |
|----------|------------------|------------|-----------------|-----------|-------|
| Blue | `bg-blue-100` | `text-blue-600` | `bg-blue-900/30` | `text-blue-400` | Students, info, general stats |
| Orange | `bg-orange-100` | `text-orange-600` | `bg-orange-900/30` | `text-orange-400` | Time/schedule, homework |
| Green | `bg-green-100` | `text-green-600` | `bg-green-900/30` | `text-green-400` | Success, renewal, positive trends |
| Purple | `bg-purple-100` | `text-purple-600` | `bg-purple-900/30` | `text-purple-400` | Loss/churn metrics |
| Red | `bg-red-100` | `text-red-600` | `bg-red-900/30` | `text-red-400` | Urgent, exams, critical |
| Teal | `bg-teal-500/10` | `text-teal-600` | `bg-teal-500/10` | `text-teal-600` | Courses |
| Indigo | `bg-indigo-500/10` | `text-indigo-600` | `bg-indigo-500/10` | `text-indigo-600` | Attendance |
| Pink | `bg-pink-500/10` | `text-pink-600` | `bg-pink-500/10` | `text-pink-600` | Performance monitoring |
| Amber | `bg-amber-500/10` | `text-amber-600` | `bg-amber-500/10` | `text-amber-600` | Reports, ongoing status |

### Text Colors
| Element | Light Mode | Dark Mode |
|---------|------------|-----------|
| Primary Text | `text-slate-900` | `text-white` |
| Secondary Text | `text-slate-500` | `text-slate-400` |
| Muted Text | `text-slate-600` | `text-slate-300` |
| Placeholder | `text-slate-400` | `text-slate-400` |
| Label Text | `text-sm text-slate-500` | `text-sm text-slate-400` |

### Border Colors
| Context | Light Mode | Dark Mode |
|---------|------------|-----------|
| Default Border | `border-slate-100` | `border-slate-700` |
| Hover Border | `border-primary/30` | `border-primary/30` |
| Active Border | `border-primary/40` | `border-primary/40` |
| Divider | `divide-slate-100` | `divide-slate-700` |

### Background Decorations
- Primary glow: `bg-primary/10` with `blur-[120px]` at `-top-[10%] -left-[10%]`
- Blue glow: `bg-blue-500/10` with `blur-[100px]` at `top-[20%] -right-[5%]`
- Green glow: `bg-green-500/10` with `blur-[80px]` at `bottom-[10%] left-[20%]`

---

## 2. Typography

### Font Family
- Primary: `Public Sans` (weights: 300, 400, 500, 600, 700, 800)
- Icons: `Material Symbols Outlined`

### Font Sizes
| Element | Size | Weight | Example |
|---------|------|--------|---------|
| Page Title | `text-3xl` | `font-extrabold` | "Good Morning, Admin 👋" |
| Section Title | `text-lg` | `font-bold` | "Today's Tasks", "Active Courses" |
| Card Title | `text-xl` | `font-bold` | "EduDash" (header) |
| Stat Value | `text-2xl` | `font-bold` | "1,284", "452h" |
| Feature Title | `text-4xl` | `font-extrabold` | "864" (gradient card) |
| Body Text | `text-sm` | `font-bold` | Button labels, task titles |
| Label Text | `text-xs` | `font-medium` | "Total Students", time labels |
| Badge Text | `text-[10px]` | `font-bold` | Status badges |
| Caption | `text-xs` | `font-medium` | Subtitles, descriptions |

### Font Weight Usage
- `font-light (300)`: Not used in this design
- `font-normal (400)`: Not used in this design
- `font-medium (500)`: Labels, descriptions, card subtitles
- `font-semibold (600)`: "View All" links, section labels
- `font-bold (700)`: Most titles, button text, stat labels
- `font-extrabold (800)`: Page titles, large numbers

### Letter Spacing & Transform
- Uppercase labels: `uppercase tracking-wider` (e.g., "Overview")
- Tight titles: `tracking-tight` (e.g., "EduDash")

---

## 3. Spacing & Layout

### Padding Standards
| Component | Padding Value | Example |
|-----------|---------------|---------|
| Page Container | `px-4 sm:px-6 lg:px-8 py-8` | Main content area |
| Header | `px-4 sm:px-6 lg:px-8` | Top nav bar |
| Stat Card | `p-6` | Dashboard stats |
| Feature Button | `p-4` | Quick management grid |
| Task Item | `p-4` | Task list rows |
| Gradient Card | `p-6` | Side insight card |
| Icon Container | `p-2` | Header logo box |
| Icon Badge | `p-3` | Stat icon backgrounds |
| Input Field | `py-3` | Search input |
| Badge | `px-2 py-1` | Status badges |

### Margin Standards
| Context | Margin Value |
|---------|--------------|
| Section Gap | `gap-8` (py-8 equivalent) |
| Card Gap | `gap-4` |
| Item Gap | `gap-4` (horizontal) |
| Icon Gap | `gap-3` |
| Stat Gap | `gap-4` |
| Text Gap | `gap-2` (number + percentage) |
| Title Bottom | `mb-1` (subtitle) |
| Section Title Bottom | `mb-6` |

### Container Max Width
- Main container: `max-w-7xl mx-auto`
- Search input: `w-full md:max-w-md`

---

## 4. Border Radius

### Standard Values
| Component | Radius | Tailwind Class |
|-----------|--------|----------------|
| Default | `0.25rem` (4px) | `rounded` |
| Medium | `0.5rem` (8px) | `rounded-lg` |
| Large | `0.75rem` (12px) | `rounded-xl` |
| Extra Large | `1rem` (16px) | `rounded-2xl` |
| Full/Circle | `9999px` | `rounded-full` |

### Component Radius
| Component | Radius Class |
|-----------|--------------|
| Cards/Stat Boxes | `rounded-xl` |
| Feature Buttons | `rounded-2xl` |
| Icon Backgrounds | `rounded-xl` |
| Avatar | `rounded-full` |
| Buttons | `rounded-xl` |
| Input Fields | `rounded-xl` |
| Badges/Tags | `rounded-full` |
| Time Badge | `rounded-xl` |
| FAB Button | `rounded-full` |

---

## 5. Shadows

### Shadow Types
| Context | Shadow Class | Usage |
|---------|--------------|-------|
| Cards | `shadow-sm` | Stat cards, task cards |
| Hover Cards | `shadow-md` | Active/hover state |
| FAB | `shadow-xl` | Floating action button |
| Gradient Card | `shadow-lg` | Featured card |
| Buttons (FAB menu) | `shadow-lg` | Expanded menu items |

---

## 6. Component Specifications

### Header/Navigation Bar
- Height: `h-16`
- Background: `bg-white/80 dark:bg-background-dark/80`
- Blur: `backdrop-blur-md`
- Border: `border-b border-slate-200 dark:border-slate-800`
- Position: `sticky top-0 z-50`
- Logo container: `bg-primary/10 p-2 rounded-lg`
- Notification badge: Ping animation `animate-ping`

### Stat Cards
- Background: `bg-white dark:bg-slate-800`
- Padding: `p-6`
- Radius: `rounded-xl`
- Shadow: `shadow-sm`
- Border: `border border-slate-100 dark:border-slate-700`
- Hover: `hover:border-primary/30 transition-all`
- Layout: `flex items-center gap-4`
- Icon container: `p-3 rounded-xl` with semantic color

### Feature Buttons (Quick Management)
- Layout: `flex flex-col items-center gap-3`
- Padding: `p-4`
- Background: `bg-white dark:bg-slate-800`
- Radius: `rounded-2xl`
- Shadow: `shadow-sm`
- Border: `border border-slate-100 dark:border-slate-700`
- Hover: `hover:shadow-md hover:border-primary/40`
- Active: `active:scale-95`
- Icon box: `w-12 h-12 rounded-xl`
- Icon hover: `group-hover:bg-[color] group-hover:text-white`

### Task List Items
- Container: `bg-white dark:bg-slate-800 rounded-2xl`
- Item padding: `p-4`
- Layout: `flex items-center gap-4`
- Time badge: `w-12 h-12 rounded-xl flex items-center justify-center flex-col`
- Hover: `hover:bg-slate-50 dark:hover:bg-slate-700/50`
- Divider: `divide-y divide-slate-100 dark:divide-slate-700`

### Search Input
- Container: `relative`
- Height: `py-3`
- Padding: `pl-11 pr-4` (icon offset)
- Background: `bg-white dark:bg-slate-800`
- Border: `border-none`
- Radius: `rounded-xl`
- Shadow: `shadow-sm`
- Focus: `focus:ring-2 focus:ring-primary/50`
- Icon position: `absolute inset-y-0 left-0 pl-4`

### Gradient Featured Card
- Gradient: `bg-gradient-to-br from-primary to-orange-600`
- Radius: `rounded-2xl`
- Padding: `p-6`
- Shadow: `shadow-lg`
- Text: `text-white`
- Icon decoration: `absolute -right-4 -top-4 opacity-10`
- Icon hover: `group-hover:scale-110 transition-transform duration-500`
- Progress bar: `bg-white/20` container, `bg-white` fill
- Button: `bg-white/20 backdrop-blur-sm hover:bg-white/30`

### Floating Action Button (FAB)
- Position: `fixed bottom-8 right-8 z-[100]`
- Size: `h-16 w-16`
- Radius: `rounded-full`
- Background: `bg-primary`
- Shadow: `shadow-xl`
- Hover: `hover:scale-110 hover:rotate-90`
- Icon: `text-3xl`
- Menu items: `bg-white dark:bg-slate-800 rounded-xl shadow-lg border`

### Avatar
- Size: `h-10 w-10`
- Radius: `rounded-full`
- Border: `border-2 border-primary/20`
- Image: `object-cover`

### Status Badges
- Padding: `px-2 py-1`
- Radius: `rounded-full`
- Font: `text-[10px] font-bold uppercase`
- Colors by status:
  - Urgent: `bg-red-500 text-white`
  - Routine: `bg-blue-100 text-blue-600`
  - Ongoing: `bg-amber-100 text-amber-600`

### Percentage Badge
- Font: `text-xs font-bold`
- Positive: `text-green-500`
- Negative: `text-red-500`

---

## 7. Animation & Transitions

### Standard Transitions
| Context | Transition Class | Duration |
|---------|------------------|----------|
| Color change | `transition-colors` | Default |
| All properties | `transition-all` | Default |
| Transform | `transition-transform` | Default |
| Opacity | `transition-opacity` | Default |
| Icon decoration | `transition-transform duration-500` | 500ms |

### Hover Effects
| Component | Hover Effect |
|-----------|--------------|
| Cards | `hover:border-primary/30 hover:bg-slate-50` |
| Buttons | `hover:shadow-md hover:border-primary/40` |
| FAB | `hover:scale-110 hover:rotate-90` |
| Icon container | `group-hover:bg-[color] group-hover:text-white` |
| Gradient icon | `group-hover:scale-110` |
| Links | `hover:underline` |
| Inputs | `group-focus-within:text-primary` |

### Active Effects
| Component | Active Effect |
|-----------|--------------|
| Buttons | `active:scale-95` |

### Animations
| Animation | Usage |
|-----------|-------|
| `animate-ping` | Notification badge ping effect |

---

## 8. Z-Index Levels

| Component | Z-Index |
|-----------|---------|
| Background decoration | `-z-10` |
| Header | `z-50` |
| FAB | `z-[100]` |

---

## 9. Icon Standards

### Icon Font
- Use `Material Symbols Outlined` from Google Fonts
- Icon size standard: `text-2xl` (header), default (card icons)
- Large decoration: `text-[120px]` (gradient card background)

### Icon Colors
- Match semantic color category
- Hover state: icon container changes to solid color with white text

### Icon Container Sizes
| Context | Size |
|---------|------|
| Header logo | `p-2` |
| Stat card | `p-3 rounded-xl` |
| Feature button | `w-12 h-12 rounded-xl` |
| Time badge | `w-12 h-12 rounded-xl` |
| FAB | `text-3xl` |

---

## 10. Responsive Grid

### Grid Patterns
| Section | Mobile | Tablet (sm) | Desktop (lg) |
|---------|--------|-------------|--------------|
| Stats Grid | 1 col | 2 cols | 4 cols |
| Features Grid | 2 cols | 4 cols | 8 cols |
| Tasks/Activity | 1 col | 1 col | 3 cols (2:1 ratio) |

### Container Padding by Screen
| Screen | Padding |
|--------|---------|
| Mobile | `px-4` |
| Tablet (sm) | `px-6` |
| Desktop (lg) | `px-8` |

---

## 11. Dark Mode Guidelines

### Implementation
- Use `dark:` prefix for all dark mode variants
- Toggle via `class="dark"` on `<html>` element

### Key Dark Mode Changes
| Element | Light | Dark |
|---------|-------|------|
| Background | `bg-background-light` | `bg-background-dark` |
| Cards | `bg-white` | `bg-slate-800` |
| Borders | `border-slate-100` | `border-slate-700` |
| Text primary | `text-slate-900` | `text-white` |
| Text secondary | `text-slate-500` | `text-slate-400` |
| Icon backgrounds | `bg-[color]-100` | `bg-[color]-900/30` |
| Icon text | `text-[color]-600` | `text-[color]-400` |
| Hover background | `hover:bg-slate-50` | `hover:bg-slate-700/50` |

---

## 12. Best Practices

### Do's
1. Use semantic colors consistently (blue for students, orange for time, etc.)
2. Apply proper padding hierarchy (page → section → component)
3. Maintain consistent radius (xl for cards, 2xl for feature buttons)
4. Use Material Symbols Outlined for all icons
5. Include dark mode variants for all components
6. Apply subtle shadows (sm/md/lg) for depth
7. Use hover transitions for interactive feedback
8. Keep typography hierarchy clear (size + weight combinations)

### Don'ts
1. Don't mix radius styles within same component type
2. Don't use arbitrary colors outside semantic palette
3. Don't skip dark mode variants
4. Don't use heavy shadows on small components
5. Don't override font family (stay with Public Sans)

---

## 13. Quick Reference - Tailwind Classes

### Card Base Classes
```
bg-white dark:bg-slate-800 
p-6 
rounded-xl 
shadow-sm 
border border-slate-100 dark:border-slate-700
```

### Button Base Classes
```
flex flex-col items-center gap-3 
p-4 
bg-white dark:bg-slate-800 
rounded-2xl 
shadow-sm 
border border-slate-100 dark:border-slate-700
hover:shadow-md hover:border-primary/40 
transition-all 
active:scale-95
```

### Input Base Classes
```
block w-full 
pl-11 pr-4 py-3 
bg-white dark:bg-slate-800 
border-none 
rounded-xl 
shadow-sm 
focus:ring-2 focus:ring-primary/50
text-slate-900 dark:text-white 
placeholder-slate-400
```

### Badge Base Classes
```
px-2 py-1 
text-[10px] font-bold uppercase 
rounded-full
```

---

## Appendix: Color Semantic Mapping

| Domain | Primary Color | Icon | Background Light | Background Dark |
|--------|---------------|------|------------------|-----------------|
| Class/Room | Primary (#ec5b13) | meeting_room | primary/10 | primary/10 |
| Student | Blue | person | blue-500/10 | blue-500/10 |
| Course | Teal | menu_book | teal-500/10 | teal-500/10 |
| Attendance | Indigo | how_to_reg | indigo-500/10 | indigo-500/10 |
| Homework | Orange | assignment | orange-500/10 | orange-500/10 |
| Exam | Red | quiz | red-500/10 | red-500/10 |
| Performance | Pink | monitoring | pink-500/10 | pink-500/10 |
| Report | Amber | description | amber-500/10 | amber-500/10 |

---

*Document Version: 1.0*
*Last Updated: 2026-05-15*
*Source: packages/mobile/html/index.html*