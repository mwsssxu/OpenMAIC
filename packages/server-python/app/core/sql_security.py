"""
SQL 安全指南 - 动态SQL拼接防护

在 OpenMAIC Business 中，部分查询使用动态SQL拼接以支持灵活的过滤条件。
以下是安全使用动态SQL的规则：

## 安全规则

### 1. 字段名白名单
动态拼接的字段名必须来自预定义的白名单，绝不能来自用户输入。

```python
ALLOWED_FILTER_FIELDS = {"email", "nickname", "subscription_tier", "is_active"}

# 安全示例
for field in filters:
    if field not in ALLOWED_FILTER_FIELDS:
        raise HTTPException(status_code=400, detail=f"Invalid field: {field}")
    conditions.append(f"{field} = ${idx}")
```

### 2. 参数值使用参数化查询
所有参数值必须使用 $N 参数化查询，不能直接拼接。

```python
# 安全示例
conditions.append("email ILIKE $1")
params.append(f"%{search}%")

# 危险示例（禁止）
conditions.append(f"email ILIKE '%{search}%'")  # SQL注入风险!
```

### 3. 条件拼接
多个条件使用 AND/OR 拼接时，确保每个条件项来自硬编码或白名单。

```python
# 安全示例
where_clause = " AND ".join(conditions) if conditions else "TRUE"

# 添加新条件时
if tier:  # tier 是固定的参数名
    conditions.append("subscription_tier = $" + str(len(params) + 1))
    params.append(tier)
```

### 4. 更新语句
更新语句的字段名也必须来自白名单。

```python
ALLOWED_UPDATE_FIELDS = {"nickname", "avatar_url", "updated_at"}

for field, value in updates.items():
    if field not in ALLOWED_UPDATE_FIELDS:
        raise HTTPException(status_code=400, detail=f"Invalid field: {field}")
    update_parts.append(f"{field} = ${idx}")
    values.append(value)
```

## 当前实现状态

以下文件使用了动态SQL拼接：

| 文件 | 用途 | 安全状态 |
|------|------|----------|
| admin.py | 用户列表过滤 | ✅ 字段名硬编码 |
| admin_full.py | 管理后台过滤 | ✅ 字段名硬编码 |
| auth.py | 用户更新 | ✅ 字段名硬编码 |
| enterprise.py | 企业成员过滤 | ✅ 字段名硬编码 |

所有当前实现都是安全的，因为字段名来自硬编码的 if 条件。
但建议添加白名单验证以提高代码可维护性。

## 审查要点

添加新的动态SQL拼接时，审查以下要点：

1. 字段名是否来自用户输入？如果是，必须添加白名单验证
2. 参数值是否使用参数化查询 ($N)？
3. 是否有注释说明安全考虑？
4. 新增的字段名是否已加入白名单？
"""