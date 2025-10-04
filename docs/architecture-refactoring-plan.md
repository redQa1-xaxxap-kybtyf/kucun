# 代码分层架构重构计划

## 重构目标

将项目代码重构为清晰的分层架构,确保职责分离和代码可维护性。

## 分层职责定义

### 1. 业务逻辑层 (`lib/services/*`)

- ✅ 集中所有业务逻辑和数据处理
- ✅ 通过 Prisma 客户端与数据库交互
- ✅ 返回类型安全的数据对象(使用 Zod 验证)
- ✅ 不依赖 HTTP 请求/响应对象
- ✅ 可被 API Route 和服务器组件复用

### 2. API Route 层 (`app/api/**/route.ts`)

- ✅ 身份认证和授权检查(使用 Next-Auth)
- ✅ 请求参数验证(使用 Zod schema)
- ✅ 调用 `lib/services/*` 中的业务逻辑
- ✅ 数据序列化和 HTTP 响应格式化
- ✅ 错误处理和统一响应格式 `{ data, error }`
- ❌ 禁止直接使用 Prisma 客户端查询数据库
- ❌ 禁止编写业务逻辑代码

### 3. 服务器组件层 (`app/**/page.tsx`)

- ✅ 直接调用 `lib/services/*` 获取数据(不通过 API)
- ✅ 使用 `getServerSession()` 进行服务端认证
- ✅ 将数据作为 props 传递给客户端组件

### 4. 客户端组件层 (`components/**/*.tsx`)

- ✅ UI 交互状态管理(使用 `useState`, `useReducer`)
- ✅ 表单处理(使用 React Hook Form + Zod)
- ✅ 通过 TanStack Query 调用 API 进行数据变更
- ❌ 禁止直接调用 `lib/services/*`

## 已完成的重构

### ✅ 应收账款模块

**服务层文件**: `lib/services/receivables-service.ts`

- 创建了完整的应收账款业务逻辑服务
- 包含类型定义、辅助函数和公共服务函数
- 支持复杂的查询、过滤、排序和分页
- 计算支付状态和逾期天数

**API Route 重构**: `app/api/finance/receivables/route.ts`

- 从 398 行减少到 129 行(减少 67%)
- 移除所有 Prisma 查询和业务逻辑
- 只保留认证、验证、调用服务、返回响应
- 代码清晰,职责明确

**重构效果**:

- ✅ 代码行数减少 67%
- ✅ 业务逻辑可复用(API 和服务器组件共享)
- ✅ 更易于测试和维护
- ✅ 符合 Next.js 15 App Router 最佳实践
- ✅ 无 TypeScript 类型错误

## 待重构的模块

### 🔴 高优先级(直接使用 Prisma 且业务逻辑复杂)

1. **分类管理** (`app/api/categories/route.ts`)
   - 当前状态: 直接使用 Prisma 查询
   - 需要创建: `lib/services/category-service.ts`
   - 业务逻辑: 分类查询、创建、更新、删除、层级关系处理

2. **产品搜索** (`app/api/products/search/route.ts`)
   - 当前状态: 直接使用 Prisma 查询和聚合
   - 需要创建: `lib/services/product-search-service.ts`
   - 业务逻辑: 产品搜索、库存汇总、批量查询优化

3. **供应商管理** (`app/api/suppliers/route.ts`)
   - 当前状态: 直接使用 Prisma 查询
   - 需要创建: `lib/services/supplier-service.ts`
   - 业务逻辑: 供应商查询、创建、更新、删除

4. **库存预警** (`app/api/inventory/alerts/route.ts`)
   - 当前状态: 直接使用 Prisma 查询
   - 需要创建: `lib/services/inventory-alert-service.ts`
   - 业务逻辑: 低库存检测、零库存检测、预警统计

5. **仪表盘预警** (`app/api/dashboard/alerts/route.ts`)
   - 当前状态: 直接使用 Prisma 查询
   - 需要创建: `lib/services/dashboard-service.ts`
   - 业务逻辑: 库存预警汇总、统计数据

### 🟡 中优先级(已有部分服务层抽象)

6. **客户管理** (`app/api/customers/[id]/route.ts`)
   - 当前状态: 已使用 `lib/api/customer-handlers.ts` 部分抽象
   - 需要优化: 将 handlers 移至 `lib/services/customer-service.ts`
   - 业务逻辑: 客户详情、更新、删除

7. **往来账单** (`app/api/statements/[id]/route.ts`)
   - 当前状态: 已使用 `lib/api/handlers/statement-details.ts` 部分抽象
   - 需要优化: 将 handlers 移至 `lib/services/statement-service.ts`
   - 业务逻辑: 账单详情、财务计算、逾期计算

8. **入库管理** (`app/api/inventory/inbound/route.ts`)
   - 当前状态: 已使用 `lib/api/inbound-handlers.ts` 部分抽象
   - 需要优化: 将 handlers 移至 `lib/services/inbound-service.ts`
   - 业务逻辑: 入库记录、库存更新

9. **批次规格** (`app/api/batch-specifications/[id]/route.ts`)
   - 当前状态: 已使用 `lib/api/batch-specification-handlers.ts` 部分抽象
   - 需要优化: 将 handlers 移至 `lib/services/batch-specification-service.ts`
   - 业务逻辑: 批次规格查询、更新、删除

### 🟢 低优先级(简单查询或静态数据)

10. **客户搜索** (`app/api/customers/search/route.ts`)
    - 简单的搜索查询,可以保持现状或快速重构

11. **价格历史** (`app/api/price-history/supplier/route.ts`, `app/api/price-history/customer/route.ts`)
    - 使用原生 SQL 查询,需要特殊处理

12. **地址数据** (`app/api/address/provinces/route.ts`, `app/api/address/districts/route.ts`)
    - 静态数据,无需重构

13. **测试数据生成** (`app/api/seed-test-data/route.ts`)
    - 已使用 `lib/api/handlers/seed-data.ts`,可以保持现状

## 重构步骤模板

对于每个需要重构的模块:

### 1. 创建服务层文件

```typescript
// lib/services/[module]-service.ts

/**
 * [模块名称]业务逻辑服务层
 * 职责:
 * - 封装所有[模块]相关的业务逻辑
 * - 通过 Prisma 客户端与数据库交互
 * - 返回类型安全的数据对象
 * - 可被 API Route 和服务器组件复用
 */

import { prisma } from '@/lib/db';

// 类型定义
export interface [Module]QueryParams {
  // ...
}

export interface [Module]Result {
  // ...
}

// 辅助函数(私有)
function buildWhereConditions() {
  // ...
}

// 公共服务函数
export async function get[Module]s(params: [Module]QueryParams) {
  // 业务逻辑
  const data = await prisma.[model].findMany({
    // ...
  });

  return data;
}
```

### 2. 重构 API Route

```typescript
// app/api/[module]/route.ts

/**
 * [模块] API 路由
 * 职责:
 * - 身份认证和授权检查
 * - 请求参数验证
 * - 调用服务层业务逻辑
 * - 数据序列化和 HTTP 响应格式化
 * - 错误处理和统一响应格式
 */

import { get[Module]s } from '@/lib/services/[module]-service';

export async function GET(request: NextRequest) {
  try {
    // 1. 身份认证
    const auth = verifyApiAuth(request);
    if (!auth.success) {
      return errorResponse(auth.error || '未授权访问', 401);
    }

    // 2. 参数验证
    const params = [schema].parse(/* ... */);

    // 3. 调用服务层
    const result = await get[Module]s(params);

    // 4. 返回响应
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    // 错误处理
  }
}
```

### 3. 验证重构

```bash
# TypeScript 类型检查
npm run type-check

# ESLint 检查
npm run lint

# 启动开发服务器
npm run dev

# 测试功能
# 使用 Playwright 浏览器测试
```

## 重构原则

1. **一次重构一个模块**: 避免同时修改多个文件导致问题难以定位
2. **保持向后兼容**: 确保 API 响应格式不变
3. **类型安全优先**: 使用 TypeScript 和 Zod 确保类型安全
4. **测试驱动**: 重构后立即测试功能
5. **代码审查**: 确保重构后的代码符合规范

## 预期成果

- ✅ 清晰的代码分层,职责明确
- ✅ 业务逻辑可复用(API 和服务器组件共享)
- ✅ 更易于测试和维护
- ✅ 符合 Next.js 15 App Router 最佳实践
- ✅ 代码行数减少 50-70%
- ✅ 无 TypeScript 类型错误
- ✅ 通过所有 ESLint 检查

## 进度跟踪

- [x] 应收账款模块 (`lib/services/receivables-service.ts`) - 减少 67%
- [x] 分类管理模块 (`lib/services/category-service.ts`) - 减少 62%
- [x] 供应商管理模块 (`lib/services/supplier-service.ts`) - 减少 37%
- [ ] 产品搜索模块
- [ ] 库存预警模块
- [ ] 仪表盘预警模块
- [ ] 客户管理模块优化
- [ ] 往来账单模块优化
- [ ] 入库管理模块优化
- [ ] 批次规格模块优化

---

**最后更新**: 2025-10-03
**重构负责人**: AI Assistant
**审核状态**: 进行中
**已完成**: 3/10 模块
