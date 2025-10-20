# shadcn/ui 高端 ERP 配色设计规范

## 1. 设计概述

本文档基于 shadcn/ui 组件库，为 ERP 系统设计一套专业、现代的配色方案。设计理念注重商务专业性、数据可读性和用户体验，适用于长时间工作场景。

### 1.1 设计原则

- **专业性优先**: 使用沉稳、可信赖的色彩
- **数据可读性**: 确保表格和图表清晰易读
- **视觉层次**: 明确的信息层级和重要性区分
- **护眼设计**: 适合长时间使用的舒适配色
- **品牌一致性**: 保持整体视觉统一

## 2. 主色调系统

### 2.1 品牌主色 (Primary)

```css
/* 深蓝商务色 - 专业、可信赖 */
--primary: 214 84% 20%;           /* #1e3a8a */
--primary-foreground: 210 40% 98%; /* #f8fafc */

/* 使用场景 */
- 主要按钮和 CTA
- 导航栏和侧边栏
- 重要数据标识
- 品牌元素
```

### 2.2 辅助色系 (Secondary)

```css
/* 中性灰 - 平衡、专业 */
--secondary: 215 25% 27%;         /* #374151 */
--secondary-foreground: 210 40% 98%; /* #f8fafc */

/* 使用场景 */
- 次要按钮
- 工具栏
- 辅助信息
- 背景元素
```

### 2.3 强调色 (Accent)

```css
/* 科技蓝 - 现代、高效 */
--accent: 217 91% 60%;            /* #3b82f6 */
--accent-foreground: 210 40% 98%; /* #f8fafc */

/* 使用场景 */
- 链接和交互元素
- 悬停状态
- 选中状态
- 进度指示器
```

## 3. 功能色彩系统

### 3.1 状态色彩

```css
/* 成功 - 绿色系 */
--success: 142 76% 36%; /* #16a34a */
--success-foreground: 210 40% 98%; /* #f8fafc */
--success-light: 142 76% 94%; /* #dcfce7 */

/* 警告 - 橙色系 */
--warning: 32 95% 44%; /* #ea580c */
--warning-foreground: 210 40% 98%; /* #f8fafc */
--warning-light: 32 95% 92%; /* #fed7aa */

/* 错误 - 红色系 */
--destructive: 0 84% 60%; /* #ef4444 */
--destructive-foreground: 210 40% 98%; /* #f8fafc */
--destructive-light: 0 84% 94%; /* #fecaca */

/* 信息 - 蓝色系 */
--info: 199 89% 48%; /* #0ea5e9 */
--info-foreground: 210 40% 98%; /* #f8fafc */
--info-light: 199 89% 94%; /* #e0f2fe */
```

### 3.2 数据可视化色彩

```css
/* 图表色彩序列 */
--chart-1: 214 84% 20%; /* 主蓝 */
--chart-2: 142 76% 36%; /* 绿色 */
--chart-3: 32 95% 44%; /* 橙色 */
--chart-4: 271 81% 56%; /* 紫色 */
--chart-5: 199 89% 48%; /* 天蓝 */
--chart-6: 346 87% 43%; /* 玫红 */
```

## 4. 背景和表面色彩

### 4.1 浅色模式

```css
/* 主背景 */
--background: 210 20% 98%; /* #f8fafc */

/* 卡片和容器 */
--card: 0 0% 100%; /* #ffffff */
--card-foreground: 222.2 84% 4.9%; /* #0f172a */

/* 弹出层 */
--popover: 0 0% 100%; /* #ffffff */
--popover-foreground: 222.2 84% 4.9%; /* #0f172a */

/* 静音区域 */
--muted: 210 40% 96%; /* #f1f5f9 */
--muted-foreground: 215.4 16.3% 46.9%; /* #64748b */
```

### 4.2 深色模式

```css
/* 主背景 */
--background: 222.2 84% 4.9%; /* #0f172a */

/* 卡片和容器 */
--card: 217.2 32.6% 17.5%; /* #1e293b */
--card-foreground: 210 40% 98%; /* #f8fafc */

/* 弹出层 */
--popover: 217.2 32.6% 17.5%; /* #1e293b */
--popover-foreground: 210 40% 98%; /* #f8fafc */

/* 静音区域 */
--muted: 217.2 32.6% 17.5%; /* #1e293b */
--muted-foreground: 215 20.2% 65.1%; /* #94a3b8 */
```

## 5. 边框和分割线

### 5.1 边框系统

```css
/* 主边框 */
--border: 214.3 31.8% 91.4%; /* #e2e8f0 */

/* 输入框边框 */
--input: 214.3 31.8% 91.4%; /* #e2e8f0 */

/* 焦点环 */
--ring: 214 84% 20%; /* #1e3a8a */

/* 深色模式边框 */
.dark {
  --border: 217.2 32.6% 17.5%; /* #1e293b */
  --input: 217.2 32.6% 17.5%; /* #1e293b */
  --ring: 217 91% 60%; /* #3b82f6 */
}
```

### 5.2 边框样式规范

```css
/* 细边框 - 用于表格和卡片 */
.border-thin {
  border-width: 1px;
}

/* 中等边框 - 用于重要容器 */
.border-medium {
  border-width: 2px;
}

/* 粗边框 - 用于强调元素 */
.border-thick {
  border-width: 3px;
}
```

## 6. 阴影系统

### 6.1 阴影层级

```css
/* 微阴影 - 卡片和按钮 */
.shadow-subtle {
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}

/* 小阴影 - 下拉菜单 */
.shadow-small {
  box-shadow:
    0 1px 3px 0 rgb(0 0 0 / 0.1),
    0 1px 2px -1px rgb(0 0 0 / 0.1);
}

/* 中阴影 - 模态框 */
.shadow-medium {
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.1),
    0 2px 4px -2px rgb(0 0 0 / 0.1);
}

/* 大阴影 - 重要弹窗 */
.shadow-large {
  box-shadow:
    0 10px 15px -3px rgb(0 0 0 / 0.1),
    0 4px 6px -4px rgb(0 0 0 / 0.1);
}
```

## 7. 文字层级系统

### 7.1 字体大小规范

```css
/* 标题层级 */
.text-h1 {
  font-size: 2.25rem;
  line-height: 2.5rem;
} /* 36px */
.text-h2 {
  font-size: 1.875rem;
  line-height: 2.25rem;
} /* 30px */
.text-h3 {
  font-size: 1.5rem;
  line-height: 2rem;
} /* 24px */
.text-h4 {
  font-size: 1.25rem;
  line-height: 1.75rem;
} /* 20px */
.text-h5 {
  font-size: 1.125rem;
  line-height: 1.75rem;
} /* 18px */
.text-h6 {
  font-size: 1rem;
  line-height: 1.5rem;
} /* 16px */

/* 正文层级 */
.text-body-lg {
  font-size: 1.125rem;
  line-height: 1.75rem;
} /* 18px */
.text-body {
  font-size: 1rem;
  line-height: 1.5rem;
} /* 16px */
.text-body-sm {
  font-size: 0.875rem;
  line-height: 1.25rem;
} /* 14px */
.text-caption {
  font-size: 0.75rem;
  line-height: 1rem;
} /* 12px */
```

### 7.2 文字颜色层级

```css
/* 主要文字 */
.text-primary {
  color: hsl(var(--foreground));
}

/* 次要文字 */
.text-secondary {
  color: hsl(var(--muted-foreground));
}

/* 辅助文字 */
.text-muted {
  color: hsl(215.4 16.3% 56.9%);
}

/* 占位文字 */
.text-placeholder {
  color: hsl(215.4 16.3% 46.9%);
}
```

## 8. 数据表格样式

### 8.1 表格配色

```css
/* 表头 */
.table-header {
  background-color: hsl(var(--muted));
  color: hsl(var(--foreground));
  font-weight: 600;
}

/* 表格行 */
.table-row-even {
  background-color: hsl(var(--background));
}

.table-row-odd {
  background-color: hsl(210 40% 99%);
}

/* 悬停状态 */
.table-row:hover {
  background-color: hsl(var(--accent) / 0.1);
}

/* 选中状态 */
.table-row-selected {
  background-color: hsl(var(--primary) / 0.1);
  border-left: 3px solid hsl(var(--primary));
}
```

### 8.2 数据状态指示

```css
/* 数值正增长 */
.data-positive {
  color: hsl(var(--success));
}

/* 数值负增长 */
.data-negative {
  color: hsl(var(--destructive));
}

/* 数值无变化 */
.data-neutral {
  color: hsl(var(--muted-foreground));
}

/* 重要数据高亮 */
.data-highlight {
  background-color: hsl(var(--warning) / 0.1);
  color: hsl(var(--warning-foreground));
  font-weight: 600;
}
```

## 9. 按钮和交互元素

### 9.1 按钮变体

```css
/* 主要按钮 */
.btn-primary {
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border: 1px solid hsl(var(--primary));
}

.btn-primary:hover {
  background-color: hsl(214 84% 16%);
}

/* 次要按钮 */
.btn-secondary {
  background-color: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
  border: 1px solid hsl(var(--secondary));
}

/* 轮廓按钮 */
.btn-outline {
  background-color: transparent;
  color: hsl(var(--primary));
  border: 1px solid hsl(var(--primary));
}

.btn-outline:hover {
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

/* 幽灵按钮 */
.btn-ghost {
  background-color: transparent;
  color: hsl(var(--foreground));
  border: none;
}

.btn-ghost:hover {
  background-color: hsl(var(--accent) / 0.1);
}
```

### 9.2 交互状态

```css
/* 焦点状态 */
.focus-ring {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

/* 禁用状态 */
.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 加载状态 */
.loading {
  opacity: 0.7;
  cursor: wait;
}
```

## 10. 卡片和容器样式

### 10.1 卡片变体

```css
/* 基础卡片 */
.card-base {
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-subtle);
}

/* 悬浮卡片 */
.card-elevated {
  background-color: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-medium);
}

/* 强调卡片 */
.card-accent {
  background-color: hsl(var(--card));
  border: 2px solid hsl(var(--primary));
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-small);
}
```

### 10.2 容器间距

```css
/* 内边距系统 */
.p-xs {
  padding: 0.5rem;
} /* 8px */
.p-sm {
  padding: 0.75rem;
} /* 12px */
.p-md {
  padding: 1rem;
} /* 16px */
.p-lg {
  padding: 1.5rem;
} /* 24px */
.p-xl {
  padding: 2rem;
} /* 32px */

/* 外边距系统 */
.m-xs {
  margin: 0.5rem;
} /* 8px */
.m-sm {
  margin: 0.75rem;
} /* 12px */
.m-md {
  margin: 1rem;
} /* 16px */
.m-lg {
  margin: 1.5rem;
} /* 24px */
.m-xl {
  margin: 2rem;
} /* 32px */
```

## 11. 响应式设计考虑

### 11.1 断点系统

```css
/* 移动端优先 */
@media (min-width: 640px) {
  /* sm */
  /* 小屏幕平板 */
}

@media (min-width: 768px) {
  /* md */
  /* 平板 */
}

@media (min-width: 1024px) {
  /* lg */
  /* 桌面 */
}

@media (min-width: 1280px) {
  /* xl */
  /* 大桌面 */
}

@media (min-width: 1536px) {
  /* 2xl */
  /* 超大桌面 */
}
```

### 11.2 移动端适配

```css
/* 移动端按钮 */
@media (max-width: 768px) {
  .btn-mobile {
    min-height: 44px;
    font-size: 1rem;
    padding: 0.75rem 1rem;
  }
}

/* 移动端表格 */
@media (max-width: 768px) {
  .table-mobile {
    font-size: 0.875rem;
  }

  .table-mobile th,
  .table-mobile td {
    padding: 0.5rem;
  }
}
```

## 12. 实施建议

### 12.1 CSS 变量更新

将以上颜色值更新到 `app/globals.css` 文件中的 `:root` 和 `.dark` 选择器中。

### 12.2 组件库扩展

基于 shadcn/ui 现有组件，创建符合 ERP 需求的扩展组件：

- DataTable 组件
- StatusBadge 组件
- MetricCard 组件
- ChartContainer 组件

### 12.3 使用示例

```tsx
// 状态徽章
<Badge variant="success">已完成</Badge>
<Badge variant="warning">待审核</Badge>
<Badge variant="destructive">已取消</Badge>

// 数据卡片
<Card className="card-elevated">
  <CardHeader>
    <CardTitle className="text-h4">销售总额</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-h2 text-primary">¥1,234,567</div>
    <div className="text-body-sm text-positive">+12.5%</div>
  </CardContent>
</Card>

// 数据表格
<Table className="table-base">
  <TableHeader className="table-header">
    <TableRow>
      <TableHead>订单号</TableHead>
      <TableHead>状态</TableHead>
      <TableHead>金额</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow className="table-row">
      <TableCell>SO-001</TableCell>
      <TableCell>
        <Badge variant="success">已完成</Badge>
      </TableCell>
      <TableCell className="data-positive">¥12,345</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

## 13. 可访问性考虑

### 13.1 对比度要求

- 正文文字与背景对比度 ≥ 4.5:1
- 大文字与背景对比度 ≥ 3:1
- 交互元素与背景对比度 ≥ 3:1

### 13.2 色盲友好

- 不仅依赖颜色传达信息
- 提供图标和文字标识
- 使用纹理和形状区分

### 13.3 键盘导航

- 清晰的焦点指示器
- 逻辑的 Tab 顺序
- 快捷键支持

---

_本设计规范基于 shadcn/ui 组件库，结合 ERP 系统的专业需求制定。建议在实施过程中根据具体业务场景进行微调。_
