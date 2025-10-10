# ERP 配色方案实施指南

## 1. 快速开始

### 1.1 更新 globals.css
将以下 CSS 变量添加到您的 `app/globals.css` 文件中：

```css
@layer base {
  :root {
    /* === 品牌主色系 === */
    --background: 210 20% 98%;        /* #f8fafc */
    --foreground: 222.2 84% 4.9%;     /* #0f172a */
    
    /* 卡片和容器 */
    --card: 0 0% 100%;                /* #ffffff */
    --card-foreground: 222.2 84% 4.9%; /* #0f172a */
    
    /* 弹出层 */
    --popover: 0 0% 100%;             /* #ffffff */
    --popover-foreground: 222.2 84% 4.9%; /* #0f172a */
    
    /* === 主色调 === */
    --primary: 214 84% 20%;           /* #1e3a8a - 深蓝商务色 */
    --primary-foreground: 210 40% 98%; /* #f8fafc */
    
    /* 辅助色 */
    --secondary: 215 25% 27%;         /* #374151 - 中性灰 */
    --secondary-foreground: 210 40% 98%; /* #f8fafc */
    
    /* 静音区域 */
    --muted: 210 40% 96%;             /* #f1f5f9 */
    --muted-foreground: 215.4 16.3% 46.9%; /* #64748b */
    
    /* 强调色 */
    --accent: 217 91% 60%;            /* #3b82f6 - 科技蓝 */
    --accent-foreground: 210 40% 98%; /* #f8fafc */
    
    /* === 功能色彩 === */
    /* 成功色 */
    --success: 142 76% 36%;           /* #16a34a */
    --success-foreground: 210 40% 98%; /* #f8fafc */
    --success-light: 142 76% 94%;     /* #dcfce7 */
    
    /* 警告色 */
    --warning: 32 95% 44%;            /* #ea580c */
    --warning-foreground: 210 40% 98%; /* #f8fafc */
    --warning-light: 32 95% 92%;      /* #fed7aa */
    
    /* 错误色 */
    --destructive: 0 84% 60%;         /* #ef4444 */
    --destructive-foreground: 210 40% 98%; /* #f8fafc */
    --destructive-light: 0 84% 94%;   /* #fecaca */
    
    /* 信息色 */
    --info: 199 89% 48%;              /* #0ea5e9 */
    --info-foreground: 210 40% 98%;   /* #f8fafc */
    --info-light: 199 89% 94%;        /* #e0f2fe */
    
    /* === 边框和输入 === */
    --border: 214.3 31.8% 91.4%;     /* #e2e8f0 */
    --input: 214.3 31.8% 91.4%;      /* #e2e8f0 */
    --ring: 214 84% 20%;              /* #1e3a8a */
    
    /* === 圆角 === */
    --radius: 0.5rem;
    
    /* === 图表色彩 === */
    --chart-1: 214 84% 20%;   /* 主蓝 */
    --chart-2: 142 76% 36%;   /* 绿色 */
    --chart-3: 32 95% 44%;    /* 橙色 */
    --chart-4: 271 81% 56%;   /* 紫色 */
    --chart-5: 199 89% 48%;   /* 天蓝 */
    --chart-6: 346 87% 43%;   /* 玫红 */
  }

  .dark {
    /* === 深色模式 === */
    --background: 222.2 84% 4.9%;     /* #0f172a */
    --foreground: 210 40% 98%;        /* #f8fafc */
    
    /* 卡片和容器 */
    --card: 217.2 32.6% 17.5%;        /* #1e293b */
    --card-foreground: 210 40% 98%;   /* #f8fafc */
    
    /* 弹出层 */
    --popover: 217.2 32.6% 17.5%;     /* #1e293b */
    --popover-foreground: 210 40% 98%; /* #f8fafc */
    
    /* 主色调 */
    --primary: 217 91% 60%;           /* #3b82f6 - 亮蓝色 */
    --primary-foreground: 222.2 47.4% 11.2%; /* #1e293b */
    
    /* 辅助色 */
    --secondary: 217.2 32.6% 17.5%;   /* #1e293b */
    --secondary-foreground: 210 40% 98%; /* #f8fafc */
    
    /* 静音区域 */
    --muted: 217.2 32.6% 17.5%;       /* #1e293b */
    --muted-foreground: 215 20.2% 65.1%; /* #94a3b8 */
    
    /* 强调色 */
    --accent: 217.2 32.6% 17.5%;      /* #1e293b */
    --accent-foreground: 210 40% 98%; /* #f8fafc */
    
    /* 边框和输入 */
    --border: 217.2 32.6% 17.5%;      /* #1e293b */
    --input: 217.2 32.6% 17.5%;       /* #1e293b */
    --ring: 217 91% 60%;              /* #3b82f6 */
  }
}

/* === 自定义工具类 === */
@layer utilities {
  /* 文字颜色 */
  .text-success { color: hsl(var(--success)); }
  .text-warning { color: hsl(var(--warning)); }
  .text-info { color: hsl(var(--info)); }
  
  /* 背景颜色 */
  .bg-success-light { background-color: hsl(var(--success-light)); }
  .bg-warning-light { background-color: hsl(var(--warning-light)); }
  .bg-destructive-light { background-color: hsl(var(--destructive-light)); }
  .bg-info-light { background-color: hsl(var(--info-light)); }
  
  /* 数据状态 */
  .data-positive { color: hsl(var(--success)); font-weight: 600; }
  .data-negative { color: hsl(var(--destructive)); font-weight: 600; }
  .data-neutral { color: hsl(var(--muted-foreground)); }
  .data-highlight { 
    background-color: hsl(var(--warning-light)); 
    color: hsl(var(--warning)); 
    font-weight: 600; 
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
  }
  
  /* 表格样式 */
  .table-header {
    background-color: hsl(var(--muted));
    color: hsl(var(--foreground));
    font-weight: 600;
  }
  
  .table-row-even { background-color: hsl(var(--background)); }
  .table-row-odd { background-color: hsl(210 40% 99%); }
  
  .table-row:hover { background-color: hsl(var(--accent) / 0.1); }
  
  .table-row-selected {
    background-color: hsl(var(--primary) / 0.1);
    border-left: 3px solid hsl(var(--primary));
  }
  
  /* 卡片变体 */
  .card-elevated {
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  }
  
  .card-accent {
    border: 2px solid hsl(var(--primary));
  }
  
  /* 阴影系统 */
  .shadow-subtle { box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }
  .shadow-small { box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1); }
  .shadow-medium { box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); }
  .shadow-large { box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1); }
}
```

## 2. 组件使用示例

### 2.1 状态徽章组件
```tsx
// components/ui/status-badge.tsx
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: 'success' | 'warning' | 'error' | 'info' | 'pending'
  children: React.ReactNode
  className?: string
}

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  const variants = {
    success: "bg-success-light text-success border-success/20",
    warning: "bg-warning-light text-warning border-warning/20", 
    error: "bg-destructive-light text-destructive border-destructive/20",
    info: "bg-info-light text-info border-info/20",
    pending: "bg-muted text-muted-foreground border-border"
  }
  
  return (
    <Badge 
      className={cn(variants[status], "border", className)}
      variant="outline"
    >
      {children}
    </Badge>
  )
}

// 使用示例
<StatusBadge status="success">已完成</StatusBadge>
<StatusBadge status="warning">待审核</StatusBadge>
<StatusBadge status="error">已取消</StatusBadge>
<StatusBadge status="info">处理中</StatusBadge>
<StatusBadge status="pending">待处理</StatusBadge>
```

### 2.2 数据指标卡片
```tsx
// components/ui/metric-card.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  title: string
  value: string | number
  change?: {
    value: string
    type: 'positive' | 'negative' | 'neutral'
  }
  icon?: React.ReactNode
  className?: string
}

export function MetricCard({ title, value, change, icon, className }: MetricCardProps) {
  const changeClasses = {
    positive: "data-positive",
    negative: "data-negative", 
    neutral: "data-neutral"
  }
  
  return (
    <Card className={cn("card-elevated", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {change && (
          <p className={cn("text-xs", changeClasses[change.type])}>
            {change.value}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// 使用示例
<MetricCard
  title="总销售额"
  value="¥1,234,567"
  change={{ value: "+12.5% 较上月", type: "positive" }}
  icon={<DollarSign className="h-4 w-4" />}
/>
```

### 2.3 增强数据表格
```tsx
// components/ui/data-table.tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

interface DataTableProps<T> {
  data: T[]
  columns: {
    key: keyof T
    header: string
    cell?: (value: any, row: T) => React.ReactNode
    className?: string
  }[]
  onRowClick?: (row: T) => void
  selectedRows?: Set<string | number>
  className?: string
}

export function DataTable<T extends { id: string | number }>({ 
  data, 
  columns, 
  onRowClick,
  selectedRows,
  className 
}: DataTableProps<T>) {
  return (
    <div className={cn("rounded-md border", className)}>
      <Table>
        <TableHeader>
          <TableRow className="table-header">
            {columns.map((column) => (
              <TableHead key={String(column.key)} className={column.className}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => (
            <TableRow
              key={row.id}
              className={cn(
                "table-row cursor-pointer",
                index % 2 === 0 ? "table-row-even" : "table-row-odd",
                selectedRows?.has(row.id) && "table-row-selected"
              )}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column) => (
                <TableCell key={String(column.key)} className={column.className}>
                  {column.cell 
                    ? column.cell(row[column.key], row)
                    : String(row[column.key])
                  }
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// 使用示例
const orderColumns = [
  { key: 'orderNumber', header: '订单号' },
  { 
    key: 'status', 
    header: '状态',
    cell: (value: string) => <StatusBadge status={getStatusType(value)}>{value}</StatusBadge>
  },
  { 
    key: 'amount', 
    header: '金额',
    cell: (value: number) => (
      <span className="font-medium">¥{value.toLocaleString()}</span>
    ),
    className: "text-right"
  },
  {
    key: 'change',
    header: '变化',
    cell: (value: number) => (
      <span className={value > 0 ? 'data-positive' : value < 0 ? 'data-negative' : 'data-neutral'}>
        {value > 0 ? '+' : ''}{value}%
      </span>
    ),
    className: "text-right"
  }
]

<DataTable
  data={orders}
  columns={orderColumns}
  onRowClick={(row) => console.log('点击行:', row)}
  selectedRows={selectedOrderIds}
/>
```

### 2.4 图表容器组件
```tsx
// components/ui/chart-container.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface ChartContainerProps {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  actions?: React.ReactNode
}

export function ChartContainer({ 
  title, 
  description, 
  children, 
  className,
  actions 
}: ChartContainerProps) {
  return (
    <Card className={cn("card-elevated", className)}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center space-x-2">{actions}</div>}
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  )
}

// 使用示例
<ChartContainer
  title="销售趋势"
  description="过去12个月的销售数据"
  actions={
    <Button variant="outline" size="sm">
      导出数据
    </Button>
  }
>
  {/* 图表组件 */}
  <ResponsiveContainer width="100%" height={300}>
    <LineChart data={salesData}>
      <Line 
        type="monotone" 
        dataKey="sales" 
        stroke="hsl(var(--primary))" 
        strokeWidth={2}
      />
    </LineChart>
  </ResponsiveContainer>
</ChartContainer>
```

## 3. 页面布局示例

### 3.1 仪表板布局
```tsx
// app/(dashboard)/dashboard/page.tsx
import { MetricCard } from "@/components/ui/metric-card"
import { ChartContainer } from "@/components/ui/chart-container"
import { DataTable } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"

export default function DashboardPage() {
  return (
    <div className="space-y-6 p-6">
      {/* 页面标题 */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">仪表板</h1>
        <p className="text-muted-foreground">
          查看您的业务概况和关键指标
        </p>
      </div>
      
      {/* 指标卡片网格 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="总销售额"
          value="¥1,234,567"
          change={{ value: "+12.5%", type: "positive" }}
        />
        <MetricCard
          title="订单数量"
          value="1,234"
          change={{ value: "+5.2%", type: "positive" }}
        />
        <MetricCard
          title="客户数量"
          value="567"
          change={{ value: "-2.1%", type: "negative" }}
        />
        <MetricCard
          title="库存周转率"
          value="2.4"
          change={{ value: "0%", type: "neutral" }}
        />
      </div>
      
      {/* 图表区域 */}
      <div className="grid gap-6 md:grid-cols-2">
        <ChartContainer title="销售趋势" description="过去12个月">
          {/* 图表组件 */}
        </ChartContainer>
        
        <ChartContainer title="产品分布" description="按类别统计">
          {/* 图表组件 */}
        </ChartContainer>
      </div>
      
      {/* 数据表格 */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">最近订单</h2>
        <DataTable
          data={recentOrders}
          columns={orderColumns}
          onRowClick={(order) => router.push(`/orders/${order.id}`)}
        />
      </div>
    </div>
  )
}
```

### 3.2 列表页面布局
```tsx
// app/(dashboard)/orders/page.tsx
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DataTable } from "@/components/ui/data-table"
import { StatusBadge } from "@/components/ui/status-badge"

export default function OrdersPage() {
  return (
    <div className="space-y-6 p-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">订单管理</h1>
          <p className="text-muted-foreground">管理所有销售订单</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          新建订单
        </Button>
      </div>
      
      {/* 搜索和筛选 */}
      <div className="flex items-center space-x-4">
        <Input
          placeholder="搜索订单号、客户名称..."
          className="max-w-sm"
        />
        <Button variant="outline">筛选</Button>
        <Button variant="outline">导出</Button>
      </div>
      
      {/* 数据表格 */}
      <DataTable
        data={orders}
        columns={[
          { key: 'orderNumber', header: '订单号' },
          { key: 'customerName', header: '客户' },
          { 
            key: 'status', 
            header: '状态',
            cell: (value) => <StatusBadge status={getStatusType(value)}>{value}</StatusBadge>
          },
          { 
            key: 'amount', 
            header: '金额',
            cell: (value) => <span className="font-medium">¥{value.toLocaleString()}</span>,
            className: "text-right"
          },
          { key: 'createdAt', header: '创建时间' }
        ]}
        onRowClick={(order) => router.push(`/orders/${order.id}`)}
      />
    </div>
  )
}
```

## 4. 最佳实践

### 4.1 颜色使用原则
1. **主色调**: 仅用于最重要的操作和品牌元素
2. **功能色**: 明确传达状态和意图
3. **中性色**: 用于大部分界面元素
4. **对比度**: 确保文字可读性

### 4.2 组件组合建议
```tsx
// 好的做法：使用语义化的组件组合
<Card className="card-elevated">
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle>销售报告</CardTitle>
      <StatusBadge status="success">已完成</StatusBadge>
    </div>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      <div className="text-2xl font-bold data-positive">¥123,456</div>
      <p className="text-sm text-muted-foreground">较上月增长 12.5%</p>
    </div>
  </CardContent>
</Card>

// 避免：过度使用颜色和样式
<div className="bg-red-500 text-white border-4 border-blue-500 shadow-2xl">
  <!-- 过于花哨，不适合 ERP 系统 -->
</div>
```

### 4.3 响应式设计
```tsx
// 移动端适配示例
<div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
  {metrics.map((metric) => (
    <MetricCard key={metric.id} {...metric} />
  ))}
</div>

// 表格在移动端的处理
<div className="overflow-x-auto">
  <DataTable
    data={data}
    columns={columns}
    className="min-w-[600px] md:min-w-full"
  />
</div>
```

### 4.4 深色模式支持
```tsx
// 自动适配深色模式的组件
<Card className="bg-card border-border">
  <CardContent className="text-card-foreground">
    {/* 内容会自动适配深色模式 */}
  </CardContent>
</Card>

// 条件样式（如果需要）
<div className={cn(
  "p-4 rounded-lg",
  "bg-white dark:bg-gray-900",
  "text-gray-900 dark:text-gray-100"
)}>
  内容
</div>
```

## 5. 性能优化建议

### 5.1 CSS 变量优化
- 使用 CSS 变量而非硬编码颜色值
- 利用 Tailwind 的 JIT 模式减少 CSS 体积
- 避免不必要的颜色变体

### 5.2 组件懒加载
```tsx
// 大型图表组件懒加载
const ChartComponent = lazy(() => import('@/components/charts/sales-chart'))

function Dashboard() {
  return (
    <Suspense fallback={<div className="h-64 bg-muted animate-pulse rounded" />}>
      <ChartComponent data={salesData} />
    </Suspense>
  )
}
```

### 5.3 主题切换优化
```tsx
// 使用 next-themes 实现主题切换
import { useTheme } from 'next-themes'

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? '🌞' : '🌙'}
    </Button>
  )
}
```

---

*此实施指南提供了完整的代码示例和最佳实践，帮助您快速应用 ERP 配色方案到实际项目中。*