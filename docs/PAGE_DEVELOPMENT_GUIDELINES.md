# 页面开发规范

> 统一的页面开发标准，确保代码质量和用户体验一致性

## 📋 目录

- [面包屑和标题规范](#面包屑和标题规范)
- [页面架构规范](#页面架构规范)
- [开发流程](#开发流程)
- [常见错误和解决方案](#常见错误和解决方案)
- [检查清单](#检查清单)

---

## 面包屑和标题规范

### ✅ 正确做法

#### 1. 在 PATH_TITLES 中添加路径映射

**文件位置：** `components/common/Breadcrumb.tsx`

```typescript
const PATH_TITLES: Record<string, string> = {
  // 主路由
  '/your-module': '模块名称',
  '/your-module/create': '新建XX',

  // 子路由（用于动态路由识别）
  subpath: '子路径名称',
};
```

#### 2. 不在页面中硬编码标题和面包屑

```typescript
// ✅ 正确 - 依赖 DashboardLayoutClient 自动渲染
export default function DetailPage() {
  return (
    <div className="space-y-6">
      {/* 面包屑由布局自动渲染，无需手动添加 */}

      {/* 可选：显示额外信息（非标题） */}
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">
          订单号：{order.orderNumber}
        </span>
        <div className="flex items-center space-x-2">
          {/* 操作按钮 */}
        </div>
      </div>

      {/* 页面主要内容 */}
      <Card>...</Card>
    </div>
  );
}
```

#### 3. 面包屑自动显示机制

项目已在 `DashboardLayoutClient` 中集成面包屑组件：

```typescript
// components/common/DashboardLayoutClient.tsx
{showBreadcrumb && (
  <div className="mb-6 space-y-4">
    <Breadcrumb />
  </div>
)}
```

**这意味着：**

- ✅ 所有 `app/(dashboard)` 下的页面自动显示面包屑
- ✅ 面包屑根据 URL 路径自动生成
- ✅ 标题从 PATH_TITLES 映射表获取
- ✅ 支持动态路由（ID）自动识别

---

### ❌ 错误做法

#### 1. 在页面中硬编码 `<h1>` 标题

```typescript
// ❌ 错误 - 不要这样做
export default function DetailPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          <span>返回</span>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">订单详情</h1>  {/* ❌ 硬编码标题 */}
          <p className="text-muted-foreground">...</p>
        </div>
      </div>
      {/* ... */}
    </div>
  );
}
```

**问题：**

- ❌ 与面包屑标题不一致
- ❌ 维护困难，需要修改多处
- ❌ 违反统一组件原则
- ❌ 增加代码冗余

#### 2. 创建自定义面包屑组件

```typescript
// ❌ 错误 - 不要重复实现
<nav>
  <Link href="/orders">订单列表</Link>
  <span>/</span>
  <span>订单详情</span>
</nav>
```

#### 3. 创建自定义返回按钮

```typescript
// ❌ 错误 - 面包屑已提供导航功能
<Button onClick={() => router.back()}>
  <ArrowLeft className="h-4 w-4" />
  返回
</Button>
```

---

## 页面架构规范

### 三级组件架构

遵循项目标准的三级组件架构：

```
Page (Server Component)
  ↓
Container (Client Component)
  ↓
UI Components
```

### 示例代码

#### 1. Page 层（Server Component）

```typescript
// app/(dashboard)/your-module/[id]/page.tsx
import { YourDetailContainer } from './page-client';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function YourDetailPage({ params }: PageProps) {
  const { id } = await params;

  // 可选：服务端数据预取
  // const data = await fetchData(id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
      <YourDetailContainer id={id} />
    </div>
  );
}
```

#### 2. Container 层（Client Component）

```typescript
// app/(dashboard)/your-module/[id]/page-client.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { YourDetailUI } from '@/components/your-module/detail-ui';

export function YourDetailContainer({ id }: { id: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['your-module', id],
    queryFn: () => fetchDetail(id),
  });

  if (isLoading) return <ContentLoading />;
  if (error) return <ErrorMessage />;

  return <YourDetailUI data={data} />;
}
```

#### 3. UI 层（纯展示组件）

```typescript
// components/your-module/detail-ui.tsx
export function YourDetailUI({ data }: Props) {
  return (
    <div className="space-y-6">
      {/* 额外信息（非标题） */}
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">
          {data.subtitle}
        </span>
        <ActionButtons data={data} />
      </div>

      {/* 主要内容 */}
      <DetailCards data={data} />
    </div>
  );
}
```

---

## 开发流程

### 新建页面时的标准流程

1. **检查 PATH_TITLES 映射**

   ```typescript
   // components/common/Breadcrumb.tsx
   const PATH_TITLES = {
     '/your-module': '模块名称', // ← 检查是否已存在
   };
   ```

2. **补充缺失的路径**

   ```typescript
   const PATH_TITLES = {
     // ... 现有映射 ...
     '/your-module': '模块名称', // 主路由
     '/your-module/create': '新建XX', // 创建页面
     'your-module': '模块名称', // 子路径（用于动态路由）
   };
   ```

3. **创建页面文件**
   - 遵循三级组件架构
   - 不硬编码标题和面包屑
   - 依赖布局自动渲染

4. **验证面包屑显示**
   - 访问页面检查面包屑是否正确
   - 检查标题是否从 PATH_TITLES 获取
   - 验证导航链接是否正常

---

## 常见错误和解决方案

### 问题 1：面包屑显示 URL 路径而非中文

**症状：**

```
首页 > your-module > abc123
```

**原因：**
PATH_TITLES 中缺少对应路径的映射

**解决：**

```typescript
const PATH_TITLES = {
  '/your-module': '模块名称', // ← 添加此映射
};
```

### 问题 2：动态 ID 路由显示不友好

**症状：**

```
首页 > 订单管理 > 详情 #abc12345
```

**原因：**
Breadcrumb 组件的自动识别逻辑未覆盖该模块

**解决：**
在 `components/common/Breadcrumb.tsx` 中添加识别规则：

```typescript
// Line 135-148
if (parentTitle === '你的模块') {
  title = isEditPage ? '详情' : '详情';
}
```

### 问题 3：页面标题和面包屑不一致

**症状：**

- 面包屑：`首页 > 订单管理 > 订单详情`
- 页面标题：`<h1>查看订单</h1>`

**原因：**
页面硬编码了不同的标题

**解决：**
移除页面中的 `<h1>` 标题，统一使用面包屑

---

## 检查清单

### 新建页面前

- [ ] 检查 PATH_TITLES 是否包含所需路径
- [ ] 补充缺失的路径映射
- [ ] 确认面包屑自动渲染机制
- [ ] 了解三级组件架构

### 开发过程中

- [ ] 不在页面中硬编码 `<h1>` 标题
- [ ] 不创建自定义面包屑组件
- [ ] 不创建自定义返回按钮
- [ ] 遵循三级组件架构
- [ ] 使用统一的 UI 组件

### 代码审查时

- [ ] PATH_TITLES 映射完整
- [ ] 无硬编码标题
- [ ] 无重复实现的面包屑
- [ ] 架构符合三级模式
- [ ] 所有文本使用中文

---

## 最佳实践示例

### 完整示例：订单详情页

```typescript
// app/(dashboard)/orders/[id]/page.tsx
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
      <OrderDetailContainer id={id} />
    </div>
  );
}

// app/(dashboard)/orders/[id]/page-client.tsx
'use client';

export function OrderDetailContainer({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['orders', id],
    queryFn: () => fetchOrder(id),
  });

  if (isLoading) return <ContentLoading />;

  return (
    <div className="space-y-6">
      {/* 额外信息（非标题） */}
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">
          订单号：{data.orderNumber}
        </span>
        <OrderActions order={data} />
      </div>

      {/* 主要内容 */}
      <OrderDetailCards order={data} />
    </div>
  );
}

// components/common/Breadcrumb.tsx 中的配置
const PATH_TITLES = {
  '/orders': '订单管理',
  '/orders/create': '新建订单',
  // 动态ID会自动识别为"订单详情"（基于父级路径）
};
```

---

## 参考资源

- [Breadcrumb 组件源码](../../components/common/Breadcrumb.tsx)
- [DashboardLayoutClient 源码](../../components/common/DashboardLayoutClient.tsx)
- [项目架构规范](./architecture-refactoring-plan.md)
- [错误处理指南](./ERROR_HANDLING_GUIDE.md)

---

**最后更新：** 2025-10-06
**维护者：** 开发团队
