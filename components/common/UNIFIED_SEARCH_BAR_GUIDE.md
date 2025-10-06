# UnifiedSearchBar 组件使用指南

## 概述

`UnifiedSearchBar` 是一个统一的、灵活的、可复用的搜索栏组件,支持:

- ✅ 防抖搜索 (优化性能)
- ✅ 多个筛选器 (Select 下拉框)
- ✅ 切换按钮 (如"库存偏低"、"有库存"等)
- ✅ 操作按钮 (如"新增"、"入库"、"出库"等)
- ✅ 清空按钮和加载指示器
- ✅ 紧凑模式 (适配移动端)
- ✅ 完全类型安全

---

## 基本用法

### 1. 最简单的搜索框

```tsx
import { UnifiedSearchBar } from '@/components/common/unified-search-bar';

function MyPage() {
  const [search, setSearch] = useState('');

  return (
    <UnifiedSearchBar
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="搜索产品..."
    />
  );
}
```

### 2. 带筛选器的搜索

```tsx
import { UnifiedSearchBar } from '@/components/common/unified-search-bar';

function ProductList() {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    status: undefined,
    category: undefined,
  });

  const filterConfigs = [
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '启用', value: 'active' },
        { label: '禁用', value: 'inactive' },
      ],
    },
    {
      key: 'category',
      label: '分类',
      options: categories.map(c => ({ label: c.name, value: c.id })),
      width: 'w-40',
    },
  ];

  const handleFilterChange = (key: string, value: string | undefined) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <UnifiedSearchBar
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="搜索产品编码、名称..."
      filters={filterConfigs}
      filterValues={filters}
      onFilterChange={handleFilterChange}
    />
  );
}
```

### 3. 完整功能示例 (库存页面)

```tsx
import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { AlertTriangle, Edit, Package, Plus } from 'lucide-react';

function InventoryPage() {
  const [search, setSearch] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [hasStock, setHasStock] = useState(false);
  const [filters, setFilters] = useState({
    category: undefined,
    sortBy: undefined,
  });

  return (
    <UnifiedSearchBar
      // 搜索配置
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="搜索产品名称、编码..."
      debounceDelay={400}

      // 操作按钮
      actionButtons={[
        {
          label: '入库',
          icon: <Plus className="mr-1 h-4 w-4" />,
          onClick: () => router.push('/inventory/inbound'),
        },
        {
          label: '出库',
          icon: <Package className="mr-1 h-4 w-4" />,
          onClick: () => router.push('/inventory/outbound'),
          variant: 'outline',
        },
        {
          label: '调整',
          icon: <Edit className="mr-1 h-4 w-4" />,
          onClick: () => setShowAdjustDialog(true),
          variant: 'outline',
        },
      ]}

      // 切换按钮
      toggleButtons={[
        {
          key: 'lowStock',
          label: '库存偏低',
          icon: <AlertTriangle className="mr-1 h-4 w-4" />,
          active: lowStock,
          onClick: () => setLowStock(!lowStock),
        },
        {
          key: 'hasStock',
          label: '有库存',
          icon: <Package className="mr-1 h-4 w-4" />,
          active: hasStock,
          onClick: () => setHasStock(!hasStock),
        },
      ]}

      // 筛选器
      filters={[
        {
          key: 'category',
          label: '分类',
          options: categories.map(c => ({ label: c.name, value: c.id })),
          width: 'w-32',
        },
        {
          key: 'sortBy',
          label: '排序',
          options: [
            { label: '更新时间', value: 'updatedAt' },
            { label: '库存数量', value: 'quantity' },
          ],
          width: 'w-28',
        },
      ]}
      filterValues={filters}
      onFilterChange={(key, value) => setFilters(prev => ({ ...prev, [key]: value }))}
    />
  );
}
```

---

## API 参考

### Props

#### 搜索相关

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `searchValue` | `string` | 否 | `''` | 搜索值 |
| `onSearchChange` | `(value: string) => void` | 是 | - | 搜索值变更回调 |
| `searchPlaceholder` | `string` | 否 | `'搜索...'` | 搜索框占位符 |
| `debounceDelay` | `number` | 否 | `400` | 防抖延迟(毫秒) |
| `showClearButton` | `boolean` | 否 | `true` | 是否显示清空按钮 |

#### 筛选器

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `filters` | `FilterConfig[]` | 否 | `[]` | 筛选器配置数组 |
| `filterValues` | `Record<string, string \| undefined>` | 否 | `{}` | 筛选器当前值 |
| `onFilterChange` | `(key: string, value: string \| undefined) => void` | 否 | - | 筛选器变更回调 |

#### 切换按钮

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `toggleButtons` | `ToggleButton[]` | 否 | `[]` | 切换按钮配置数组 |

#### 操作按钮

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `actionButtons` | `ActionButton[]` | 否 | `[]` | 操作按钮配置数组 |

#### 样式

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `className` | `string` | 否 | - | 自定义CSS类名 |
| `compact` | `boolean` | 否 | `false` | 紧凑模式,适配移动端 |

### 类型定义

```typescript
interface FilterConfig {
  key: string;           // 筛选器唯一标识
  label: string;         // 筛选器标签
  options: FilterOption[]; // 选项列表
  placeholder?: string;  // 占位符(可选)
  width?: string;        // 宽度(Tailwind类名)
}

interface FilterOption {
  label: string;  // 显示文本
  value: string;  // 值
}

interface ActionButton {
  label: string;                                                // 按钮文本
  icon?: React.ReactNode;                                       // 图标(可选)
  onClick: () => void;                                          // 点击回调
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';   // 样式变体
  className?: string;                                           // 自定义类名
}

interface ToggleButton {
  key: string;            // 唯一标识
  label: string;          // 按钮文本
  icon?: React.ReactNode; // 图标(可选)
  active: boolean;        // 是否激活
  onClick: () => void;    // 点击回调
}
```

---

## 迁移现有组件

### 从 InventorySearchToolbar 迁移

**之前:**
```tsx
<InventorySearchToolbar
  queryParams={queryParams}
  categoryOptions={categories}
  onSearch={handleSearch}
  onFilter={handleFilter}
  onInbound={() => {}}
  onOutbound={() => {}}
  onAdjust={() => {}}
/>
```

**之后:**
```tsx
<UnifiedSearchBar
  searchValue={queryParams.search}
  onSearchChange={value => handleFilter('search', value)}
  searchPlaceholder="搜索产品名称、编码..."

  actionButtons={[
    { label: '入库', icon: <Plus className="mr-1 h-4 w-4" />, onClick: onInbound },
    { label: '出库', icon: <Package className="mr-1 h-4 w-4" />, onClick: onOutbound, variant: 'outline' },
    { label: '调整', icon: <Edit className="mr-1 h-4 w-4" />, onClick: onAdjust, variant: 'outline' },
  ]}

  toggleButtons={[
    {
      key: 'lowStock',
      label: '库存偏低',
      icon: <AlertTriangle className="mr-1 h-4 w-4" />,
      active: !!queryParams.lowStock,
      onClick: () => handleFilter('lowStock', !queryParams.lowStock)
    },
    {
      key: 'hasStock',
      label: '有库存',
      icon: <Package className="mr-1 h-4 w-4" />,
      active: !!queryParams.hasStock,
      onClick: () => handleFilter('hasStock', !queryParams.hasStock)
    },
  ]}

  filters={[
    {
      key: 'categoryId',
      label: '分类',
      options: categories.map(c => ({ label: c.name, value: c.id })),
      width: 'w-32',
    },
    {
      key: 'sortBy',
      label: '排序',
      options: [
        { label: '更新时间', value: 'updatedAt' },
        { label: '库存数量', value: 'quantity' },
      ],
      width: 'w-28',
    },
  ]}
  filterValues={{
    categoryId: queryParams.categoryId,
    sortBy: queryParams.sortBy,
  }}
  onFilterChange={handleFilter}
/>
```

### 从 ProductSearchFilters 迁移

**之前:**
```tsx
<ProductSearchFilters
  searchValue={search}
  statusFilter={status}
  categoryFilter={category}
  categories={categories}
  onSearchChange={setSearch}
  onStatusChange={setStatus}
  onCategoryChange={setCategory}
  onClearFilters={clearFilters}
/>
```

**之后:**
```tsx
<UnifiedSearchBar
  searchValue={search}
  onSearchChange={setSearch}
  searchPlaceholder="搜索产品编码、名称或规格..."

  filters={[
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '启用', value: 'active' },
        { label: '禁用', value: 'inactive' },
      ],
    },
    {
      key: 'category',
      label: '分类',
      options: categories.map(c => ({ label: c.name, value: c.id })),
    },
  ]}
  filterValues={{ status, category }}
  onFilterChange={(key, value) => {
    if (key === 'status') setStatus(value as ProductStatus | undefined);
    if (key === 'category') setCategory(value);
  }}
/>
```

---

## 最佳实践

### 1. 使用防抖优化性能

默认防抖延迟为 400ms,对于大多数场景已足够。如果需要更快的响应:

```tsx
<UnifiedSearchBar
  debounceDelay={200}  // 更快的响应
  {...otherProps}
/>
```

### 2. 紧凑模式用于移动端

```tsx
<UnifiedSearchBar
  compact={true}  // 更小的尺寸,适配移动端
  {...otherProps}
/>
```

### 3. 组合使用操作按钮和切换按钮

```tsx
<UnifiedSearchBar
  // 左侧:操作按钮
  actionButtons={[
    { label: '新增', icon: <Plus />, onClick: onCreate },
  ]}

  // 右侧:切换按钮
  toggleButtons={[
    { key: 'active', label: '仅显示启用', active: showActive, onClick: toggleActive },
  ]}

  {...otherProps}
/>
```

### 4. 自定义筛选器宽度

```tsx
filters={[
  { key: 'status', label: '状态', options: [...], width: 'w-24' },  // 较窄
  { key: 'category', label: '分类', options: [...], width: 'w-48' }, // 较宽
]}
```

---

## 性能优化

1. **防抖搜索**: 自动防抖,减少不必要的 API 请求
2. **React.memo**: 组件使用 `React.memo` 包裹,避免不必要的重渲染
3. **useCallback**: 所有回调函数使用 `useCallback` 优化
4. **最小化状态**: 只保存必要的状态,其他通过计算得出

---

## 故障排查

### 问题: 搜索不生效

**原因**: 没有正确处理 `onSearchChange` 回调

**解决**:
```tsx
const [search, setSearch] = useState('');

<UnifiedSearchBar
  searchValue={search}
  onSearchChange={setSearch}  // 确保正确更新状态
/>
```

### 问题: 筛选器值不更新

**原因**: `filterValues` 没有正确传递

**解决**:
```tsx
const [filters, setFilters] = useState({ status: undefined });

<UnifiedSearchBar
  filterValues={filters}  // 确保传递当前值
  onFilterChange={(key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }}
/>
```

---

## 路线图

- [ ] 支持日期范围筛选器
- [ ] 支持多选筛选器
- [ ] 支持更多筛选器类型 (数字范围、标签等)
- [ ] 导出/保存筛选器配置
- [ ] 快捷筛选器预设

---

**创建时间**: 2025-10-05
**维护者**: Claude Code + Opus 4.1
