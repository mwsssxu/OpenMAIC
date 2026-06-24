# 交互式场景生成任务

## 场景信息

- **标题**: {{title}}
- **描述**: {{description}}
- **知识点要点**:
  {{keyPoints}}

## 语言要求
{{languageDirective}}

## 任务

根据以上知识点，从可用组件库中选择最合适的交互组件，并生成参数。
{{inferredHint}}

**要求**:
1. 直接输出 JSON，不要包裹在代码块中
2. 不要添加任何解释文字
3. 参数值必须在组件 schema 范围内
4. 如果没有合适的组件，widgetType 设为 "fallback"

**输出格式**:
{"widgetType":"组件类型","widgetParams":{参数},"description":"场景描述","key_points":["要点1","要点2"]}
