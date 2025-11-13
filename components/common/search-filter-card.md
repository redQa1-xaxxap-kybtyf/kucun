# SearchFilterCard 组件使用文档

## 概述

`SearchFilterCard` 是一个统一的搜索筛选容器组件,用于替换项目中所有的自定义搜索筛选组件(如 `CustomerSearchFilters`、`SupplierSearchFilters` 等)。

## ✅ 迁移完成状态

**迁移完成日期**: 2025-01-13

已成功迁移以下页面:

1. ✅ 客户管理页面 (`app/(dashboard)/customers/page-client.tsx`)
2. ✅ 供应商管理页面 (`components/suppliers/suppliers-page-client.tsx`)
3. ✅ 产品管理页面 (`components/products/erp-product-list.tsx`)
4. ✅ 销售订单页面 (`components/sales-orders/erp-sales-order-list.tsx`)
5. ✅ 库存管理页面 (`components/inventory/InventorySearchToolbar.tsx`)
6. ✅ 应收款页面 (`components/finance/receivables-client/ReceivablesFilterCard.tsx`)
7. ✅ 应退款页面 (`components/finance/refunds-client.tsx`)

**已删除的旧组件**:

- ❌ `components/customers/customer-search-filters.tsx`
- ❌ `components/suppliers/supplier-search-filters.tsx`
- ❌ `components/products/product-search-filters.tsx`
- ❌ `components/sales-orders/sales-order-search-filters.tsx`

## 设计原则

- **KISS (Keep It Simple, Stupid)**: 简化组件层级,直接在页面中使用,无需额外的包装组件
- **DRY (Don't Repeat Yourself)**: 统一所有页面的搜索筛选实现,消除重复代码
- **SOLID**: 单一职责,只负责搜索筛选 UI 展示

## 功能特性

- ✅ 统一的 Card 容器样式
- ✅ 支持搜索框(带防抖)
- ✅ 支持下拉筛选器
- ✅ 支持日期范围筛选
- ✅ 支持切换按钮
- ✅ 支持操作按钮
- ✅ 支持清空筛选功能
- ✅ 响应式布局
- ✅ 加载状态指示

## 基础用法

### 1. 简单搜索

```tsx
import { SearchFilterCard } from '@/components/common/search-filter-card';

<SearchFilterCard
  searchValue={searchValue}
  onSearchChange={handleSearch}
  searchPlaceholder="搜索客户名称、电话..."
/>;
```

### 2. 搜索 + 下拉筛选

```tsx
<SearchFilterCard
  searchValue={searchValue}
  onSearchChange={handleSearch}
  searchPlaceholder="搜索订单号、客户名称..."
  filters={[
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '待处理', value: 'pending' },
        { label: '已完成', value: 'completed' },
      ],
      width: 'w-32',
    },
  ]}
  filterValues={{ status: statusFilter }}
  onFilterChange={handleFilterChange}
/>
```

### 3. 搜索 + 日期范围筛选

```tsx
<SearchFilterCard
  searchValue={searchValue}
  onSearchChange={handleSearch}
  searchPlaceholder="搜索订单号..."
  dateRangeFilter={{
    key: 'dateRange',
    label: '日期范围',
    value: { startDate, endDate },
    onChange: handleDateRangeChange,
  }}
/>
```

### 4. 完整示例(搜索 + 筛选 + 日期 + 清空)

```tsx
<SearchFilterCard
  // 搜索
  searchValue={searchValue}
  onSearchChange={handleSearch}
  searchPlaceholder="搜索订单号、客户名称..."
  isSearching={isSearching}
  // 下拉筛选器
  filters={[
    {
      key: 'status',
      label: '状态',
      options: STATUS_OPTIONS,
      width: 'w-32',
    },
    {
      key: 'sortBy',
      label: '排序',
      options: SORT_OPTIONS,
      width: 'w-36',
    },
  ]}
  filterValues={{ status, sortBy }}
  onFilterChange={handleFilterChange}
  // 日期范围筛选
  dateRangeFilter={{
    key: 'dateRange',
    value: { startDate, endDate },
    onChange: handleDateRangeChange,
  }}
  // 清空筛选
  onClearFilters={handleClearFilters}
  showClearButton={true}
  // 样式
  variant="elevated"
/>
```

## API 参考

### SearchFilterCardProps

| 属性                | 类型                                                | 默认值      | 说明                       |
| ------------------- | --------------------------------------------------- | ----------- | -------------------------- |
| `searchValue`       | `string`                                            | `''`        | 搜索框的值                 |
| `onSearchChange`    | `(value: string) => void`                           | -           | 搜索值变化回调             |
| `searchPlaceholder` | `string`                                            | `'搜索...'` | 搜索框占位符               |
| `isSearching`       | `boolean`                                           | `false`     | 是否正在搜索(显示加载图标) |
| `filters`           | `FilterConfig[]`                                    | `[]`        | 下拉筛选器配置             |
| `filterValues`      | `Record<string, string \| undefined>`               | `{}`        | 筛选器当前值               |
| `onFilterChange`    | `(key: string, value: string \| undefined) => void` | -           | 筛选器变化回调             |
| `dateRangeFilter`   | `DateRangeFilterConfig`                             | -           | 日期范围筛选器配置         |
| `toggleButtons`     | `ToggleButton[]`                                    | `[]`        | 切换按钮配置               |
| `actionButtons`     | `ActionButton[]`                                    | `[]`        | 操作按钮配置               |
| `onClearFilters`    | `() => void`                                        | -           | 清空筛选回调               |
| `showClearButton`   | `boolean`                                           | `true`      | 是否显示清空按钮           |
| `hasActiveFilters`  | `boolean`                                           | -           | 是否有活跃筛选(自动计算)   |
| `className`         | `string`                                            | -           | 自定义样式类名             |
| `compact`           | `boolean`                                           | `false`     | 紧凑模式                   |
| `variant`           | `'default' \| 'bordered' \| 'elevated'`             | `'default'` | Card 样式变体              |

### FilterConfig

| 属性               | 类型             | 说明                            |
| ------------------ | ---------------- | ------------------------------- |
| `key`              | `string`         | 筛选器唯一标识                  |
| `label`            | `string`         | 筛选器标签                      |
| `options`          | `FilterOption[]` | 选项列表                        |
| `width`            | `string`         | Tailwind 宽度类名(如 `'w-32'`)  |
| `placeholder`      | `string`         | 占位符文本                      |
| `includeAllOption` | `boolean`        | 是否包含"全部"选项(默认 `true`) |

### DateRangeFilterConfig

| 属性          | 类型                              | 说明             |
| ------------- | --------------------------------- | ---------------- |
| `key`         | `string`                          | 筛选器唯一标识   |
| `label`       | `string`                          | 标签文本         |
| `value`       | `DateRangeValue`                  | 当前日期范围值   |
| `onChange`    | `(value: DateRangeValue) => void` | 变化回调         |
| `placeholder` | `string`                          | 占位符文本       |
| `showPresets` | `boolean`                         | 是否显示快捷预设 |
| `className`   | `string`                          | 自定义样式类名   |

## 迁移指南

### 从 CustomerSearchFilters 迁移

**迁移前:**

```tsx
<CustomerSearchFilters
  searchValue={search}
  sortBy={sortBy}
  sortOrder={sortOrder}
  onSearchChange={handleSearch}
  onSortChange={handleSortChange}
/>
```

**迁移后:**

```tsx
<SearchFilterCard
  searchValue={search}
  onSearchChange={handleSearch}
  searchPlaceholder="搜索客户名称、电话或地址..."
  filters={[
    {
      key: 'sortBy',
      label: '排序字段',
      options: CUSTOMER_SORT_OPTIONS,
      width: 'w-36',
    },
    {
      key: 'sortOrder',
      label: '排序方式',
      options: [
        { label: '升序', value: 'asc' },
        { label: '降序', value: 'desc' },
      ],
      width: 'w-28',
    },
  ]}
  filterValues={{ sortBy, sortOrder }}
  onFilterChange={(key, value) => {
    if (key === 'sortBy' && value) {
      handleSortChange(value, sortOrder);
    } else if (key === 'sortOrder' && value) {
      handleSortChange(sortBy, value as 'asc' | 'desc');
    }
  }}
/>
```

### 从 SupplierSearchFilters 迁移

**迁移前:**

```tsx
<SupplierSearchFilters
  searchValue={searchInput}
  statusFilter={status}
  onSearchChange={handleSearch}
  onStatusChange={handleStatusChange}
/>
```

**迁移后:**

```tsx
<SearchFilterCard
  searchValue={searchInput}
  onSearchChange={handleSearch}
  searchPlaceholder="搜索供应商名称或联系电话..."
  filters={[
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '启用', value: 'active' },
        { label: '禁用', value: 'inactive' },
        { label: '暂停', value: 'suspended' },
      ],
      width: 'w-32',
    },
  ]}
  filterValues={{ status }}
  onFilterChange={(key, value) => {
    if (key === 'status') {
      handleStatusChange(value as SupplierStatusFilter);
    }
  }}
/>
```

## 样式变体

### default (默认)

```tsx
<SearchFilterCard variant="default" />
```

- 边框: `border-[hsl(var(--color-border-secondary))]`
- 无阴影

### bordered (带边框)

```tsx
<SearchFilterCard variant="bordered" />
```

- 边框: `border-[hsl(var(--color-border-primary))]`
- 无阴影

### elevated (带阴影)

```tsx
<SearchFilterCard variant="elevated" />
```

- 边框: `border-[hsl(var(--color-border-primary))]`
- 阴影: `shadow-[var(--shadow-light)]`

## 最佳实践

1. **防抖处理**: 搜索防抖应该在父组件中处理,`SearchFilterCard` 不负责防抖
2. **URL 同步**: 筛选条件应该同步到 URL 参数,便于分享和刷新
3. **清空筛选**: 提供 `onClearFilters` 回调,一键清空所有筛选条件
4. **加载状态**: 使用 `isSearching` 属性显示搜索加载状态
5. **响应式**: 组件已内置响应式布局,无需额外处理

## 注意事项

- ⚠️ `debounceDelay` 参数已被忽略,防抖应该在父组件中处理
- ⚠️ 迁移后可以删除旧的 `*SearchFilters` 组件
- ⚠️ 确保 `filterValues` 中的值与 `filters` 中的 `key` 对应
- ⚠️ 日期范围值必须是 ISO 8601 格式字符串(`'2025-01-01'`)
