# 小程序 API 接入说明

## 📋 项目结构

```
miniprogram/
├── config/
│   └── api.ts              # API配置(baseURL, 端点定义)
├── utils/
│   └── request.ts          # 网络请求封装
├── types/
│   ├── common.d.ts         # 通用类型定义
│   ├── product.d.ts        # 产品类型定义
│   └── category.d.ts       # 分类类型定义
├── services/
│   ├── product.service.ts  # 产品服务
│   └── category.service.ts # 分类服务
└── pages/
    └── products/
        └── list.ts         # 产品列表页(已接入API)
```

## 🔧 配置说明

### 1. API 基础配置 (`config/api.ts`)

**环境配置**：

```typescript
const ENV = {
  development: {
    baseURL: 'http://localhost:3000/api', // 开发环境
    timeout: 30000,
  },
  production: {
    baseURL: 'https://your-domain.com/api', // 生产环境 ⚠️ 需要修改
    timeout: 30000,
  },
};
```

**⚠️ 重要**：部署前请修改 `production.baseURL` 为实际生产环境域名。

**API 端点定义**：

```typescript
export const API_ENDPOINTS = {
  PRODUCTS: {
    LIST: '/products',
    DETAIL: (id: string) => `/products/${id}`,
  },
  CATEGORIES: {
    LIST: '/categories',
    DETAIL: (id: string) => `/categories/${id}`,
  },
  // ... 更多端点
};
```

### 2. 网络请求封装 (`utils/request.ts`)

**功能特性**：

- ✅ 统一请求/响应处理
- ✅ 自动 Token 认证
- ✅ 错误统一处理
- ✅ 加载提示
- ✅ 401/403 自动处理

**使用方法**：

```typescript
import { get, post } from '../../utils/request';

// GET 请求
const data = await get<Product[]>('/products', { page: 1, limit: 10 });

// POST 请求
const result = await post('/products', { name: '产品名称' });
```

## 📝 使用示例

### 1. 产品服务 (`services/product.service.ts`)

```typescript
import productService from '../../services/product.service';

// 获取产品列表
const response = await productService.getProducts({
  page: 1,
  limit: 10,
  search: '瓷砖',
  categoryId: 'xxx',
  status: 'active',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  includeInventory: true,
});

// 获取产品详情
const product = await productService.getProductDetail('product-id');

// 搜索产品
const searchResults = await productService.searchProducts('搜索关键词', {
  page: 1,
  limit: 10,
});
```

### 2. 分类服务 (`services/category.service.ts`)

```typescript
import categoryService from '../../services/category.service';

// 获取分类列表
const categories = await categoryService.getCategories();

// 获取分类详情
const category = await categoryService.getCategoryDetail('category-id');
```

## 🔐 认证机制

### Token 存储

Token 自动存储在本地存储中：

```typescript
// 存储 Token
wx.setStorageSync('auth_token', token);

// 获取 Token (自动)
// request.ts 会自动从存储中读取并添加到请求头
```

### 认证流程

1. **登录成功**：保存 Token 到本地存储
2. **发起请求**：自动从存储读取 Token 并添加到 `Authorization` 头
3. **401 未认证**：自动清除 Token 并跳转登录页
4. **403 无权限**：提示用户无权访问

## 🎯 页面集成示例

### 产品列表页 (`pages/products/list.ts`)

已完成 API 接入，主要功能：

```typescript
// 1. 导入服务
import productService from '../../services/product.service'
import categoryService from '../../services/category.service'

// 2. 加载数据
async loadProducts(reset = false) {
  const queryParams = {
    page: this.data.page,
    limit: this.data.pageSize,
    search: this.data.searchValue,
    categoryId: this.data.filterCategory !== '0' ? this.data.filterCategory : undefined,
    includeInventory: true,
  }

  const response = await productService.getProducts(queryParams)

  this.setData({
    products: response.items,
    total: response.pagination.total,
    finished: !response.pagination.hasNextPage,
  })
}

// 3. 加载分类
async loadCategories() {
  const categories = await categoryService.getCategories()
  const categoryOptions = [
    { text: '全部分类', value: '0' },
    ...categories.map((cat) => ({ text: cat.name, value: cat.id })),
  ]
  this.setData({ categoryOptions })
}
```

## 🚀 后续开发指南

### 1. 创建新的服务

参考 `product.service.ts` 创建新服务：

```typescript
// services/inventory.service.ts
import { API_ENDPOINTS } from '../config/api';
import { get } from '../utils/request';

class InventoryService {
  async getInventoryList(params) {
    return get(API_ENDPOINTS.INVENTORY.LIST, params);
  }

  async getInventoryDetail(id: string) {
    return get(API_ENDPOINTS.INVENTORY.DETAIL(id));
  }
}

export const inventoryService = new InventoryService();
export default inventoryService;
```

### 2. 添加新的 API 端点

在 `config/api.ts` 中添加：

```typescript
export const API_ENDPOINTS = {
  // 现有端点...

  // 新增端点
  INVENTORY: {
    LIST: '/inventory',
    DETAIL: (id: string) => `/inventory/${id}`,
    ALERTS: '/inventory/alerts',
  },
};
```

### 3. 定义类型

在 `types/` 目录下创建类型定义文件：

```typescript
// types/inventory.d.ts
export interface Inventory {
  id: string;
  productId: string;
  availableQuantity: number;
  allocatedQuantity: number;
  totalQuantity: number;
}
```

## 🛠️ 调试技巧

### 1. 查看网络请求

在微信开发者工具中：

- 打开 **Console** 面板
- 查看网络请求日志
- 检查请求参数和响应数据

### 2. 错误处理

所有错误会自动显示 Toast 提示，同时在控制台输出详细信息：

```typescript
try {
  await productService.getProducts(params);
} catch (error) {
  console.error('加载产品失败:', error);
  // 错误已被 request.ts 自动处理
}
```

### 3. 模拟数据测试

如果后端 API 未就绪，可以暂时使用模拟数据：

```typescript
// 临时方案
async loadProducts() {
  // return await productService.getProducts(params) // 真实API

  // 使用模拟数据
  const mockData = {
    items: [...],
    pagination: { ... },
  }
  return mockData
}
```

## ⚠️ 注意事项

### 1. 域名配置

小程序必须配置服务器域名白名单：

1. 登录微信公众平台
2. 开发 → 开发管理 → 开发设置
3. 服务器域名 → request合法域名
4. 添加：`https://your-domain.com`

### 2. 跨域问题

微信小程序不存在浏览器跨域问题，但需要：

- ✅ 配置合法域名
- ✅ 使用 HTTPS 协议（生产环境）
- ✅ 后端正确处理 OPTIONS 请求

### 3. 开发环境

开发时可以：

- 勾选"不校验合法域名"（开发者工具）
- 使用 localhost 调试
- 配置代理转发

### 4. Token 过期处理

Token 过期时会自动：

1. 清除本地 Token
2. 跳转到登录页
3. 用户重新登录

## 📚 API 文档参考

后端 API 文档位置：

- 开发环境：`http://localhost:3000/api-docs`（如果配置）
- 主要端点：
  - `GET /api/products` - 产品列表
  - `GET /api/products/:id` - 产品详情
  - `GET /api/categories` - 分类列表
  - `GET /api/inventory` - 库存列表

## 🎉 已完成功能

✅ API 基础配置
✅ 网络请求封装
✅ 类型定义系统
✅ 产品服务
✅ 分类服务
✅ 产品列表页 API 接入
✅ 分类筛选功能
✅ 搜索功能
✅ 分页加载
✅ 排序功能

## 📝 待开发功能

⏳ 库存服务
⏳ 用户认证服务
⏳ 其他页面 API 接入

---

**更新时间**: 2024-12-07
**维护者**: 开发团队
