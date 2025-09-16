# UI组件库使用指南

## 概述

本文档介绍了库存管理系统中的UI组件库，包括基于shadcn/ui的基础组件和针对瓷砖行业定制的特色组件。所有组件都支持移动端响应式设计，严格遵循项目的技术规范和设计约定。

## 技术栈

- **基础框架**: Next.js 15.4 App Router
- **UI组件库**: shadcn/ui 2025.1.2
- **样式系统**: Tailwind CSS v4.1.12
- **类型检查**: TypeScript 5.2
- **状态管理**: TanStack Query v5.79.0

## 组件分类

### 1. 瓷砖行业特色组件

#### 1.1 色号显示器 (ColorCodeDisplay)

**用途**: 展示瓷砖色号，支持颜色可视化和交互选择

**基本用法**:

```tsx
import { ColorCodeDisplay } from '@/components/ui/color-code-display'

// 基础展示
<ColorCodeDisplay colorCode="W001" />

// 交互式色号选择
<ColorCodeDisplay
  colorCode="W001"
  interactive
  onColorCodeClick={(code) => console.log(code)}
/>
```

**主要特性**:

- 支持常见瓷砖色号的颜色映射
- 可交互的色号选择
- 响应式设计，移动端友好
- 支持自定义标签和样式变体

**组件变体**:

- `ColorCodeSelector`: 下拉式色号选择器
- `ColorCodeGrid`: 网格式色号展示

#### 1.2 规格展示器 (SpecificationDisplay)

**用途**: 展示瓷砖的详细规格信息，包括尺寸、厚度、表面处理等

**基本用法**:

```tsx
import { SpecificationDisplay } from '@/components/ui/specification-display'

const specification = {
  length: 600,
  width: 600,
  thickness: 10,
  surface: 'polished',
  grade: 'AAA',
  waterAbsorption: 0.5
}

<SpecificationDisplay specification={specification} showAll />
```

**主要特性**:

- 完整的瓷砖规格数据结构
- 紧凑模式和详细模式切换
- 规格比较功能
- 移动端优化的展示方式

**组件变体**:

- `SpecificationCard`: 卡片式规格展示
- `SpecificationCompare`: 规格对比表格

#### 1.3 生产日期选择器 (ProductionDatePicker)

**用途**: 专门用于瓷砖生产日期的选择，支持批次管理

**基本用法**:

```tsx
import { ProductionDatePicker } from '@/components/ui/production-date-picker';

<ProductionDatePicker
  value={productionDate}
  onValueChange={setProductionDate}
  format="YYYY-MM-DD"
  showBatchInfo
  batches={productionBatches}
/>;
```

**主要特性**:

- 多种日期格式支持
- 生产批次信息展示
- 日期范围限制
- 移动端优化的日历界面

**组件变体**:

- `ProductionDateRangePicker`: 日期范围选择器

#### 1.4 库存状态指示器 (InventoryStatusIndicator)

**用途**: 显示库存状态、预警级别和库存健康度

**基本用法**:

```tsx
import { InventoryStatusIndicator } from '@/components/ui/inventory-status-indicator';

<InventoryStatusIndicator
  status="low_stock"
  currentStock={50}
  safetyStock={100}
  maxStock={1000}
  showProgress
/>;
```

**主要特性**:

- 多种库存状态支持
- 库存进度条展示
- 自动预警级别计算
- 库存健康度统计

**组件变体**:

- `InventoryHealth`: 库存健康度总览
- `QuickStatusToggle`: 快速状态切换器

### 2. 移动端优化组件

#### 2.1 移动端数据表格 (MobileDataTable)

**用途**: 响应式数据表格，桌面端显示表格，移动端显示卡片

**基本用法**:

```tsx
import { MobileDataTable } from '@/components/ui/mobile-data-table'

const columns = [
  { key: 'name', title: '产品名称', mobilePrimary: true },
  { key: 'code', title: '产品编码', mobileLabel: '编码' },
  { key: 'stock', title: '库存', align: 'right' }
]

<MobileDataTable
  data={products}
  columns={columns}
  onRowClick={(record) => navigate(`/products/${record.id}`)}
  actions={[
    {
      key: 'edit',
      label: '编辑',
      icon: Edit,
      onClick: (record) => handleEdit(record)
    }
  ]}
/>
```

**主要特性**:

- 自动响应式布局切换
- 灵活的列配置
- 移动端优化的卡片展示
- 内置操作按钮支持

#### 2.2 移动端搜索栏 (MobileSearchBar)

**用途**: 移动端优化的搜索和筛选组件

**基本用法**:

```tsx
import { MobileSearchBar } from '@/components/ui/mobile-search-bar'

const filterOptions = [
  {
    key: 'status',
    label: '状态',
    type: 'select',
    options: [
      { value: 'active', label: '启用' },
      { value: 'inactive', label: '禁用' }
    ]
  }
]

const sortOptions = [
  { key: 'name', label: '名称' },
  { key: 'createdAt', label: '创建时间' }
]

<MobileSearchBar
  value={searchState}
  onChange={setSearchState}
  filterOptions={filterOptions}
  sortOptions={sortOptions}
  onSearch={handleSearch}
/>
```

**主要特性**:

- 实时搜索支持
- 底部抽屉式筛选器
- 多种筛选类型支持
- 活跃筛选器标签展示

## 使用规范

### 1. 导入规范

```tsx
// 正确的导入方式
import { ColorCodeDisplay } from '@/components/ui/color-code-display';
import { SpecificationDisplay } from '@/components/ui/specification-display';

// 避免的导入方式
import ColorCodeDisplay from '@/components/ui/color-code-display'; // ❌
```

### 2. 样式规范

```tsx
// 正确的样式使用
<ColorCodeDisplay
  colorCode="W001"
  className="mb-4" // 使用 Tailwind CSS 类
/>

// 避免的样式使用
<ColorCodeDisplay
  colorCode="W001"
  style={{ marginBottom: '16px' }} // ❌ 避免内联样式
/>
```

### 3. 响应式设计

所有组件都内置了响应式设计，无需额外配置：

```tsx
// 组件会自动适配移动端
<MobileDataTable data={data} columns={columns} />

// 在移动端会自动切换为卡片布局
// 在桌面端会显示为表格布局
```

### 4. 类型安全

所有组件都提供完整的TypeScript类型定义：

```tsx
import { TileSpecification } from '@/components/ui/specification-display';

const spec: TileSpecification = {
  length: 600,
  width: 600,
  thickness: 10,
  surface: 'polished', // 类型安全的枚举值
  grade: 'AAA',
};
```

## 最佳实践

### 1. 组件组合

```tsx
// 推荐的组件组合使用
<Card>
  <CardHeader>
    <CardTitle>产品信息</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      <ColorCodeDisplay colorCode={product.colorCode} />
      <SpecificationDisplay specification={product.specification} />
      <InventoryStatusIndicator
        status={product.inventoryStatus}
        currentStock={product.stock}
        safetyStock={product.safetyStock}
      />
    </div>
  </CardContent>
</Card>
```

### 2. 数据处理

```tsx
// 推荐的数据转换方式
const transformApiData = (apiData: ApiProduct): DisplayProduct => ({
  ...apiData,
  // 遵循 snake_case → camelCase 转换规则
  colorCode: apiData.color_code,
  productionDate: apiData.production_date,
  safetyStock: apiData.safety_stock,
});
```

### 3. 错误处理

```tsx
// 推荐的错误处理方式
<SpecificationDisplay specification={specification || {}} showAll={false} />;

// 或使用条件渲染
{
  specification && (
    <SpecificationDisplay specification={specification} showAll />
  );
}
```

## 性能优化

### 1. 懒加载

```tsx
// 对于大型组件使用懒加载
const MobileDataTable = React.lazy(() =>
  import('@/components/ui/mobile-data-table').then(module => ({
    default: module.MobileDataTable,
  }))
);
```

### 2. 记忆化

```tsx
// 对于复杂计算使用 useMemo
const processedData = React.useMemo(() => {
  return data.map(transformApiData);
}, [data]);
```

## 测试指南

### 1. 组件测试

```tsx
import { render, screen } from '@testing-library/react';
import { ColorCodeDisplay } from '@/components/ui/color-code-display';

test('displays color code correctly', () => {
  render(<ColorCodeDisplay colorCode="W001" />);
  expect(screen.getByText('W001')).toBeInTheDocument();
});
```

### 2. 交互测试

```tsx
import { fireEvent } from '@testing-library/react';

test('handles color code click', () => {
  const handleClick = jest.fn();
  render(
    <ColorCodeDisplay
      colorCode="W001"
      interactive
      onColorCodeClick={handleClick}
    />
  );

  fireEvent.click(screen.getByText('W001'));
  expect(handleClick).toHaveBeenCalledWith('W001');
});
```

## 故障排除

### 常见问题

1. **组件样式不生效**
   - 确保已正确配置 Tailwind CSS
   - 检查 `components.json` 配置是否正确

2. **移动端布局异常**
   - 确保使用了正确的响应式类名
   - 检查视口设置是否正确

3. **类型错误**
   - 确保导入了正确的类型定义
   - 检查数据结构是否符合组件接口

### 调试技巧

```tsx
// 使用开发模式查看组件状态
{
  process.env.NODE_ENV === 'development' && (
    <pre>{JSON.stringify(componentState, null, 2)}</pre>
  );
}
```

## 更新日志

### v1.0.0 (2025-01-16)

- 初始版本发布
- 完成瓷砖行业特色组件
- 完成移动端优化组件
- 完成组件文档和测试用例
