# 修复验证计划

## 问题根源
移动端使用流式endpoint `/generate/outlines-stream`，该endpoint的简化prompt只生成title/type/description，**不生成key_points**，导致场景内容模板化。

## 修复方案
修改流式endpoint，使其调用`generate_single_outline`为每个大纲生成完整内容（包含丰富的key_points），与Web端保持一致。

## 关键修改文件
- `packages/server-python/app/routes/generate.py`
  - 导入`generate_single_outline`函数
  - 修改流式生成逻辑，为每个大纲调用完整生成函数

## 测试步骤

### 1. 重启Python服务器
```bash
cd packages/server-python
# 如果使用scripts/restart-python.sh
../../scripts/restart-python.sh

# 或手动重启
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. 测试移动端大纲生成

#### 测试需求示例
输入："为初中生创建一个关于光合作用的生物课程"

#### 预期结果（修复后）
```json
{
  "title": "光合作用基础概念",
  "key_points": [
    "光合作用的定义和重要性",
    "光合作用发生的场所：叶绿体",
    "光合作用的两个阶段：光反应和暗反应",
    "光合作用所需的条件：光、水、二氧化碳",
    "光合作用的产物：氧气和有机物"
  ]
}
```

#### 对比修复前（模板化）
```json
{
  "title": "光合作用课程简介",
  "key_points": [
    "课程主题概述",  // ❌ 模板化
    "学习目标说明",  // ❌ 模板化
    "课程结构介绍"   // ❌ 模板化
  ]
}
```

### 3. 验证场景内容质量

修复后，场景生成应该能够：
- 使用丰富的key_points生成详细讲解
- LLM能够扩展每个要点，提供背景知识、举例说明
- 不触发fallback机制

预期speech内容：
```
"光合作用是植物利用光能将二氧化碳和水转化为有机物的过程。这个过程发生在植物的叶绿体中..."
```

对比修复前（模板化）：
```
"第1个要点：课程主题概述。这是本节课程的核心内容之一，请重点关注。" // ❌ 模板化
```

### 4. 查看日志验证

检查服务器日志，应该看到：
```
[SSE] 大纲 #1 生成完整内容 - 光合作用基础概念, key_points=5
[Scene] LLM生成Actions成功 (15个)
```

不应看到：
```
[Scene] Actions生成失败，使用fallback  // ❌ 表示fallback触发
```

## 性能影响评估

### 时间开销
- **修复前**：仅生成标题列表，每个大纲0秒（无详细生成）
- **修复后**：每个大纲单独调用LLM生成详细内容，约3-5秒/大纲
- **总耗时**：5个大纲约增加15-25秒

### 用户体验影响
- **正面**：获得高质量教学内容，符合教学需求
- **负面**：生成时间略有增加
- **建议**：显示进度提示"正在生成详细内容..."缓解等待感

## Web端一致性验证

Web端使用 `/generate/outlines` endpoint（非流式），该endpoint：
- 使用完整的prompt模板（requirements-to-outlines/system.md）
- 已经生成完整的key_points
- 无需修改

移动端修复后，两端应产生相同质量的内容。

## 后续优化建议

1. **添加进度提示**：在移动端UI显示"正在生成详细大纲..."
2. **性能优化**：考虑并行生成多个大纲（需评估LLM并发限制）
3. **缓存策略**：相同需求的大纲可缓存复用

## 测试完成标准

✅ 大纲包含丰富、具体的key_points（非模板化）
✅ 场景讲解内容详细、有价值（非模板化）
✅ 日志显示LLM生成成功，无fallback触发
✅ 移动端与Web端内容质量一致