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
