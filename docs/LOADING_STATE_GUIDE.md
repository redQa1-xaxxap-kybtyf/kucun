# 加载状态统一指南

> 项目中所有加载状态的统一规范和最佳实践

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

### 1. 统一的加载组件

所有加载状态都使用统一的加载组件，确保视觉一致性。

### 2. 语义化的变体

提供 4 种语义化的变体：

- `page` - 页面级加载
- `content` - 内容区域加载
- `inline` - 行内加载
- `card` - 卡片加载

### 3. 骨架屏优先

对于列表、表格等结构化内容，优先使用骨架屏而不是加载图标。

### 4. 用户友好的反馈

提供清晰的加载状态反馈，避免用户等待焦虑。

---

## 🚀 快速开始

### 安装

加载组件已内置，无需安装。

### 基本使用

#### 方式 1: 使用预定义组件（推荐）

```typescript
import { PageLoading, ContentLoading, InlineLoading } from '@/components/common/loading';

// 页面加载
if (isLoading) {
  return <PageLoading text="加载中..." />;
}

// 内容加载
if (isLoading) {
  return <ContentLoading />;
}

// 行内加载
<Button disabled={isLoading}>
  {isLoading ? <InlineLoading size="sm" /> : '提交'}
</Button>
```

#### 方式 2: 使用通用组件

```typescript
import { Loading } from '@/components/common/loading';

<Loading variant="page" size="lg" text="加载中..." />
```

---

## 📚 API 参考

### `Loading` 组件

**属性**:

```typescript
interface LoadingProps {
  variant?: 'page' | 'content' | 'inline' | 'card';
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}
```

**示例**:

```typescript
<Loading variant="content" size="md" text="加载中..." />
```

---

### 预定义组件

#### `PageLoading`

```typescript
<PageLoading text="加载中..." />
```

#### `ContentLoading`

```typescript
<ContentLoading text="加载数据..." />
```

#### `InlineLoading`

```typescript
<InlineLoading size="sm" text="处理中..." />
```

#### `CardLoading`

```typescript
<CardLoading text="加载卡片..." />
```

---

### 骨架屏组件

#### `CardSkeleton`

```typescript
<CardSkeleton />
```

#### `TableSkeleton`

```typescript
<TableSkeleton rows={5} columns={4} />
```

#### `ListSkeleton`

```typescript
<ListSkeleton items={5} />
```

---

## 💡 使用场景

### 场景 1: 页面加载

```typescript
function ProductPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
  });

  if (isLoading) {
    return <PageLoading text="加载产品信息..." />;
  }

  return <div>{/* 页面内容 */}</div>;
}
```

---

### 场景 2: 内容区域加载

```typescript
function ProductList() {
  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  if (isLoading) {
    return <ContentLoading />;
  }

  return <div>{/* 列表内容 */}</div>;
}
```

---

### 场景 3: 按钮加载

```typescript
function SubmitButton() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <Button disabled={isSubmitting} onClick={handleSubmit}>
      {isSubmitting ? <InlineLoading size="sm" text="提交中..." /> : '提交'}
    </Button>
  );
}
```

---

### 场景 4: 卡片加载

```typescript
function StatsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
  });

  if (isLoading) {
    return <CardSkeleton />;
  }

  return <Card>{/* 卡片内容 */}</Card>;
}
```

---

### 场景 5: 表格加载

```typescript
function ProductTable() {
  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  if (isLoading) {
    return <TableSkeleton rows={5} columns={4} />;
  }

  return <DataTable data={data} columns={columns} />;
}
```

---

### 场景 6: 列表加载

```typescript
function ProductList() {
  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  if (isLoading) {
    return <ListSkeleton items={5} />;
  }

  return (
    <div>
      {data.map(product => (
        <ProductItem key={product.id} product={product} />
      ))}
    </div>
  );
}
```

---

## ✅ 最佳实践

### 1. 选择合适的变体

- `PageLoading` - 整个页面加载（如详情页）
- `ContentLoading` - 内容区域加载（如列表、表格）
- `InlineLoading` - 行内加载（如按钮、表单）
- `CardLoading` - 卡片加载（如统计卡片）

---

### 2. 使用骨架屏而不是加载图标

❌ **不推荐**:

```typescript
if (isLoading) {
  return <ContentLoading />;
}
```

✅ **推荐**:

```typescript
if (isLoading) {
  return <TableSkeleton rows={5} columns={4} />;
}
```

---

### 3. 提供有意义的加载文本

❌ **不好**:

```typescript
<PageLoading text="加载中..." />
```

✅ **好**:

```typescript
<PageLoading text="加载产品信息..." />
```

---

### 4. 在按钮中使用行内加载

```typescript
<Button disabled={isSubmitting}>
  {isSubmitting ? <InlineLoading size="sm" text="提交中..." /> : '提交'}
</Button>
```

---

### 5. 使用 DataTable 的内置加载状态

```typescript
<DataTable
  data={products}
  columns={columns}
  isLoading={isLoading} // DataTable 会自动显示骨架屏
/>
```

---

## ❓ 常见问题

### Q1: 什么时候使用加载图标，什么时候使用骨架屏?

**A**:

- **加载图标**: 页面级加载、按钮加载、简单内容加载
- **骨架屏**: 列表、表格、卡片等结构化内容加载

---

### Q2: 如何自定义加载图标大小?

**A**: 使用 `size` 属性

```typescript
<Loading size="sm" />  // 小
<Loading size="md" />  // 中（默认）
<Loading size="lg" />  // 大
```

---

### Q3: 如何在加载时禁用交互?

**A**: 使用 `disabled` 属性

```typescript
<Button disabled={isLoading}>
  {isLoading ? <InlineLoading size="sm" /> : '提交'}
</Button>
```

---

### Q4: 如何自定义骨架屏样式?

**A**: 使用 Tailwind CSS 类名

```typescript
<Skeleton className="h-10 w-full rounded-lg" />
```

---

### Q5: 如何处理多个加载状态?

**A**: 使用条件渲染

```typescript
if (isLoadingProducts) {
  return <TableSkeleton rows={5} columns={4} />;
}

if (isLoadingStats) {
  return <CardSkeleton />;
}
```

---

## 📊 加载状态对比

| 场景     | 旧方式         | 新方式               |
| -------- | -------------- | -------------------- |
| 页面加载 | 自定义 Loader2 | `<PageLoading />`    |
| 内容加载 | 自定义 Loader2 | `<ContentLoading />` |
| 按钮加载 | 自定义 Loader2 | `<InlineLoading />`  |
| 表格加载 | 无             | `<TableSkeleton />`  |
| 列表加载 | 无             | `<ListSkeleton />`   |

---

## 🎨 加载状态变体

| 变体      | 使用场景     | 示例           |
| --------- | ------------ | -------------- |
| `page`    | 整个页面加载 | 详情页、编辑页 |
| `content` | 内容区域加载 | 列表、表格     |
| `inline`  | 行内加载     | 按钮、表单     |
| `card`    | 卡片加载     | 统计卡片       |

---

## 🔗 相关文档

- ✅ 数据表格使用指南: `docs/DATA_TABLE_GUIDE.md`
- ✅ 对话框使用指南: `docs/DIALOG_GUIDE.md`
- ✅ 表单处理指南: `docs/FORM_HANDLING_GUIDE.md`
- ✅ 错误处理指南: `docs/ERROR_HANDLING_GUIDE.md`
- ✅ Toast 使用指南: `docs/TOAST_NOTIFICATION_GUIDE.md`

---

**维护者**: 开发团队  
**最后更新**: 2025-10-05
