# 测试 API 连接

## 🧪 API 可用性测试结果

### 测试时间

2024-12-07 21:56

### 测试环境

- 后端地址: `http://localhost:3000/api`
- 小程序配置: `E:/kucun/kucunxcx/miniprogram/config/api.ts`

---

## ✅ API 响应测试

### 1. 产品列表 API

```bash
curl http://localhost:3000/api/products?page=1&limit=3
```

**响应**:

```json
{
  "success": false,
  "error": "未授权访问"
}
```

**状态**: ⚠️ **需要认证**

- API 正常运行 ✅
- 需要登录后携带 Token
- 小程序需要先实现认证功能

### 2. 分类列表 API

```bash
curl http://localhost:3000/api/categories
```

**响应**:

```json
{
  "success": false,
  "error": "未授权访问"
}
```

**状态**: ⚠️ **需要认证**

---

## 🔐 认证要求分析

### 后端认证机制

根据 `/lib/auth/api-helpers.ts` 的 `withAuth` 中间件：

- 所有 API 需要 JWT Token 认证
- Token 通过 `Authorization: Bearer <token>` 头传递
- 权限检查：`permissions: ['products:view']`

### 小程序需要实现的功能

#### 1. **登录功能** 🔴 必需

```typescript
// services/auth.service.ts
async login(username: string, password: string) {
  const response = await post('/auth/login', { username, password })
  // 保存 Token
  wx.setStorageSync('auth_token', response.token)
  return response
}
```

#### 2. **Token 管理** ✅ 已实现

```typescript
// utils/request.ts (已实现)
const token = wx.getStorageSync('auth_token');
if (token) {
  headers['Authorization'] = `Bearer ${token}`;
}
```

#### 3. **自动跳转登录** ✅ 已实现

```typescript
// utils/request.ts (已实现)
if (res.statusCode === 401) {
  wx.redirectTo({ url: '/pages/auth/login' });
}
```

---

## 📋 测试步骤（完整流程）

### Step 1: 创建测试账号

在主项目中创建测试用户：

```bash
cd E:/kucun
npm run dev

# 访问 http://localhost:3000/auth/signin
# 或使用 seed 脚本创建测试数据
```

### Step 2: 实现登录页面

需要创建：

```
pages/auth/
├── login.ts
├── login.wxml
├── login.wxss
└── login.json
```

### Step 3: 实现登录服务

```typescript
// services/auth.service.ts
class AuthService {
  async login(credentials: { username: string; password: string }) {
    const response = await post('/auth/login', credentials, {
      needAuth: false, // 登录请求不需要Token
    });

    // 保存Token
    wx.setStorageSync('auth_token', response.token);
    wx.setStorageSync('user_info', response.user);

    return response;
  }

  async logout() {
    wx.removeStorageSync('auth_token');
    wx.removeStorageSync('user_info');
    wx.redirectTo({ url: '/pages/auth/login' });
  }

  isLoggedIn(): boolean {
    return !!wx.getStorageSync('auth_token');
  }
}
```

### Step 4: 测试完整流程

1. 打开小程序 → 自动跳转登录页（无Token）
2. 输入账号密码 → 登录成功保存Token
3. 跳转产品列表 → API请求携带Token
4. 成功获取产品数据 ✅

---

## 🔧 调试命令

### 在小程序 Console 中测试

```javascript
// 1. 检查Token
wx.getStorageSync('auth_token');

// 2. 清除Token（触发登录）
wx.removeStorageSync('auth_token');

// 3. 手动测试API
wx.request({
  url: 'http://localhost:3000/api/products',
  header: {
    Authorization: 'Bearer ' + wx.getStorageSync('auth_token'),
  },
  success: res => console.log(res),
});
```

---

## 🎯 API 认证状态总结

| API 端点              | 认证要求  | 小程序状态        | 优先级  |
| --------------------- | --------- | ----------------- | ------- |
| `POST /auth/login`    | ❌ 不需要 | ❌ 未实现         | 🔴 最高 |
| `GET /api/products`   | ✅ 需要   | ⚠️ 配置完成待测试 | 🔴 高   |
| `GET /api/categories` | ✅ 需要   | ⚠️ 配置完成待测试 | 🔴 高   |
| `GET /api/inventory`  | ✅ 需要   | ⚠️ 配置完成未实现 | 🟡 中   |
| `GET /api/profile`    | ✅ 需要   | ❌ 未配置         | 🟡 中   |

---

## ✅ 验证清单

### 已完成 ✅

- [x] API 基础配置
- [x] 网络请求封装
- [x] Token 自动携带
- [x] 401 自动跳转
- [x] 产品/分类服务类

### 需要完成 ⏳

- [ ] 登录页面UI
- [ ] 认证服务类
- [ ] 测试账号创建
- [ ] 完整登录流程测试

---

## 🚀 下一步行动

### 立即执行（今天）

1. **创建登录页面**:

```bash
pages/auth/login.ts
pages/auth/login.wxml
pages/auth/login.wxss
```

2. **创建认证服务**:

```bash
services/auth.service.ts
types/auth.d.ts
```

3. **添加登录路由**:

```json
// app.json
{
  "pages": [
    "pages/auth/login", // 添加到第一位，作为首页
    "pages/products/list"
    // ...
  ]
}
```

### 本周完成

4. **测试完整流程**
5. **产品详情页**
6. **库存查询页**

---

**结论**:

- ✅ API 后端正常运行
- ✅ 小程序请求封装完善
- ⚠️ 需要先实现登录功能才能测试数据接口
- 🎯 下一步：实现认证模块（登录/注册）

---

**测试报告生成时间**: 2024-12-07 22:00
