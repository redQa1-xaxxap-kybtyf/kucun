# 微信小程序 API 调用集成方案

> 基于 Next.js + NextAuth.js 的库存管理系统与微信小程序集成的完整技术方案

## 目录

- [1. 方案概述](#1-方案概述)
- [2. 认证架构设计](#2-认证架构设计)
- [3. 服务端配置](#3-服务端配置)
- [4. 小程序端实现](#4-小程序端实现)
- [5. 安全性措施](#5-安全性措施)
- [6. 最佳实践](#6-最佳实践)
- [7. 常见问题](#7-常见问题)

---

## 1. 方案概述

### 1.1 技术架构

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  微信小程序      │         │   Next.js API    │         │   MySQL数据库    │
│                 │◄───────►│                  │◄───────►│                 │
│  - 用户界面     │  HTTPS  │  - NextAuth.js   │         │  - 用户数据      │
│  - API调用      │         │  - JWT Token     │         │  - 业务数据      │
│  - Token存储    │         │  - 权限控制      │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

### 1.2 核心特性

- ✅ **双端认证**: 支持微信登录 + 传统账号密码登录
- ✅ **JWT Token**: 无状态认证，支持横向扩展
- ✅ **权限控制**: 细粒度权限管理
- ✅ **HTTPS 加密**: 生产环境强制 HTTPS
- ✅ **Token 刷新**: 自动刷新机制，提升用户体验
- ✅ **错误处理**: 统一的错误处理和重试机制

---

## 2. 认证架构设计

### 2.1 认证流程

#### 方案 A: 微信登录绑定已有账号（推荐）

```
┌──────────┐                ┌──────────┐                ┌──────────┐
│  小程序   │                │   API    │                │  数据库   │
└─────┬────┘                └─────┬────┘                └─────┬────┘
      │                            │                            │
      │  1. wx.login()            │                            │
      ├──────────────────────────►│                            │
      │  ◄──code──────────────────┤                            │
      │                            │                            │
      │  2. POST /api/auth/wechat │                            │
      │     { code, userInfo }    │                            │
      ├──────────────────────────►│                            │
      │                            │  3. 换取 openid           │
      │                            │     (微信服务器)           │
      │                            │                            │
      │                            │  4. 查询用户               │
      │                            ├───────────────────────────►│
      │                            │◄───────────────────────────┤
      │                            │                            │
      │  ◄──JWT Token─────────────┤  5. 生成/更新 Token       │
      │                            │                            │
      │  6. 后续 API 调用          │                            │
      │     Header: Authorization  │                            │
      ├──────────────────────────►│  7. 验证 Token            │
      │◄──────────────────────────┤                            │
      │                            │                            │
```

#### 方案 B: 传统账号密码登录

```
┌──────────┐                ┌──────────┐                ┌──────────┐
│  小程序   │                │   API    │                │  数据库   │
└─────┬────┘                └─────┬────┘                └─────┬────┘
      │                            │                            │
      │  1. POST /api/auth/signin │                            │
      │     { phone, password }   │                            │
      ├──────────────────────────►│                            │
      │                            │  2. 验证凭据               │
      │                            ├───────────────────────────►│
      │                            │◄───────────────────────────┤
      │                            │                            │
      │  ◄──JWT Token─────────────┤  3. 生成 Token            │
      │                            │                            │
```

### 2.2 Token 结构

```typescript
// JWT Payload 结构
{
  "sub": "user_id",              // 用户 ID
  "name": "用户名",               // 用户名称
  "phone": "13800138000",         // 手机号
  "role": "USER",                 // 角色
  "permissions": [                // 权限列表
    "products:view",
    "inventory:view",
    "sales-orders:view"
  ],
  "status": "active",             // 账户状态
  "iat": 1234567890,              // 签发时间
  "exp": 1234571490               // 过期时间(1小时)
}
```

---

## 3. 服务端配置

### 3.1 添加微信登录 API

创建文件: `app/api/auth/wechat/route.ts`

```typescript
import { type NextRequest, NextResponse } from 'next/server';
import { sign } from 'jsonwebtoken';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

// 微信小程序配置
const WECHAT_APP_ID = process.env.WECHAT_APP_ID!;
const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET!;

/**
 * 微信小程序登录接口
 * POST /api/auth/wechat
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, userInfo, phone } = body;

    // 1. 验证必填参数
    if (!code) {
      return NextResponse.json(
        { success: false, error: '缺少微信登录 code' },
        { status: 400 }
      );
    }

    // 2. 调用微信接口换取 openid 和 session_key
    const wxResponse = await fetch(
      `https://api.weixin.qq.com/sns/jscode2session?` +
        `appid=${WECHAT_APP_ID}&` +
        `secret=${WECHAT_APP_SECRET}&` +
        `js_code=${code}&` +
        `grant_type=authorization_code`
    );

    if (!wxResponse.ok) {
      logger.error('wechat-auth', '微信接口调用失败', {
        status: wxResponse.status,
      });
      return NextResponse.json(
        { success: false, error: '微信登录失败' },
        { status: 500 }
      );
    }

    const wxData = await wxResponse.json();

    if (wxData.errcode) {
      logger.error('wechat-auth', '微信登录错误', wxData);
      return NextResponse.json(
        { success: false, error: wxData.errmsg || '微信登录失败' },
        { status: 400 }
      );
    }

    const { openid, session_key, unionid } = wxData;

    // 3. 查询或创建用户
    let user = await prisma.user.findFirst({
      where: {
        OR: [{ wechatOpenId: openid }, phone ? { phone } : {}].filter(Boolean),
      },
    });

    if (!user) {
      // 首次登录，需要绑定手机号
      if (!phone) {
        return NextResponse.json(
          {
            success: false,
            error: 'PHONE_REQUIRED',
            message: '首次登录需要绑定手机号',
            openid, // 返回 openid 用于后续绑定
          },
          { status: 401 }
        );
      }

      // 创建新用户
      user = await prisma.user.create({
        data: {
          phone,
          name: userInfo?.nickName || `微信用户${phone.slice(-4)}`,
          password: '', // 微信登录用户无需密码
          role: 'USER',
          status: 'active',
          wechatOpenId: openid,
          wechatUnionId: unionid,
          wechatSessionKey: session_key,
        },
      });

      logger.info('wechat-auth', '新用户注册成功', { userId: user.id, phone });
    } else {
      // 更新微信信息
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          wechatOpenId: openid,
          wechatUnionId: unionid,
          wechatSessionKey: session_key,
          lastLoginAt: new Date(),
        },
      });
    }

    // 4. 检查账户状态
    if (user.status !== 'active') {
      return NextResponse.json(
        { success: false, error: '账户已被禁用，请联系管理员' },
        { status: 403 }
      );
    }

    // 5. 获取用户权限
    const permissions = await prisma.rolePermission.findMany({
      where: { role: user.role },
      select: { permission: true },
    });

    const permissionList = permissions.map(p => p.permission);

    // 6. 生成 JWT Token
    const token = sign(
      {
        sub: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        permissions: permissionList,
        status: user.status,
      },
      env.NEXTAUTH_SECRET,
      { expiresIn: '7d' } // 小程序 token 有效期 7 天
    );

    // 7. 返回成功响应
    return NextResponse.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          status: user.status,
          permissions: permissionList,
        },
      },
    });
  } catch (error) {
    logger.error('wechat-auth', '微信登录处理失败', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '登录失败',
      },
      { status: 500 }
    );
  }
}
```

### 3.2 添加手机号绑定 API

创建文件: `app/api/auth/wechat/bind-phone/route.ts`

```typescript
import { type NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * 微信手机号绑定接口
 * POST /api/auth/wechat/bind-phone
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { openid, phone, code } = body;

    // 验证参数
    if (!openid || !phone) {
      return NextResponse.json(
        { success: false, error: '缺少必填参数' },
        { status: 400 }
      );
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        { success: false, error: '手机号格式不正确' },
        { status: 400 }
      );
    }

    // 检查手机号是否已被使用
    const existingUser = await prisma.user.findUnique({
      where: { phone },
    });

    if (existingUser && existingUser.wechatOpenId !== openid) {
      return NextResponse.json(
        { success: false, error: '该手机号已被其他账号绑定' },
        { status: 400 }
      );
    }

    // 创建或更新用户
    const user = await prisma.user.upsert({
      where: { phone },
      create: {
        phone,
        name: `用户${phone.slice(-4)}`,
        password: '', // 微信登录用户无需密码
        role: 'USER',
        status: 'active',
        wechatOpenId: openid,
      },
      update: {
        wechatOpenId: openid,
      },
    });

    logger.info('wechat-auth', '手机号绑定成功', {
      userId: user.id,
      phone,
    });

    return NextResponse.json({
      success: true,
      data: { userId: user.id },
    });
  } catch (error) {
    logger.error('wechat-auth', '手机号绑定失败', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '绑定失败',
      },
      { status: 500 }
    );
  }
}
```

### 3.3 修改 CORS 配置

编辑 `next.config.ts`:

```typescript
import type { NextConfig } from 'next';

const config: NextConfig = {
  // ... 其他配置

  async headers() {
    return [
      {
        // 为小程序 API 添加 CORS 头
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.ALLOWED_ORIGINS || '*', // 生产环境应指定具体域名
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value:
              'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
          },
        ],
      },
    ];
  },
};

export default config;
```

### 3.4 环境变量配置

编辑 `.env.production`:

```bash
# 微信小程序配置
WECHAT_APP_ID=wx1234567890abcdef
WECHAT_APP_SECRET=your_wechat_app_secret

# CORS 配置(生产环境应指定具体域名)
ALLOWED_ORIGINS=https://yourdomain.com

# NextAuth 配置(已有)
NEXTAUTH_SECRET=your-secret-key-change-this-in-production-min-32-chars
NEXTAUTH_URL=https://yourdomain.com
```

### 3.5 数据库 Schema 更新

编辑 `prisma/schema.prisma`:

```prisma
model User {
  id        String   @id @default(cuid())
  phone     String   @unique
  name      String
  password  String   // 微信登录用户可为空
  role      Role     @default(USER)
  status    UserStatus @default(active)

  // 微信小程序字段
  wechatOpenId     String?  @unique @map("wechat_open_id")
  wechatUnionId    String?  @map("wechat_union_id")
  wechatSessionKey String?  @map("wechat_session_key")

  lastLoginAt DateTime? @map("last_login_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  @@map("users")
}
```

执行数据库迁移:

```bash
npm run db:generate
npm run db:push
```

---

## 4. 小程序端实现

### 4.1 项目结构

```
miniprogram/
├── api/                    # API 调用封装
│   ├── config.js          # API 配置
│   ├── request.js         # 请求封装
│   ├── auth.js            # 认证相关
│   ├── products.js        # 产品相关
│   └── inventory.js       # 库存相关
├── utils/                  # 工具函数
│   ├── storage.js         # 本地存储
│   └── error.js           # 错误处理
├── pages/                  # 页面
│   ├── login/             # 登录页
│   ├── index/             # 首页
│   └── ...
└── app.js                  # 应用入口
```

### 4.2 API 配置

创建 `api/config.js`:

```javascript
/**
 * API 配置
 */
const config = {
  // 开发环境
  development: {
    baseURL: 'http://localhost:3000',
    timeout: 10000,
  },
  // 生产环境
  production: {
    baseURL: 'https://your-domain.com',
    timeout: 10000,
  },
};

// 根据环境选择配置
const env = process.env.NODE_ENV || 'development';
const apiConfig = config[env];

module.exports = apiConfig;
```

### 4.3 请求封装

创建 `api/request.js`:

```javascript
const apiConfig = require('./config');
const { getToken, removeToken } = require('../utils/storage');

/**
 * 统一请求封装
 * @param {Object} options 请求选项
 * @returns {Promise} 返回 Promise
 */
function request(options) {
  const { url, method = 'GET', data = {}, header = {} } = options;

  return new Promise((resolve, reject) => {
    // 获取存储的 token
    const token = getToken();

    // 设置请求头
    const requestHeader = {
      'Content-Type': 'application/json',
      ...header,
    };

    // 如果有 token，添加到 Authorization 头
    if (token) {
      requestHeader['Authorization'] = `Bearer ${token}`;
    }

    // 发起请求
    wx.request({
      url: `${apiConfig.baseURL}${url}`,
      method,
      data,
      header: requestHeader,
      timeout: apiConfig.timeout,
      success: res => {
        console.log('API 请求成功:', url, res);

        const { statusCode, data: responseData } = res;

        // 处理成功响应
        if (statusCode >= 200 && statusCode < 300) {
          if (responseData.success) {
            resolve(responseData.data);
          } else {
            // 业务错误
            handleBusinessError(responseData.error, reject);
          }
        }
        // 处理 HTTP 错误
        else if (statusCode === 401) {
          // Token 过期或无效，跳转登录
          handleUnauthorized();
          reject(new Error('未授权，请重新登录'));
        } else if (statusCode === 403) {
          wx.showToast({
            title: '权限不足',
            icon: 'none',
          });
          reject(new Error('权限不足'));
        } else if (statusCode >= 500) {
          wx.showToast({
            title: '服务器错误，请稍后重试',
            icon: 'none',
          });
          reject(new Error('服务器错误'));
        } else {
          wx.showToast({
            title: responseData.error || '请求失败',
            icon: 'none',
          });
          reject(new Error(responseData.error || '请求失败'));
        }
      },
      fail: err => {
        console.error('API 请求失败:', url, err);
        handleNetworkError(err, reject);
      },
    });
  });
}

/**
 * 处理业务错误
 */
function handleBusinessError(error, reject) {
  wx.showToast({
    title: error || '操作失败',
    icon: 'none',
  });
  reject(new Error(error || '操作失败'));
}

/**
 * 处理网络错误
 */
function handleNetworkError(err, reject) {
  if (err.errMsg.includes('timeout')) {
    wx.showToast({
      title: '请求超时，请检查网络',
      icon: 'none',
    });
    reject(new Error('请求超时'));
  } else if (err.errMsg.includes('fail')) {
    wx.showToast({
      title: '网络连接失败',
      icon: 'none',
    });
    reject(new Error('网络连接失败'));
  } else {
    wx.showToast({
      title: '未知错误',
      icon: 'none',
    });
    reject(new Error('未知错误'));
  }
}

/**
 * 处理未授权（401）
 */
function handleUnauthorized() {
  removeToken();

  wx.showModal({
    title: '提示',
    content: '登录已过期，请重新登录',
    showCancel: false,
    success: res => {
      if (res.confirm) {
        wx.reLaunch({
          url: '/pages/login/login',
        });
      }
    },
  });
}

module.exports = {
  request,
  get: (url, data, header) => request({ url, method: 'GET', data, header }),
  post: (url, data, header) => request({ url, method: 'POST', data, header }),
  put: (url, data, header) => request({ url, method: 'PUT', data, header }),
  delete: (url, data, header) =>
    request({ url, method: 'DELETE', data, header }),
};
```

### 4.4 本地存储工具

创建 `utils/storage.js`:

```javascript
/**
 * 本地存储工具
 */

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_info';

/**
 * 保存 Token
 */
function saveToken(token) {
  try {
    wx.setStorageSync(TOKEN_KEY, token);
  } catch (e) {
    console.error('保存 Token 失败:', e);
  }
}

/**
 * 获取 Token
 */
function getToken() {
  try {
    return wx.getStorageSync(TOKEN_KEY);
  } catch (e) {
    console.error('获取 Token 失败:', e);
    return null;
  }
}

/**
 * 移除 Token
 */
function removeToken() {
  try {
    wx.removeStorageSync(TOKEN_KEY);
  } catch (e) {
    console.error('移除 Token 失败:', e);
  }
}

/**
 * 保存用户信息
 */
function saveUserInfo(userInfo) {
  try {
    wx.setStorageSync(USER_KEY, JSON.stringify(userInfo));
  } catch (e) {
    console.error('保存用户信息失败:', e);
  }
}

/**
 * 获取用户信息
 */
function getUserInfo() {
  try {
    const userInfoStr = wx.getStorageSync(USER_KEY);
    return userInfoStr ? JSON.parse(userInfoStr) : null;
  } catch (e) {
    console.error('获取用户信息失败:', e);
    return null;
  }
}

/**
 * 移除用户信息
 */
function removeUserInfo() {
  try {
    wx.removeStorageSync(USER_KEY);
  } catch (e) {
    console.error('移除用户信息失败:', e);
  }
}

/**
 * 清除所有认证信息
 */
function clearAuth() {
  removeToken();
  removeUserInfo();
}

module.exports = {
  saveToken,
  getToken,
  removeToken,
  saveUserInfo,
  getUserInfo,
  removeUserInfo,
  clearAuth,
};
```

### 4.5 认证 API

创建 `api/auth.js`:

```javascript
const { post } = require('./request');
const { saveToken, saveUserInfo } = require('../utils/storage');

/**
 * 微信登录
 * @param {Object} params 登录参数
 * @returns {Promise}
 */
async function wechatLogin(params) {
  try {
    const { code, userInfo, phone } = params;

    const response = await post('/api/auth/wechat', {
      code,
      userInfo,
      phone,
    });

    // 保存 token 和用户信息
    if (response.token) {
      saveToken(response.token);
      saveUserInfo(response.user);
    }

    return response;
  } catch (error) {
    console.error('微信登录失败:', error);
    throw error;
  }
}

/**
 * 绑定手机号
 * @param {Object} params 绑定参数
 * @returns {Promise}
 */
async function bindPhone(params) {
  try {
    const { openid, phone, code } = params;

    const response = await post('/api/auth/wechat/bind-phone', {
      openid,
      phone,
      code,
    });

    return response;
  } catch (error) {
    console.error('绑定手机号失败:', error);
    throw error;
  }
}

/**
 * 账号密码登录
 * @param {Object} params 登录参数
 * @returns {Promise}
 */
async function passwordLogin(params) {
  try {
    const { phone, password } = params;

    const response = await post('/api/auth/signin', {
      phone,
      password,
    });

    // 保存 token 和用户信息
    if (response.token) {
      saveToken(response.token);
      saveUserInfo(response.user);
    }

    return response;
  } catch (error) {
    console.error('登录失败:', error);
    throw error;
  }
}

module.exports = {
  wechatLogin,
  bindPhone,
  passwordLogin,
};
```

### 4.6 业务 API 示例

创建 `api/products.js`:

```javascript
const { get, post, put, delete: del } = require('./request');

/**
 * 获取产品列表
 * @param {Object} params 查询参数
 */
async function getProducts(params = {}) {
  const {
    page = 1,
    limit = 20,
    search,
    categoryId,
    status,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = params;

  // 构建查询参数
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sortBy,
    sortOrder,
  });

  if (search) queryParams.append('search', search);
  if (categoryId) queryParams.append('categoryId', categoryId);
  if (status) queryParams.append('status', status);

  return await get(`/api/products?${queryParams.toString()}`);
}

/**
 * 获取产品详情
 * @param {string} id 产品 ID
 */
async function getProductById(id) {
  return await get(`/api/products/${id}`);
}

/**
 * 创建产品
 * @param {Object} data 产品数据
 */
async function createProduct(data) {
  return await post('/api/products', data);
}

/**
 * 更新产品
 * @param {string} id 产品 ID
 * @param {Object} data 更新数据
 */
async function updateProduct(id, data) {
  return await put(`/api/products/${id}`, data);
}

/**
 * 删除产品
 * @param {string} id 产品 ID
 */
async function deleteProduct(id) {
  return await del(`/api/products/${id}`);
}

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
```

### 4.7 登录页面示例

创建 `pages/login/login.wxml`:

```xml
<view class="login-container">
  <view class="login-header">
    <image class="logo" src="/images/logo.png" mode="aspectFit"></image>
    <text class="title">库存管理系统</text>
  </view>

  <view class="login-content">
    <!-- 微信登录 -->
    <button
      class="wechat-login-btn"
      type="primary"
      bindtap="handleWechatLogin"
      loading="{{loading}}"
    >
      <image class="wechat-icon" src="/images/wechat.png"></image>
      微信一键登录
    </button>

    <view class="divider">
      <view class="line"></view>
      <text>或</text>
      <view class="line"></view>
    </view>

    <!-- 账号密码登录 -->
    <view class="form">
      <view class="form-item">
        <input
          class="input"
          type="number"
          placeholder="请输入手机号"
          value="{{phone}}"
          bindinput="onPhoneInput"
          maxlength="11"
        />
      </view>

      <view class="form-item">
        <input
          class="input"
          type="password"
          placeholder="请输入密码"
          value="{{password}}"
          bindinput="onPasswordInput"
        />
      </view>

      <button
        class="login-btn"
        type="primary"
        bindtap="handlePasswordLogin"
        loading="{{loading}}"
      >
        登录
      </button>
    </view>
  </view>
</view>
```

创建 `pages/login/login.js`:

```javascript
const { wechatLogin, passwordLogin } = require('../../api/auth');
const { getUserInfo } = require('../../utils/storage');

Page({
  data: {
    phone: '',
    password: '',
    loading: false,
  },

  onLoad() {
    // 检查是否已登录
    const userInfo = getUserInfo();
    if (userInfo) {
      this.redirectToHome();
    }
  },

  /**
   * 微信一键登录
   */
  async handleWechatLogin() {
    try {
      this.setData({ loading: true });

      // 1. 调用 wx.login() 获取 code
      const { code } = await this.wxLogin();

      // 2. 获取用户信息(可选)
      const userInfo = await this.getUserProfile();

      // 3. 调用后端接口
      const response = await wechatLogin({
        code,
        userInfo,
      });

      // 4. 登录成功
      wx.showToast({
        title: '登录成功',
        icon: 'success',
      });

      setTimeout(() => {
        this.redirectToHome();
      }, 1500);
    } catch (error) {
      console.error('微信登录失败:', error);

      // 如果需要绑定手机号
      if (error.message === 'PHONE_REQUIRED') {
        this.showPhoneBindModal(error.openid);
      } else {
        wx.showToast({
          title: error.message || '登录失败',
          icon: 'none',
        });
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 账号密码登录
   */
  async handlePasswordLogin() {
    const { phone, password } = this.data;

    // 验证输入
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none',
      });
      return;
    }

    if (!password || password.length < 6) {
      wx.showToast({
        title: '密码至少6位',
        icon: 'none',
      });
      return;
    }

    try {
      this.setData({ loading: true });

      await passwordLogin({ phone, password });

      wx.showToast({
        title: '登录成功',
        icon: 'success',
      });

      setTimeout(() => {
        this.redirectToHome();
      }, 1500);
    } catch (error) {
      console.error('登录失败:', error);
      wx.showToast({
        title: error.message || '登录失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 调用微信登录
   */
  wxLogin() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: res => {
          if (res.code) {
            resolve({ code: res.code });
          } else {
            reject(new Error('获取登录凭证失败'));
          }
        },
        fail: err => {
          reject(err);
        },
      });
    });
  },

  /**
   * 获取用户信息
   */
  getUserProfile() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善会员资料',
        success: res => {
          resolve(res.userInfo);
        },
        fail: err => {
          console.log('用户拒绝授权:', err);
          resolve(null); // 用户信息非必需
        },
      });
    });
  },

  /**
   * 显示手机号绑定弹窗
   */
  showPhoneBindModal(openid) {
    // TODO: 实现手机号绑定弹窗
    wx.showModal({
      title: '绑定手机号',
      content: '首次登录需要绑定手机号',
      confirmText: '去绑定',
      success: res => {
        if (res.confirm) {
          // 跳转到手机号绑定页面
          wx.navigateTo({
            url: `/pages/bind-phone/bind-phone?openid=${openid}`,
          });
        }
      },
    });
  },

  /**
   * 重定向到首页
   */
  redirectToHome() {
    wx.reLaunch({
      url: '/pages/index/index',
    });
  },

  /**
   * 输入事件
   */
  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },
});
```

### 4.8 应用入口配置

编辑 `app.js`:

```javascript
const { getToken, getUserInfo } = require('./utils/storage');

App({
  globalData: {
    userInfo: null,
    token: null,
  },

  onLaunch() {
    // 应用启动时，恢复用户信息
    this.globalData.token = getToken();
    this.globalData.userInfo = getUserInfo();

    console.log('应用启动，用户信息:', this.globalData.userInfo);

    // 检查更新
    this.checkUpdate();
  },

  /**
   * 检查小程序更新
   */
  checkUpdate() {
    const updateManager = wx.getUpdateManager();

    updateManager.onCheckForUpdate(res => {
      console.log('检查更新:', res.hasUpdate);
    });

    updateManager.onUpdateReady(() => {
      wx.showModal({
        title: '更新提示',
        content: '新版本已准备好，是否重启应用?',
        success: res => {
          if (res.confirm) {
            updateManager.applyUpdate();
          }
        },
      });
    });

    updateManager.onUpdateFailed(() => {
      console.error('新版本下载失败');
    });
  },
});
```

---

## 5. 安全性措施

### 5.1 HTTPS 强制

生产环境必须使用 HTTPS:

```typescript
// middleware.ts 中已实现
if (process.env.NODE_ENV === 'production') {
  const proto =
    request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');

  if ((isAuthApi || isAuthPage) && proto !== 'https') {
    return new Response('HTTPS Required', { status: 403 });
  }
}
```

### 5.2 Token 安全存储

小程序端使用 `wx.setStorageSync` 存储 token:

```javascript
// utils/storage.js
function saveToken(token) {
  wx.setStorageSync('auth_token', token);
}
```

**注意事项:**

- Token 存储在小程序的本地缓存中，相对安全
- 敏感数据不要存储在 token 中
- 定期刷新 token，减少泄露风险

### 5.3 请求签名(可选)

对于高安全性要求的接口，可以添加请求签名:

```javascript
// 生成签名
function generateSignature(params, secret) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  return crypto.createHmac('sha256', secret).update(sortedParams).digest('hex');
}

// 在请求中添加签名
const timestamp = Date.now();
const signature = generateSignature({ ...data, timestamp }, APP_SECRET);

wx.request({
  url: apiUrl,
  data: { ...data, timestamp, signature },
  // ...
});
```

### 5.4 防重放攻击

服务端验证时间戳:

```typescript
// 验证请求时间戳(5分钟内有效)
const timestamp = parseInt(request.headers.get('X-Timestamp') || '0');
const now = Date.now();

if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
  return NextResponse.json(
    { success: false, error: '请求已过期' },
    { status: 401 }
  );
}
```

### 5.5 速率限制

使用 Redis 实现 API 速率限制:

```typescript
import { redis } from '@/lib/cache';

async function checkRateLimit(userId: string, limit = 100, window = 60) {
  const key = `rate_limit:${userId}`;
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, window);
  }

  if (current > limit) {
    throw new Error('请求过于频繁，请稍后再试');
  }
}
```

---

## 6. 最佳实践

### 6.1 错误处理

**统一错误码:**

```javascript
// 错误码定义
const ERROR_CODES = {
  SUCCESS: 0,
  UNKNOWN_ERROR: 1000,
  NETWORK_ERROR: 1001,
  TIMEOUT_ERROR: 1002,
  AUTH_ERROR: 2000,
  TOKEN_EXPIRED: 2001,
  PERMISSION_DENIED: 2002,
  VALIDATION_ERROR: 3000,
  BUSINESS_ERROR: 4000,
};

// 错误处理
function handleError(error) {
  if (error.code === ERROR_CODES.TOKEN_EXPIRED) {
    // 跳转登录
    redirectToLogin();
  } else if (error.code === ERROR_CODES.NETWORK_ERROR) {
    // 显示网络错误提示
    showNetworkError();
  }
  // ...
}
```

### 6.2 请求重试

对于网络不稳定的情况，实现自动重试:

```javascript
async function requestWithRetry(options, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await request(options);
    } catch (error) {
      lastError = error;

      // 只对网络错误重试
      if (error.message.includes('网络')) {
        console.log(`请求失败，第 ${i + 1} 次重试...`);
        await sleep(1000 * (i + 1)); // 指数退避
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}
```

### 6.3 数据缓存

合理使用本地缓存，减少网络请求:

```javascript
/**
 * 带缓存的数据获取
 */
async function getCachedData(key, fetchFn, ttl = 5 * 60 * 1000) {
  const cacheKey = `cache_${key}`;
  const cached = wx.getStorageSync(cacheKey);

  if (cached) {
    const { data, expireAt } = JSON.parse(cached);
    if (Date.now() < expireAt) {
      return data;
    }
  }

  // 缓存过期或不存在，重新获取
  const data = await fetchFn();

  wx.setStorageSync(
    cacheKey,
    JSON.stringify({
      data,
      expireAt: Date.now() + ttl,
    })
  );

  return data;
}

// 使用示例
const products = await getCachedData(
  'products',
  () => getProducts({ page: 1, limit: 20 }),
  5 * 60 * 1000 // 5分钟缓存
);
```

### 6.4 分页加载

实现下拉刷新和上拉加载:

```javascript
Page({
  data: {
    list: [],
    page: 1,
    hasMore: true,
    loading: false,
  },

  onLoad() {
    this.loadData();
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    this.setData({ page: 1, list: [] });
    await this.loadData();
    wx.stopPullDownRefresh();
  },

  /**
   * 上拉加载更多
   */
  async onReachBottom() {
    if (!this.data.hasMore || this.data.loading) {
      return;
    }

    this.setData({ page: this.data.page + 1 });
    await this.loadData();
  },

  /**
   * 加载数据
   */
  async loadData() {
    try {
      this.setData({ loading: true });

      const { page } = this.data;
      const response = await getProducts({ page, limit: 20 });

      const newList =
        page === 1 ? response.items : [...this.data.list, ...response.items];

      this.setData({
        list: newList,
        hasMore: response.hasMore,
      });
    } catch (error) {
      console.error('加载数据失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loading: false });
    }
  },
});
```

### 6.5 性能优化

**1. 图片懒加载:**

```xml
<image
  src="{{item.image}}"
  lazy-load="{{true}}"
  mode="aspectFill"
></image>
```

**2. 列表虚拟化:**

使用 `recycle-view` 组件处理长列表。

**3. 请求合并:**

```javascript
// 批量获取数据
async function batchGetProducts(ids) {
  return await post('/api/products/batch', { ids });
}
```

### 6.6 用户体验优化

**1. 加载状态:**

```xml
<view wx:if="{{loading}}" class="loading">
  <view class="loading-icon"></view>
  <text>加载中...</text>
</view>
```

**2. 空状态:**

```xml
<view wx:if="{{list.length === 0 && !loading}}" class="empty">
  <image src="/images/empty.png"></image>
  <text>暂无数据</text>
</view>
```

**3. 骨架屏:**

```xml
<view wx:if="{{loading}}" class="skeleton">
  <view class="skeleton-item"></view>
  <view class="skeleton-item"></view>
  <view class="skeleton-item"></view>
</view>
```

---

## 7. 常见问题

### Q1: 小程序请求报错 "不在以下 request 合法域名列表中"

**解决方案:**

1. 登录微信公众平台
2. 进入"开发" -> "开发管理" -> "开发设置"
3. 在"服务器域名"中添加你的 API 域名
4. 注意：只能添加 HTTPS 域名

### Q2: Token 过期后如何自动刷新?

**解决方案:**

实现 token 刷新机制:

```javascript
// api/request.js
async function refreshToken() {
  const refreshToken = getRefreshToken();

  const response = await wx.request({
    url: `${apiConfig.baseURL}/api/auth/refresh`,
    method: 'POST',
    data: { refreshToken },
  });

  saveToken(response.data.token);
  return response.data.token;
}

// 在请求失败时自动刷新
if (statusCode === 401) {
  const newToken = await refreshToken();
  // 重试原请求
  return request({ ...options, forceRefresh: true });
}
```

### Q3: 如何处理并发请求?

**解决方案:**

使用 `Promise.all` 并发请求:

```javascript
async function loadPageData() {
  const [products, categories, inventory] = await Promise.all([
    getProducts({ page: 1 }),
    getCategories(),
    getInventory({ page: 1 }),
  ]);

  this.setData({ products, categories, inventory });
}
```

### Q4: 如何调试小程序 API 请求?

**解决方案:**

1. **使用微信开发者工具的 Network 面板**
2. **添加详细日志:**

```javascript
console.log('请求:', url, data);
console.log('响应:', response);
```

3. **使用 Charles/Fiddler 抓包**

### Q5: 生产环境如何配置?

**解决方案:**

1. **使用环境变量:**

```javascript
// api/config.js
const env = __wxConfig.envVersion; // 'develop' | 'trial' | 'release'

const config = {
  develop: {
    baseURL: 'https://dev-api.yourdomain.com',
  },
  trial: {
    baseURL: 'https://test-api.yourdomain.com',
  },
  release: {
    baseURL: 'https://api.yourdomain.com',
  },
};
```

2. **服务端配置 CORS:**

```typescript
// next.config.ts
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        {
          key: 'Access-Control-Allow-Origin',
          value: 'https://api.yourdomain.com',
        },
      ],
    },
  ];
}
```

---

## 总结

本方案提供了完整的微信小程序 API 调用集成方案，包括:

✅ **认证机制**: 支持微信登录 + 账号密码登录
✅ **安全性**: HTTPS、JWT Token、权限控制
✅ **代码封装**: 统一的请求封装和错误处理
✅ **最佳实践**: 缓存、重试、分页、性能优化
✅ **完整示例**: 登录页面、API 调用、数据管理

按照本方案实施，可以快速构建一个安全、高效、用户体验良好的微信小程序。

---

## 附录

### A. 完整的环境变量清单

```bash
# Next.js 配置
NODE_ENV=production
PORT=3000

# NextAuth 配置
NEXTAUTH_SECRET=your-secret-key-min-32-chars
NEXTAUTH_URL=https://yourdomain.com

# 数据库配置
DATABASE_URL=mysql://user:password@localhost:3306/kucun

# Redis 配置
REDIS_URL=redis://127.0.0.1:6379
REDIS_PASSWORD=

# 微信小程序配置
WECHAT_APP_ID=wx1234567890abcdef
WECHAT_APP_SECRET=your_wechat_app_secret

# CORS 配置
ALLOWED_ORIGINS=https://yourdomain.com
```

### B. API 接口清单

| 接口                          | 方法 | 说明         | 权限                |
| ----------------------------- | ---- | ------------ | ------------------- |
| `/api/auth/wechat`            | POST | 微信登录     | 公开                |
| `/api/auth/wechat/bind-phone` | POST | 绑定手机号   | 公开                |
| `/api/auth/signin`            | POST | 账号密码登录 | 公开                |
| `/api/products`               | GET  | 产品列表     | `products:view`     |
| `/api/products/:id`           | GET  | 产品详情     | `products:view`     |
| `/api/products`               | POST | 创建产品     | `products:create`   |
| `/api/inventory`              | GET  | 库存列表     | `inventory:view`    |
| `/api/sales-orders`           | GET  | 销售订单列表 | `sales-orders:view` |

### C. 参考资源

- [微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [Next.js 官方文档](https://nextjs.org/docs)
- [NextAuth.js 官方文档](https://next-auth.js.org/)
- [JWT 最佳实践](https://tools.ietf.org/html/rfc8725)

---

**文档版本**: 1.0.0
**最后更新**: 2025-12-03
**作者**: AI Assistant
