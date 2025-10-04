# 前端架构规范修复指南

> 配合 FRONTEND_ARCHITECTURE_AUDIT.md 使用  
> 提供详细的修复步骤和代码示例

---

## 🚀 快速开始

### 修复顺序

1. ✅ 删除测试文件（5分钟）
2. ✅ 修复 page.tsx 的 'use client' 问题（4-6小时）
3. ✅ 创建 modules 目录结构（2-3小时）
4. ✅ 拆分超长文件（6-8小时）

---

## 📝 详细修复步骤

### 步骤 1: 删除测试文件（P0）

**执行命令**:

```bash
# 1. 删除测试页面
rm -rf app/\(dashboard\)/sales-orders/test
rm -rf app/\(dashboard\)/factory-shipments/test
rm -rf app/\(dashboard\)/sales-orders/intelligent-search-test
rm -rf app/\(dashboard\)/sales-orders/manual-product-test
rm -rf app/\(dashboard\)/sales-orders/transfer-cost-test
rm -rf app/\(dashboard\)/sales-orders/transfer-test
rm -rf app/\(dashboard\)/sales-orders/ui-improvement-test

# 2. 删除示例文件
rm -rf components/examples

# 3. 更新 .gitignore
echo "" >> .gitignore
echo "# 测试文件" >> .gitignore
echo "**/test/" >> .gitignore
echo "**/*-test/" >> .gitignore
echo "**/examples/" >> .gitignore

# 4. 提交更改
git add .
git commit -m "chore: 删除测试文件和示例文件

- 删除所有测试页面目录
- 删除示例组件目录
- 更新 .gitignore 防止再次提交测试文件"
```

**验证**:

```bash
# 确认测试文件已删除
find app -name "*test*" -type d
find components -name "examples" -type d

# 应该没有输出
```

---

### 步骤 2: 修复 page.tsx 的 'use client' 问题（P0）

#### 2.1 修复 app/(dashboard)/customers/page.tsx

**当前代码**（违规）:

```typescript
// app/(dashboard)/customers/page.tsx
'use client';

import * as React from 'react';
import { CustomerDeleteDialog } from '@/components/customers/customer-delete-dialog';
import { CustomerDetailDialog } from '@/components/customers/customer-detail-dialog';
import { ERPCustomerList } from '@/components/customers/erp-customer-list';
import type { Customer } from '@/lib/types/customer';

export default function CustomersPage() {
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null);

  const handleViewDetail = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setDetailDialogOpen(true);
  };

  const handleDelete = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <ERPCustomerList onViewDetail={handleViewDetail} onDelete={handleDelete} />
      <CustomerDetailDialog customerId={selectedCustomerId} open={detailDialogOpen} onOpenChange={setDetailDialogOpen} />
      <CustomerDeleteDialog customer={selectedCustomer} open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} />
    </div>
  );
}
```

**修复后代码**:

**文件 1: app/(dashboard)/customers/page.tsx** (Server Component)

```typescript
import { Suspense } from 'react';

import { CustomersPageClient } from './page-client';
import { CustomerListSkeleton } from '@/components/modules/customers/customer-list-skeleton';
import { getCustomers } from '@/lib/api/handlers/customers';
import { paginationConfig } from '@/lib/env';

/**
 * 客户管理页面 - Server Component
 * 负责数据获取和 SEO 优化
 */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // 解析查询参数
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || paginationConfig.defaultPageSize;
  const search = (params.search as string) || '';

  // 服务器端获取初始数据
  const initialData = await getCustomers({
    page,
    limit,
    search,
  });

  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <Suspense fallback={<CustomerListSkeleton />}>
        <CustomersPageClient
          initialData={initialData}
          initialParams={{ page, limit, search }}
        />
      </Suspense>
    </div>
  );
}
```

**文件 2: app/(dashboard)/customers/page-client.tsx** (Client Component)

```typescript
'use client';

import * as React from 'react';

import { CustomerDeleteDialog } from '@/components/modules/customers/customer-delete-dialog';
import { CustomerDetailDialog } from '@/components/modules/customers/customer-detail-dialog';
import { ERPCustomerList } from '@/components/modules/customers/erp-customer-list';
import type { Customer } from '@/lib/types/customer';
import type { PaginatedResponse } from '@/lib/types/common';

interface CustomersPageClientProps {
  initialData: PaginatedResponse<Customer>;
  initialParams: {
    page: number;
    limit: number;
    search: string;
  };
}

/**
 * 客户管理页面客户端组件
 * 负责用户交互和状态管理
 */
export function CustomersPageClient({
  initialData,
  initialParams
}: CustomersPageClientProps) {
  // 对话框状态管理
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null);

  // 操作处理函数
  const handleViewDetail = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setDetailDialogOpen(true);
  };

  const handleDelete = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDeleteDialogOpen(true);
  };

  return (
    <>
      <ERPCustomerList
        initialData={initialData}
        initialParams={initialParams}
        onViewDetail={handleViewDetail}
        onDelete={handleDelete}
      />

      {/* 对话框组件 */}
      <CustomerDetailDialog
        customerId={selectedCustomerId}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />

      <CustomerDeleteDialog
        customer={selectedCustomer}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </>
  );
}
```

**文件 3: components/modules/customers/customer-list-skeleton.tsx** (新建)

```typescript
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function CustomerListSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-8 w-48" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

**提交**:

```bash
git add app/\(dashboard\)/customers/
git commit -m "refactor(customers): 修复 page.tsx 架构违规

- 将 page.tsx 改为 Server Component
- 创建 page-client.tsx 处理客户端交互
- 添加 CustomerListSkeleton 组件
- 在服务器端获取初始数据"
```

---

#### 2.2 修复 app/(dashboard)/inventory/page.tsx

**修复步骤**:

**文件 1: app/(dashboard)/inventory/page.tsx** (Server Component)

```typescript
import { Suspense } from 'react';

import { InventoryPageClient } from './page-client';
import { InventoryListSkeleton } from '@/components/modules/inventory/inventory-list-skeleton';
import { getInventory } from '@/lib/api/handlers/inventory';
import { getCategoryOptions } from '@/lib/api/categories';
import { paginationConfig } from '@/lib/env';

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || paginationConfig.defaultPageSize;
  const search = (params.search as string) || '';
  const categoryId = (params.categoryId as string) || '';
  const lowStock = params.lowStock === 'true';
  const hasStock = params.hasStock === 'true';

  // 并行获取数据
  const [initialData, categoryOptions] = await Promise.all([
    getInventory({ page, limit, search, categoryId, lowStock, hasStock }),
    getCategoryOptions(),
  ]);

  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <Suspense fallback={<InventoryListSkeleton />}>
        <InventoryPageClient
          initialData={initialData}
          categoryOptions={categoryOptions}
          initialParams={{ page, limit, search, categoryId, lowStock, hasStock }}
        />
      </Suspense>
    </div>
  );
}
```

**文件 2: app/(dashboard)/inventory/page-client.tsx** (Client Component)

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

import { ERPInventoryList } from '@/components/modules/inventory/erp-inventory-list';
import { useOptimizedInventoryQuery } from '@/hooks/use-optimized-inventory-query';
import { paginationConfig } from '@/lib/env';
import type { Inventory, InventoryQueryParams } from '@/lib/types/inventory';
import type { PaginatedResponse } from '@/lib/types/common';
import type { CategoryOption } from '@/lib/types/category';

interface InventoryPageClientProps {
  initialData: PaginatedResponse<Inventory>;
  categoryOptions: CategoryOption[];
  initialParams: InventoryQueryParams;
}

export function InventoryPageClient({
  initialData,
  categoryOptions,
  initialParams,
}: InventoryPageClientProps) {
  const [queryParams, setQueryParams] = React.useState<InventoryQueryParams>(initialParams);

  // 使用优化的查询 Hook
  const { data, isLoading, error } = useOptimizedInventoryQuery({
    params: queryParams,
    initialData,
  });

  // 搜索处理
  const handleSearch = React.useCallback((value: string) => {
    setQueryParams(prev => ({ ...prev, search: value, page: 1 }));
  }, []);

  // 筛选处理
  const handleFilter = React.useCallback(
    (key: keyof InventoryQueryParams, value: string | number | boolean | undefined) => {
      setQueryParams(prev => ({ ...prev, [key]: value, page: 1 }));
    },
    []
  );

  // 分页处理
  const handlePageChange = React.useCallback((page: number) => {
    setQueryParams(prev => ({ ...prev, page }));
  }, []);

  if (error) {
    return (
      <div className="rounded border bg-card p-4 text-center text-red-600">
        加载失败: {error instanceof Error ? error.message : '未知错误'}
      </div>
    );
  }

  return (
    <ERPInventoryList
      data={data}
      categoryOptions={categoryOptions}
      queryParams={queryParams}
      onSearch={handleSearch}
      onFilter={handleFilter}
      onPageChange={handlePageChange}
      isLoading={isLoading}
    />
  );
}
```

**提交**:

```bash
git add app/\(dashboard\)/inventory/
git commit -m "refactor(inventory): 修复 page.tsx 架构违规

- 将 page.tsx 改为 Server Component
- 创建 page-client.tsx 处理客户端交互
- 在服务器端并行获取库存数据和分类选项
- 优化首屏加载性能"
```

---

### 步骤 3: 创建 components/modules 目录结构（P1）

**执行脚本**:

```bash
#!/bin/bash
# fix-components-structure.sh

echo "🚀 开始重组 components 目录结构..."

# 1. 创建 modules 目录
mkdir -p components/modules

# 2. 移动业务组件
echo "📦 移动业务组件到 modules/..."
mv components/customers components/modules/
mv components/products components/modules/
mv components/inventory components/modules/
mv components/sales-orders components/modules/
mv components/finance components/modules/
mv components/return-orders components/modules/
mv components/factory-shipments components/modules/
mv components/payments components/modules/
mv components/settings components/modules/
mv components/categories components/modules/
mv components/dashboard components/modules/

echo "✅ 组件移动完成"

# 3. 更新导入路径
echo "🔄 更新导入路径..."

# 使用 find 和 sed 批量替换
find app components lib hooks -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e "s|@/components/customers|@/components/modules/customers|g" \
  -e "s|@/components/products|@/components/modules/products|g" \
  -e "s|@/components/inventory|@/components/modules/inventory|g" \
  -e "s|@/components/sales-orders|@/components/modules/sales-orders|g" \
  -e "s|@/components/finance|@/components/modules/finance|g" \
  -e "s|@/components/return-orders|@/components/modules/return-orders|g" \
  -e "s|@/components/factory-shipments|@/components/modules/factory-shipments|g" \
  -e "s|@/components/payments|@/components/modules/payments|g" \
  -e "s|@/components/settings|@/components/modules/settings|g" \
  -e "s|@/components/categories|@/components/modules/categories|g" \
  -e "s|@/components/dashboard|@/components/modules/dashboard|g" \
  {} +

echo "✅ 导入路径更新完成"

# 4. 验证
echo "🔍 验证修改..."
npm run type-check

if [ $? -eq 0 ]; then
  echo "✅ TypeScript 检查通过"
else
  echo "❌ TypeScript 检查失败，请手动修复"
  exit 1
fi

echo "🎉 目录结构重组完成！"
```

**执行**:

```bash
chmod +x fix-components-structure.sh
./fix-components-structure.sh
```

**提交**:

```bash
git add components/
git add app/
git add lib/
git add hooks/
git commit -m "refactor: 重组 components 目录结构

- 创建 components/modules/ 目录
- 移动所有业务组件到 modules/ 下
- 更新所有导入路径
- 符合前端架构规范"
```

---

### 步骤 4: 拆分超长文件（P1）

#### 4.1 拆分 app/(dashboard)/suppliers/[id]/page.tsx (459行)

**拆分策略**:

```
suppliers/[id]/page.tsx (459行)
  ↓ 拆分为
├── page.tsx (主文件, <100行)
├── page-client.tsx (客户端逻辑, <150行)
└── components/
    ├── supplier-detail-header.tsx (<80行)
    ├── supplier-basic-info.tsx (<100行)
    ├── supplier-stats.tsx (<80行)
    └── supplier-transactions.tsx (<150行)
```

**详细代码见下一个文件...**

---

## 📊 修复进度跟踪

### P0 任务

- [ ] 删除测试文件
- [ ] 修复 customers/page.tsx
- [ ] 修复 inventory/page.tsx
- [ ] 修复 return-orders/page.tsx
- [ ] 修复 suppliers/[id]/page.tsx
- [ ] 修复 customers/create/page.tsx

### P1 任务

- [ ] 创建 modules 目录结构
- [ ] 拆分 suppliers/[id]/page.tsx
- [ ] 拆分 erp-sales-order-form.tsx
- [ ] 拆分 enhanced-sales-order-form.tsx
- [ ] 拆分 erp-inventory-list.tsx

---

## 🔧 常见问题

### Q1: 如何判断组件应该是 Server Component 还是 Client Component?

**Server Component** (默认):

- ✅ 需要直接访问数据库或后端服务
- ✅ 需要 SEO 优化
- ✅ 不需要浏览器 API
- ✅ 不需要状态管理（useState, useContext）
- ✅ 不需要事件监听器

**Client Component** ('use client'):

- ✅ 需要使用 React Hooks (useState, useEffect, etc.)
- ✅ 需要事件监听器 (onClick, onChange, etc.)
- ✅ 需要浏览器 API (localStorage, window, etc.)
- ✅ 需要使用第三方库（如 TanStack Query）

### Q2: 如何在 Server Component 和 Client Component 之间传递数据?

通过 props 传递:

```typescript
// Server Component
export default async function Page() {
  const data = await fetchData();
  return <ClientComponent initialData={data} />;
}

// Client Component
'use client';
export function ClientComponent({ initialData }) {
  const [data, setData] = useState(initialData);
  // ...
}
```

### Q3: 修复后如何验证?

```bash
# 1. TypeScript 检查
npm run type-check

# 2. ESLint 检查
npm run lint

# 3. 构建检查
npm run build

# 4. 运行开发服务器
npm run dev
```

---

**下一步**: 查看 FRONTEND_ARCHITECTURE_AUDIT.md 了解完整的审查报告
