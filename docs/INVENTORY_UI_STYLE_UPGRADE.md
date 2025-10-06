# 库存模块UI风格升级方案

> 基于产品模块UI风格的库存模块改进方案

## 📊 产品模块UI风格分析

### 1. **工具栏设计风格** (ProductListToolbar)

```tsx
// ✅ 产品模块标准样式
<Card className="overflow-hidden shadow-lg shadow-gray-200/50">
  <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
    <div className="flex items-center justify-between">
      {/* 左侧：图标 + 标题 + 选中状态 */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
          <Package className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            产品管理
          </h1>
          <p className="text-sm text-gray-600">管理产品信息、库存和分类</p>
        </div>
        {selectedCount > 0 && (
          <div className="ml-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
            <span className="text-sm font-medium text-blue-900">
              已选择 {selectedCount} 个产品
            </span>
            <Button variant="destructive" size="sm">
              批量删除
            </Button>
          </div>
        )}
      </div>

      {/* 右侧：主要操作按钮 */}
      <Button size="lg" className="h-11 gap-2 bg-blue-600 shadow-md shadow-blue-600/30 transition-all hover:scale-105 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/40">
        <Plus className="h-5 w-5" />
        新增产品
      </Button>
    </div>
  </CardContent>
</Card>
```

**关键特征：**
- ✅ 渐变背景：`bg-gradient-to-r from-slate-50 to-gray-50`
- ✅ 阴影层次：`shadow-lg shadow-gray-200/50`
- ✅ 图标容器：圆角蓝色背景 + 白色阴影 `bg-blue-600 shadow-lg shadow-blue-600/30`
- ✅ 交互动效：`hover:scale-105` + `transition-all`
- ✅ 选中状态：蓝色高亮背景 `bg-blue-50` + 边框 `border-blue-200`

---

### 2. **搜索筛选器风格** (ProductSearchFilters)

```tsx
// ✅ 产品模块搜索样式
<div className="rounded-lg border bg-white p-4 shadow-md shadow-gray-200/50">
  <UnifiedSearchBar
    searchPlaceholder="搜索产品编码、名称或规格..."
    debounceDelay={SEARCH_CONFIG.DEBOUNCE_DELAY.DEFAULT}
    filters={[...]}
  />

  {/* 清空筛选按钮 */}
  {hasActiveFilters && (
    <div className="mt-3 flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onClearFilters}
        className="h-9 transition-all hover:border-blue-300 hover:bg-blue-50"
      >
        <Filter className="mr-2 h-4 w-4" />
        清空筛选
      </Button>
    </div>
  )}
</div>
```

**关键特征：**
- ✅ 白色卡片背景：`bg-white`
- ✅ 柔和阴影：`shadow-md shadow-gray-200/50`
- ✅ 圆角边框：`rounded-lg border`
- ✅ 内边距：`p-4`
- ✅ 清空按钮hover效果：蓝色高亮

---

### 3. **表格容器风格**

```tsx
// ✅ 产品模块表格容器
<div className="overflow-hidden rounded-lg border bg-white shadow-lg shadow-gray-200/50">
  <ProductTable ... />

  {/* 分页组件 */}
  <div className="border-t bg-gray-50/50 px-4 py-3">
    <Pagination ... />
  </div>
</div>
```

**关键特征：**
- ✅ 圆角容器：`rounded-lg`
- ✅ 强阴影效果：`shadow-lg shadow-gray-200/50`
- ✅ 白色背景：`bg-white`
- ✅ 分页区域：淡灰色背景 `bg-gray-50/50` + 上边框 `border-t`

---

### 4. **表格行样式** (ProductTable)

```tsx
// ✅ 产品模块表格行
<TableRow className="transition-colors hover:bg-blue-50/50">
  <TableCell>
    <Checkbox ... />
  </TableCell>
  <TableCell className="font-medium text-blue-600">
    {product.code}
  </TableCell>
  <TableCell className="font-medium">{product.name}</TableCell>
  <TableCell className="text-gray-600">
    {product.category?.name || '-'}
  </TableCell>
  ...
</TableRow>
```

**关键特征：**
- ✅ Hover效果：`hover:bg-blue-50/50`
- ✅ 过渡动画：`transition-colors`
- ✅ 产品编码：蓝色字体 `text-blue-600` + 加粗 `font-medium`
- ✅ 次要文本：灰色 `text-gray-600`

---

## ⚠️ 库存模块当前问题

### 1. **工具栏缺少统一风格**

❌ **当前库存模块** (`InventorySearchToolbar`):
```tsx
// 没有统一的工具栏卡片
// 直接使用搜索栏，缺少视觉层次
```

### 2. **表格容器样式不一致**

❌ **当前库存模块** (`ERPInventoryList`):
```tsx
<div className="overflow-hidden rounded-lg border bg-white shadow-lg shadow-gray-200/50">
  <div className="bg-muted/50 border-b px-3 py-2">  {/* ❌ 与产品模块不同 */}
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-medium">库存列表</h3>
    </div>
  </div>
  ...
</div>
```

### 3. **缺少图标和视觉标识**

❌ 库存模块缺少：
- 左上角的大图标 + 阴影
- 渐变背景卡片
- 选中状态的蓝色高亮

---

## 🔧 改进方案

### 第一步：创建库存工具栏组件

**新建文件：** `components/inventory/inventory-list-toolbar.tsx`

```tsx
'use client';

import { Package, Plus, Trash2, FileUp, FileDown, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface InventoryListToolbarProps {
  selectedCount: number;
  onBatchDelete?: () => void;
  onBatchInbound?: () => void;
  onBatchOutbound?: () => void;
}

export function InventoryListToolbar({
  selectedCount,
  onBatchDelete,
  onBatchInbound,
  onBatchOutbound,
}: InventoryListToolbarProps) {
  const router = useRouter();

  return (
    <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
      <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                库存管理
              </h1>
              <p className="text-sm text-gray-600">实时监控库存水平和库存变动</p>
            </div>
            {selectedCount > 0 && (
              <div className="ml-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                <span className="text-sm font-medium text-blue-900">
                  已选择 {selectedCount} 条记录
                </span>
                <div className="flex gap-1">
                  {onBatchInbound && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onBatchInbound}
                      className="h-8 bg-white"
                    >
                      <FileDown className="mr-1.5 h-3.5 w-3.5" />
                      批量入库
                    </Button>
                  )}
                  {onBatchOutbound && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onBatchOutbound}
                      className="h-8 bg-white"
                    >
                      <FileUp className="mr-1.5 h-3.5 w-3.5" />
                      批量出库
                    </Button>
                  )}
                  {onBatchDelete && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={onBatchDelete}
                      className="h-8"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      批量删除
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => router.push('/inventory/adjust')}
              variant="outline"
              size="lg"
              className="h-11 gap-2 shadow-sm transition-all hover:scale-105 hover:shadow-md"
            >
              <Settings className="h-5 w-5" />
              库存调整
            </Button>
            <Button
              onClick={() => router.push('/inventory/inbound/create')}
              size="lg"
              className="h-11 gap-2 bg-blue-600 shadow-md shadow-blue-600/30 transition-all hover:scale-105 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/40"
            >
              <Plus className="h-5 w-5" />
              产品入库
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### 第二步：优化搜索筛选器

**修改文件：** `components/inventory/InventorySearchToolbar.tsx`

```tsx
'use client';

import { Filter } from 'lucide-react';

import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Button } from '@/components/ui/button';
import { SEARCH_CONFIG } from '@/lib/config/search';

// ... 接口定义 ...

export function InventorySearchToolbar({ ... }: Props) {
  const hasActiveFilters =
    queryParams.lowStock ||
    queryParams.hasStock ||
    queryParams.categoryId;

  return (
    <div className="rounded-lg border bg-white p-4 shadow-md shadow-gray-200/50">
      <UnifiedSearchBar
        searchValue={queryParams.search || ''}
        onSearchChange={onSearch}
        searchPlaceholder="搜索产品编码、名称或规格..."
        debounceDelay={SEARCH_CONFIG.DEBOUNCE_DELAY.DEFAULT}
        filters={[
          {
            key: 'category',
            label: '分类',
            options: categoryOptions.map(cat => ({
              label: cat.name,
              value: cat.id,
            })),
            width: 'w-[140px]',
          },
          {
            key: 'lowStock',
            label: '库存状态',
            options: [
              { label: '低库存', value: 'true' },
              { label: '正常库存', value: 'false' },
            ],
            width: 'w-[140px]',
          },
        ]}
        filterValues={{
          category: queryParams.categoryId,
          lowStock: queryParams.lowStock ? 'true' : undefined,
        }}
        onFilterChange={(key, value) => {
          if (key === 'category') {
            onFilter('categoryId', value);
          } else if (key === 'lowStock') {
            onFilter('lowStock', value === 'true');
          }
        }}
      />

      {/* 清空筛选按钮 */}
      {hasActiveFilters && (
        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onFilter('categoryId', undefined);
              onFilter('lowStock', false);
              onFilter('hasStock', false);
            }}
            className="h-9 transition-all hover:border-blue-300 hover:bg-blue-50"
          >
            <Filter className="mr-2 h-4 w-4" />
            清空筛选
          </Button>
        </div>
      )}
    </div>
  );
}
```

---

### 第三步：统一表格样式

**修改文件：** `components/inventory/erp-inventory-list.tsx`

```tsx
export const ERPInventoryList = React.memo<ERPInventoryListProps>(
  ({ ... }) => {
    return (
      <div className="space-y-6">  {/* ✅ 改为 space-y-6 与产品模块一致 */}
        {/* 工具栏 - 新增 */}
        <InventoryListToolbar
          selectedCount={selectedInventoryIds.length}
          onBatchInbound={handleInbound}
          onBatchOutbound={handleOutbound}
        />

        {/* 搜索和筛选 - 使用新样式 */}
        <InventorySearchToolbar
          queryParams={queryParams}
          categoryOptions={categoryOptions}
          onSearch={onSearch}
          onFilter={onFilter}
        />

        {/* 库存表格 - 移除顶部标题栏 */}
        <div className="overflow-hidden rounded-lg border bg-white shadow-lg shadow-gray-200/50">
          <InventoryTable
            data={data.data}
            selectedIds={selectedInventoryIds}
            isAllSelected={isAllSelected}
            canSelectAll={canSelectAll}
            onSelectAll={handleSelectAll}
            onSelectRow={handleRowSelect}
            onAdjust={handleAdjust}
            useVirtualization={data.data.length > 50}
          />

          {/* 分页 - 使用产品模块样式 */}
          {data.pagination && (
            <div className="border-t bg-gray-50/50 px-4 py-3">
              <Pagination
                pagination={data.pagination}
                onPageChange={onPageChange}
                showRange
                showTotal
              />
            </div>
          )}
        </div>
      </div>
    );
  }
);
```

---

## 📋 实施检查清单

### 高优先级（立即实施）

- [ ] 创建 `InventoryListToolbar` 组件
- [ ] 修改 `InventorySearchToolbar` 使用统一搜索栏样式
- [ ] 更新 `ERPInventoryList` 整体布局和间距
- [ ] 移除表格顶部的 `bg-muted/50` 标题栏
- [ ] 统一分页区域样式

### 中优先级（后续优化）

- [ ] 添加表格行 hover 效果 `hover:bg-blue-50/50`
- [ ] 优化产品编码显示为蓝色 `text-blue-600`
- [ ] 添加操作按钮的 hover 动效
- [ ] 统一 Badge 组件样式

### 低优先级（可选）

- [ ] 添加批量操作的动画效果
- [ ] 优化移动端响应式布局
- [ ] 添加骨架屏加载效果

---

## 🎨 设计规范总结

### 颜色系统

- **主色调：** 蓝色 (`blue-600`, `blue-50`)
- **背景渐变：** `from-slate-50 to-gray-50`
- **阴影：** `shadow-lg shadow-gray-200/50`
- **边框：** `border` (默认灰色)

### 间距系统

- **卡片间距：** `space-y-6`
- **卡片内边距：** `p-6` (工具栏), `p-4` (搜索)
- **图标容器：** `h-12 w-12`
- **按钮高度：** `h-11` (大), `h-9` (小)

### 交互效果

- **Hover缩放：** `hover:scale-105`
- **过渡动画：** `transition-all`
- **阴影变化：** `hover:shadow-lg hover:shadow-blue-600/40`
- **背景高亮：** `hover:bg-blue-50/50`

---

**最后更新：** 2025-10-06
**参考模块：** 产品管理 (`/products`)
