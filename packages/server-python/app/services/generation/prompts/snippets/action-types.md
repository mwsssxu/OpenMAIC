## 动作类型定义

动作以 JSON 数组中的对象形式表示。每个对象都有一个 `type` 字段。

### speech - 语音旁白

```json
{ "type": "text", "content": "旁白内容" }
```

### spotlight - 聚焦元素

```json
{
  "type": "action",
  "name": "spotlight",
  "params": { "elementId": "元素ID" }
}
```

### laser - 激光笔

```json
{ "type": "action", "name": "laser", "params": { "elementId": "元素ID" } }
```

### discussion - 互动讨论

```json
{
  "type": "action",
  "name": "discussion",
  "params": { "topic": "讨论主题", "prompt": "引导提示" }
}
```

### whiteboard - 白板绘图

白板是语音讲解的核心视觉辅助。当需要展示推导过程、概念关系、步骤流程等**幻灯片无法充分表达的过程性内容**时，使用白板动作。

**原则**：白板用于展示过程，不是重复幻灯片内容。如果幻灯片已有该信息，用 spotlight 聚焦即可。

#### wb_open - 打开白板

在绘制白板内容前调用一次（不需要每次绘制前都调用）。

```json
{ "type": "action", "name": "wb_open", "params": {} }
```

#### wb_draw_text - 绘制文本

用于标注、步骤说明、关键结论。**不要用于数学公式**（用 wb_draw_latex）。

```json
{ "type": "action", "name": "wb_draw_text", "params": { "content": "推导步骤", "x": 60, "y": 60, "width": 600, "height": 43, "fontSize": 18, "color": "#333333" } }
```

#### wb_draw_shape - 绘制形状

用于分组框、流程图节点等。

```json
{ "type": "action", "name": "wb_draw_shape", "params": { "shape": "rectangle", "x": 60, "y": 200, "width": 200, "height": 100, "fillColor": "#5b9bd5" } }
```

#### wb_draw_line - 绘制线条/箭头

```json
{ "type": "action", "name": "wb_draw_line", "params": { "startX": 100, "startY": 300, "endX": 400, "endY": 300, "color": "#333333", "width": 2, "points": ["", "arrow"] } }
```

#### wb_draw_latex - 绘制数学公式

**必须用于所有数学表达式**，不要在 wb_draw_text 中写 LaTeX。

```json
{ "type": "action", "name": "wb_draw_latex", "params": { "latex": "\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}", "x": 100, "y": 80, "height": 80 } }
```

> **注意**：JSON字符串中每个 LaTeX 反斜杠必须写成 `\\`（双反斜杠）。详见下方 whiteboard-reference 的 "LaTeX JSON Escape" 章节。

#### wb_draw_chart - 绘制图表

```json
{ "type": "action", "name": "wb_draw_chart", "params": { "chartType": "bar", "x": 100, "y": 150, "width": 500, "height": 300, "data": { "labels": ["Q1", "Q2", "Q3"], "legends": ["Sales"], "series": [[100, 120, 140]] } } }
```

#### wb_draw_table - 绘制表格

```json
{ "type": "action", "name": "wb_draw_table", "params": { "x": 100, "y": 200, "width": 500, "height": 150, "data": [["变量", "含义"], ["a", "系数"]] } }
```

#### wb_draw_code - 绘制代码块

```json
{ "type": "action", "name": "wb_draw_code", "params": { "language": "python", "code": "def hello():\n    print('world')", "x": 100, "y": 120, "width": 500, "height": 120 } }
```

#### wb_clear - 清空白板

```json
{ "type": "action", "name": "wb_clear", "params": {} }
```

#### wb_close - 关闭白板

```json
{ "type": "action", "name": "wb_close", "params": {} }
```

{{snippet:whiteboard-reference}}
