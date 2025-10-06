# 数据表格统一指南

> 项目中所有数据表格的统一规范和最佳实践

**版本**: 1.0.0  
**更新日期**: 2025-10-05  
**适用范围**: 全项目

---

## 📋 目录

1. [核心原则](#核心原则)
2. [快速开始](#快速开始)
3. [API 参考](#api-参考)
4. [使用场景](#使用场景)
5. [最佳实践](#最佳实践)
6. [常见问题](#常见问题)

---

## 🎯 核心原则

### 1. 统一的表格组件

所有数据表格都使用 `DataTable` 组件，确保视觉和交互一致性。

### 2. 声明式的列定义

使用声明式的方式定义表格列，提高代码可读性。

### 3. 统一的操作列

使用下拉菜单统一操作列，避免表格过宽。

### 4. 友好的空状态

提供清晰的空状态提示和操作引导。

---

## 🚀 快速开始

### 安装

数据表格组件已内置，无需安装。

### 基本使用

```typescript
import { DataTable } from '@/components/common/data-table';

function ProductList() {
  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  return (
    <DataTable
      columns={[
        {
          header: '产品名称',
          cell: (row) => row.name,
        },
        {
          header: '价格',
          align: 'right',
          cell: (row) => formatCurrency(row.price),
        },
      ]}
      data={products || []}
      actions={[
        {
          label: '编辑',
          onClick: (row) => router.push(`/products/${row.id}/edit`),
        },
        {
          label: '删除',
          onClick: (row) => handleDelete(row.id),
          destructive: true,
          separator: true,
        },
      ]}
      getRowKey={(row) => row.id}
      isLoading={isLoading}
      emptyTitle="暂无产品"
      emptyDescription="点击上方按钮创建第一个产品"
    />
  );
}
```

---

## 📚 API 参考

### `DataTable` 组件

**属性**:

```typescript
interface DataTableProps<TData> {
  columns: DataTableColumn<TData>[];
  data: TData[];
  actions?: DataTableAction<TData>[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  getRowKey: (row: TData) => string;
}
```

---

### `DataTableColumn` 列定义

```typescript
interface DataTableColumn<TData> {
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  cell: (row: TData) => React.ReactNode;
}
```

**示例**:

```typescript
{
  header: '产品名称',
  width: '200px',
  align: 'left',
  cell: (row) => row.name,
}
```

---

### `DataTableAction` 操作定义

```typescript
interface DataTableAction<TData> {
  label: string;
  icon?: React.ReactNode;
  onClick: (row: TData) => void;
  destructive?: boolean;
  separator?: boolean;
}
```

**示例**:

```typescript
{
  label: '删除',
  icon: <Trash className="h-4 w-4" />,
  onClick: (row) => handleDelete(row.id),
  destructive: true,
  separator: true,
}
```

---

## 💡 使用场景

### 场景 1: 基本表格

```typescript
<DataTable
  columns={[
    {
      header: '产品名称',
      cell: (row) => row.name,
    },
    {
      header: '价格',
      align: 'right',
      cell: (row) => formatCurrency(row.price),
    },
  ]}
  data={products}
  getRowKey={(row) => row.id}
/>
```

---

### 场景 2: 带操作列的表格

```typescript
<DataTable
  columns={[
    {
      header: '产品名称',
      cell: (row) => row.name,
    },
  ]}
  data={products}
  actions={[
    {
      label: '查看',
      onClick: (row) => router.push(`/products/${row.id}`),
    },
    {
      label: '编辑',
      onClick: (row) => router.push(`/products/${row.id}/edit`),
    },
    {
      label: '删除',
      onClick: (row) => handleDelete(row.id),
      destructive: true,
      separator: true,
    },
  ]}
  getRowKey={(row) => row.id}
/>
```

---

### 场景 3: 带加载状态的表格

```typescript
const { data, isLoading } = useQuery({
  queryKey: ['products'],
  queryFn: fetchProducts,
});

<DataTable
  columns={columns}
  data={data || []}
  isLoading={isLoading}
  getRowKey={(row) => row.id}
/>
```

---

### 场景 4: 带空状态的表格

```typescript
<DataTable
  columns={columns}
  data={products}
  getRowKey={(row) => row.id}
  emptyTitle="暂无产品"
  emptyDescription="点击上方按钮创建第一个产品"
  emptyAction={
    <Button onClick={() => router.push('/products/new')}>
      创建产品
    </Button>
  }
/>
```

---

### 场景 5: 自定义列渲染

```typescript
<DataTable
  columns={[
    {
      header: '产品名称',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Image src={row.image} alt={row.name} className="h-8 w-8" />
          <span>{row.name}</span>
        </div>
      ),
    },
    {
      header: '状态',
      cell: (row) => (
        <Badge variant={row.status === 'active' ? 'default' : 'secondary'}>
          {row.status === 'active' ? '启用' : '禁用'}
        </Badge>
      ),
    },
  ]}
  data={products}
  getRowKey={(row) => row.id}
/>
```

---

## ✅ 最佳实践

### 1. 使用类型安全的列定义

```typescript
interface Product {
  id: string;
  name: string;
  price: number;
}

const columns: DataTableColumn<Product>[] = [
  {
    header: '产品名称',
    cell: row => row.name, // TypeScript 会检查 row 的类型
  },
];
```

---

### 2. 提取列定义到常量

```typescript
const productColumns: DataTableColumn<Product>[] = [
  {
    header: '产品名称',
    cell: (row) => row.name,
  },
  {
    header: '价格',
    align: 'right',
    cell: (row) => formatCurrency(row.price),
  },
];

// 在组件中使用
<DataTable columns={productColumns} ... />
```

---

### 3. 使用 Hook 管理操作

```typescript
function useProductActions() {
  const router = useRouter();
  const { confirm } = useConfirmDialog();

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: '删除产品',
      description: '确定要删除这个产品吗？',
      variant: 'destructive',
    });

    if (confirmed) {
      await deleteProduct(id);
    }
  };

  return {
    actions: [
      {
        label: '编辑',
        onClick: (row: Product) => router.push(`/products/${row.id}/edit`),
      },
      {
        label: '删除',
        onClick: (row: Product) => handleDelete(row.id),
        destructive: true,
        separator: true,
      },
    ],
  };
}

// 在组件中使用
const { actions } = useProductActions();
<DataTable actions={actions} ... />
```

---

### 4. 提供有意义的空状态

❌ **不好**:

```typescript
emptyTitle = '暂无数据';
```

✅ **好**:

```typescript
emptyTitle="暂无产品"
emptyDescription="点击上方按钮创建第一个产品"
emptyAction={<Button>创建产品</Button>}
```

---

### 5. 使用合适的列宽

```typescript
{
  header: '产品名称',
  width: '300px', // 固定宽度
  cell: (row) => row.name,
}
```

---

## ❓ 常见问题

### Q1: 如何自定义表格样式?

**A**: 使用 Tailwind CSS 类名

```typescript
<div className="rounded-lg border-2">
  <DataTable ... />
</div>
```

---

### Q2: 如何添加排序功能?

**A**: 在列定义中添加排序逻辑

```typescript
const [sortBy, setSortBy] = useState('name');

{
  header: (
    <button onClick={() => setSortBy('name')}>
      产品名称 {sortBy === 'name' && '↓'}
    </button>
  ),
  cell: (row) => row.name,
}
```

---

### Q3: 如何添加选择功能?

**A**: 添加复选框列

```typescript
{
  header: (
    <Checkbox
      checked={selectedAll}
      onCheckedChange={handleSelectAll}
    />
  ),
  cell: (row) => (
    <Checkbox
      checked={selectedIds.includes(row.id)}
      onCheckedChange={(checked) => handleSelect(row.id, checked)}
    />
  ),
}
```

---

### Q4: 如何处理大量数据?

**A**: 使用分页或虚拟滚动

```typescript
// 分页
const paginatedData = data.slice(
  (page - 1) * pageSize,
  page * pageSize
);

<DataTable data={paginatedData} ... />
<Pagination ... />
```

---

## 📊 表格对比

| 特性     | 旧方式     | 新方式 (DataTable) |
| -------- | ---------- | ------------------ |
| 代码行数 | 100+ 行    | 30-50 行           |
| 空状态   | 手动实现   | 自动处理           |
| 加载状态 | 手动实现   | 自动处理           |
| 操作列   | 分散在各处 | 统一下拉菜单       |
| 类型安全 | 部分       | 完全               |

---

## 🔗 相关文档

- ✅ 对话框使用指南: `docs/DIALOG_GUIDE.md`
- ✅ 表单处理指南: `docs/FORM_HANDLING_GUIDE.md`
- ✅ 错误处理指南: `docs/ERROR_HANDLING_GUIDE.md`
- ✅ Toast 使用指南: `docs/TOAST_NOTIFICATION_GUIDE.md`

---

**维护者**: 开发团队  
**最后更新**: 2025-10-05
