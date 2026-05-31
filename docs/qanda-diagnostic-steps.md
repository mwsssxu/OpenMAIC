# 问答功能 - 诊断步骤

## 问题：页面显示测试数据而不是真实数据

### 已确认的事实
1. ✅ 后端API运行正常（http://localhost:8001）
2. ✅ 数据库有真实数据（7问题 + 2回答）
3. ✅ Expo已重启并加载环境变量
4. ✅ 用户已登录
5. ❌ API返回401 "Not authenticated"

### 诊断步骤

#### 1. 检查浏览器控制台（F12）

打开开发者工具，查看：

**Console标签**：
- 是否有错误信息？
- 是否有 "Not authenticated" 错误？
- 是否有网络请求失败？

**Network标签**：
- 查找到 `questions` 的请求
- 查看请求URL（应该是 `http://localhost:8001/questions`）
- 查看请求状态码（401表示认证失败）
- 查看请求Headers中的Authorization字段

#### 2. 检查本地存储（Web端）

在Console中运行：
```javascript
localStorage.getItem('auth_token')
localStorage.getItem('refresh_token')
localStorage.getItem('user_data')
```

**预期结果**：应该有token值
**如果没有**：说明登录token没有被正确保存

#### 3. 测试认证是否工作

在Console中运行：
```javascript
// 查看API客户端的token
console.log('API Base URL:', 'http://localhost:8001');

// 检查存储的token
const token = localStorage.getItem('auth_token');
console.log('Stored token:', token);
```

#### 4. 手动测试API（带token）

如果找到了token，手动测试：
```javascript
const token = localStorage.getItem('auth_token');
fetch('http://localhost:8001/questions?page=1&limit=5', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(r => r.json())
.then(data => console.log('Questions data:', data))
.catch(err => console.error('Error:', err));
```

### 可能的原因

1. **Token未正确保存**
   - 登录流程有问题
   - localStorage/SecureStore保存失败

2. **Token未正确加载到API客户端**
   - `apiClient.setToken()` 未被调用
   - Token过期需要刷新

3. **环境变量问题**
   - `.env` 文件在Web端未被正确加载
   - Expo环境变量配置问题

### 解决方案

#### 方案1：重新登录
- 在应用中注销并重新登录
- 这会重新生成并保存token

#### 方案2：清除浏览器缓存
- 清除浏览器缓存和localStorage
- 重新登录

#### 方案3：验证后端认证配置
- 检查后端是否正确验证JWT token

### 获取帮助

请提供以下信息：
1. Console标签的完整错误信息
2. Network标签中questions请求的详细信息
3. localStorage中的token值（如果存在）

---

**快速检查命令**：
在浏览器Console运行：
```javascript
// 检查存储
console.log({
  auth_token: localStorage.getItem('auth_token'),
  refresh_token: localStorage.getItem('refresh_token'),
  user_data: localStorage.getItem('user_data')
});

// 测试API
fetch('http://localhost:8001/health')
  .then(r => r.json())
  .then(d => console.log('Health:', d));
```