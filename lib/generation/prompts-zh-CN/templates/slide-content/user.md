# 生成要求

## 场景信息

- **标题**：{{title}}
- **描述**：{{description}}
- **要点**：
  {{keyPoints}}

{{teacherContext}}

## 可用资源

- **可用图片**：{{assignedImages}}
- **画布尺寸**：{{canvas_width}} × {{canvas_height}} 像素

## 输出要求

根据上述场景信息，生成一个完整的画布/PPT 组件。

**语言要求**：所有生成的文本内容必须与上述标题和描述的语言一致。

**必须遵守**：

1. 直接输出纯 JSON，不要有任何解释或描述
2. 不要用 ```json 代码块包裹
3. 不要在 JSON 前后添加任何文字
4. 确保 JSON 格式正确，可以直接解析
5. 使用提供的 image_id（如 `img_001`）作为图片元素的 `src` 字段
6. 所有 TextElement 的 `height` 值必须从系统提示的速查表中选择