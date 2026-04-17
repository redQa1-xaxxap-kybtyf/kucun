# P0 实施方案 — UI 审计整改

> 配套文档：`docs/ui-audit-2026-04-17.md`
> 目标：在 1 个 sprint（约 5 个工作日）内完成全部 P0 项
> 原则：令牌/工具类改造优先，组件层按"搜索替换 + code review"推进，避免大范围业务改造

---

## 基线统计（影响面）

| 规则 | 命中文件数 | 改造策略 |
|---|---:|---|
| `uppercase` / `tracking-widest` / `tracking-wider` | 69 | 全局 utility 源头修复 + 批量清洗 |
| `rounded-3xl` / `rounded-2xl` / `rounded-[24/32px]` | 90 | 替换为语义圆角 + ESLint 守门 |
| `bg-white/40` / `bg-white/30` / `backdrop-blur` | 45 | 按场景保留或替换为实色卡片 |
| 现有 `tabular-nums` | 8 | 新增 utility 并全面应用金额/数量列 |
| `import … dialog` | 44 | 仅改造 **复杂表单类 Dialog**（约 12 个），简单确认 Dialog 保留 |

---

## P0-1 补充中文字体栈

### 目标
显式声明 font-family，确保在 Windows/Linux 服务器渲染、用户设备无苹方时也有合理回退。

### 改造范围
- `app/globals.css:296-300`（唯一改动点）
- `@layer base` 的 `body` 规则

### 具体方案

```css
/* app/globals.css */
@layer base {
  :root {
    /* 现有令牌保持不变 ... */

    /* 新增：字体栈令牌 */
    --font-sans:
      -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
      "Hiragino Sans GB", "Microsoft YaHei", "Source Han Sans CN",
      "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif;
    --font-mono:
      "SF Mono", Menlo, Consolas, "Roboto Mono", "PingFang SC",
      "Microsoft YaHei", monospace;
    /* 金额/数量等宽 + tabular 数字 */
    --font-number:
      "SF Mono", "Roboto Mono", Menlo, Consolas, "PingFang SC",
      "Microsoft YaHei", ui-monospace, monospace;
  }

  body {
    background-color: hsl(var(--color-bg-primary));
    color: hsl(var(--color-text-primary));
    font-family: var(--font-sans);
    font-feature-settings: 'liga', 'kern';
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}
```

在 `@theme` 块中暴露给 Tailwind：

```css
@theme {
  /* 现有 ... */
  --font-family-sans: var(--font-sans);
  --font-family-mono: var(--font-mono);
  --font-family-number: var(--font-number);
}
```

### 落地步骤
1. 改 `globals.css` 一处
2. 浏览器清缓存刷新首页、登录页、仪表板、库存列表各一次，DevTools Computed 面板确认 `font-family` 已被采用
3. 启用 **开发者工具 → Rendering → Emulate CSS: no font** 验证回退栈

### 验收标准
- `document.body` computed style 的 `font-family` 首项为 `-apple-system`
- Windows Chrome 中文使用"微软雅黑"而非默认"宋体"
- 生产 PM2 集群启动后远程截图核对

### 风险
- 极低；无业务逻辑变化；仅视觉微调

### 工时
- 0.5 小时（含验证）

---

## P0-2 移除对中文无效的排版（uppercase + tracking-widest + font-black）

### 目标
停止使用破坏中文阅读节奏的西式排版技巧；建立"汉字友好"的文字层级工具类。

### 改造范围（分三层）

#### A. 全局源头 — `app/globals.css`

当前：
```css
/* globals.css:463-469 */
.text-table-header {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: hsl(var(--color-text-secondary));
}
```

替换为（新增两个新工具类，保留旧类名别名避免破坏现有调用）：
```css
/* 新：中式表格表头 — 清晰不抢眼 */
.text-table-header {
  font-size: 0.75rem;           /* 12px */
  font-weight: 500;             /* medium，而非 semibold */
  letter-spacing: 0;            /* 汉字不加间距 */
  color: hsl(var(--color-text-secondary));
}

/* 新：页面大标题 */
.text-page-title {
  font-size: 1.125rem;          /* 18px */
  font-weight: 600;
  line-height: 1.5;
  color: hsl(var(--color-text-primary));
}

/* 新：区块小标题 */
.text-section-title {
  font-size: 0.875rem;          /* 14px */
  font-weight: 600;
  color: hsl(var(--color-text-primary));
}

/* 新：辅助文字 */
.text-caption {
  font-size: 0.75rem;
  font-weight: 400;
  color: hsl(var(--color-text-tertiary));
}
```

#### B. 关键组件逐一修复（5 处高曝光点）

| 文件 | 当前 | 改为 |
|---|---|---|
| `components/common/DashboardLayoutClient.tsx:307` | `text-xs font-black tracking-widest text-slate-500 uppercase` | `text-xs font-medium text-muted-foreground` |
| `components/common/DashboardLayoutClient.tsx:304` | `text-xs font-black text-slate-500` | `text-xs font-medium text-muted-foreground` |
| `components/common/Breadcrumb.tsx` | 检查同类写法 | 同上规则 |
| `components/common/Header.tsx` | 检查 | 同上 |
| `components/common/Sidebar.tsx` | 分组标题若为 uppercase | 去掉 |

#### C. 业务层批量清洗（69 文件）

分两步：

1. **规则 1：对所有中文/中英混排文本，删除 `uppercase` 与 `tracking-widest/tracking-wider`**
   - 提供 codemod 脚本（在 `scripts/codemod-remove-uppercase.mjs`）或用 VS Code 正则替换：
   - 正则：`\s?(uppercase|tracking-widest|tracking-wider)` → `` （空字符串）
   - ⚠️ 排除：`.text-table-header`（已在源头修好）、纯英文 Key 的代码展示、`print-designer/*`（打印模板里的用户自定义样式要保留）

2. **规则 2：`font-black` (900) 降到 `font-semibold` (600) 或 `font-medium` (500)**
   - 例外：登录页 Logo / 首页 Hero 保留 `font-bold`
   - 正则：`\bfont-black\b` → `font-semibold`

### 落地步骤
1. 改 `globals.css`（新增 `.text-page-title` 等）
2. 手动改 5 个高曝光组件
3. 跑 codemod 或 VS Code 多文件替换，人工 review 每个 diff
4. `npm run lint && npm run build` 检查
5. 浏览登录/仪表板/库存列表/销售订单/财务各一次，截图对比

### 验收标准
- 面包屑文字正常不带英文伪大写
- 表格表头为 12px / medium / 无字间距
- grep `tracking-widest` 和 `uppercase` 返回 0 业务文件（仅 UI 基础组件 `context-menu/dropdown-menu/command` 保留英文快捷键 uppercase）
- 设计复核：中文字体无拉伸/挤压

### 风险
- 中：替换规则在纯英文场景（如快捷键、Code Sample）可能误伤 → 通过白名单目录 `components/print-designer/` / `components/ui/{context-menu,dropdown-menu,command}.tsx` 排除
- 建议 1 个 PR 只做本项改造，便于 revert

### 工时
- 源头 + 5 高曝光点：1 小时
- 批量清洗 + review：3 小时

### 新增 ESLint 守门（可选，推荐）

`.eslintrc`（或 `eslint.config.mjs`）加入 Tailwind 类名禁用规则：

```js
// 自定义 rule：restricted-tailwind-classes
{
  files: ['**/*.tsx'],
  rules: {
    'no-restricted-syntax': [
      'warn',
      {
        selector: "Literal[value=/\\b(uppercase|tracking-widest|tracking-wider)\\b/]",
        message: '中文项目禁止使用 uppercase/tracking-widest，使用 .text-table-header 或 .text-caption'
      }
    ]
  }
}
```

---

## P0-3 金额 / 数量列强制 `tabular-nums`

### 目标
所有金额、数量、SKU、单号列采用等宽数字，确保小数点和单位右对齐。

### 改造范围

目前仅 8 个文件使用 `tabular-nums`；需覆盖至少以下场景：
- 财务：应收/应付/支付/退款/费用 列表金额列
- 销售订单：订单总额、已收款、未收款、明细单价、数量、折扣
- 库存：库存数量、预警数量、成本、单价
- 产品：售价、成本价、库存数
- 仪表板：所有 KPI 数字、趋势图 y 轴
- 报表：所有数值列

### 具体方案

#### A. 新增 utility（`app/globals.css @layer utilities`）

```css
@layer utilities {
  /* 等宽数字 — 应用于金额/数量/SKU/单号 */
  .num-tabular {
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum';
  }

  /* 金额列：等宽 + 右对齐 + 数字字体 */
  .num-money {
    font-family: var(--font-number);
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum';
    text-align: right;
  }

  /* 数量列 */
  .num-count {
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum';
    text-align: right;
  }

  /* 单号/SKU 等英数混排（不改对齐） */
  .num-code {
    font-family: var(--font-number);
    font-variant-numeric: tabular-nums;
  }
}
```

#### B. 封装标准组件（推荐，避免散落在各列定义里）

新建 `components/ui/money.tsx` 和 `components/ui/number-cell.tsx`：

```tsx
// components/ui/money.tsx
import { cn } from '@/lib/utils';

interface MoneyProps {
  value: number | string | null | undefined;
  currency?: string;           // 默认 '￥'
  precision?: number;          // 默认 2
  className?: string;
  zeroAs?: '-' | '0' | string; // 空值显示
  sign?: boolean;              // 是否显示正负号
}

export function Money({
  value, currency = '￥', precision = 2,
  className, zeroAs = '-', sign = false,
}: MoneyProps) {
  if (value == null || value === '') {
    return <span className={cn('num-money text-muted-foreground', className)}>{zeroAs}</span>;
  }
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) {
    return <span className={cn('num-money text-muted-foreground', className)}>{zeroAs}</span>;
  }
  const prefix = sign && n > 0 ? '+' : '';
  const formatted = n.toLocaleString('zh-CN', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
  const tone = n < 0 ? 'text-destructive' : undefined;
  return (
    <span className={cn('num-money', tone, className)}>
      {prefix}{currency}{formatted}
    </span>
  );
}
```

#### C. 落地范围（按模块分批）

**批次 1（P0，本 sprint）**：
- 财务列表页金额列：
  - `components/finance/expenses/expense-list.tsx`
  - `app/(dashboard)/finance/payments/page-client.tsx`
  - `app/(dashboard)/finance/refunds/page-client.tsx`
  - `app/(dashboard)/finance/payables/page-client.tsx`
  - `app/(dashboard)/finance/payments-out/page-client.tsx`
  - `app/(dashboard)/finance/receivables/*`
- 销售订单列表金额列：`components/sales-orders/erp-sales-order-list.tsx`
- 库存数量列：`components/inventory/erp-inventory-list.tsx`、`InventoryGroupedTable.tsx`
- 产品价格列：`components/products/product-table.tsx`、`erp-product-list.tsx`
- 仪表板 KPI：`components/dashboard/stat-cards-enhanced.tsx`、`stat-cards.tsx`

**批次 2（P1）**：详情页、明细表内部字段 — 改造 `Money` 组件后自然一致。

### 落地步骤
1. `globals.css` 新增 4 个 utility
2. 新增 `components/ui/money.tsx`、`components/ui/number-cell.tsx`
3. 第一个改造点：`components/finance/expenses/expense-list.tsx`，作为 reference
4. 按批次 1 清单逐一替换，每个 PR 覆盖 2~3 个文件
5. 视觉验收：金额列小数点严格对齐，数字宽度一致

### 验收标准
- DevTools 选中任一金额单元格，`computed.font-variant-numeric` 包含 `tabular-nums`
- 同一列中 `1,234.00 / 987.50 / 1,000,000.00` 小数点严格对齐
- 负数自动红字（由 `Money` 组件决定）

### 风险
- 中：替换各列 render 函数时要保留原有千分位、精度、单位逻辑 → 通过 `Money` 组件参数覆盖所有已知变体
- 低：字体栈在国产 Linux 发行版若无 `SF Mono`，回退到 `"PingFang SC"` + `tabular-nums` 仍可对齐

### 工时
- utility + 组件：1 小时
- 批次 1（约 12 处列表）：4~6 小时

---

## P0-4 下调 Dashboard 圆角与卡片尺寸（去欧美 SaaS 风）

### 目标
把仪表板从"欧美 SaaS 卡片漂浮感"改为国内 ERP "密集 + 实色 + 小圆角"风格；同时为全项目圆角/阴影收敛做示范。

### 改造范围

主要文件（共 6 个）：
- `components/dashboard/erp-dashboard.tsx`
- `components/dashboard/stat-cards-enhanced.tsx`
- `components/dashboard/stat-cards.tsx`
- `components/dashboard/dashboard-trend-chart.tsx`
- `components/dashboard/product-ranking.tsx`
- `components/dashboard/dashboard-todo-bar.tsx`

### 具体改造规则

| 现状 | 改为 | 说明 |
|---|---|---|
| `rounded-3xl` (24px) | `rounded-md` (6px) | 语义令牌 |
| `rounded-[32px]` | `rounded-md` | 去硬编码 |
| `rounded-2xl` (16px) | `rounded-lg` (8px) | 收敛 |
| `bg-white/40` + `backdrop-blur-md` | `bg-card` (实色白) + `border border-border` | 消除毛玻璃 |
| KPI 卡 `h-[160px]` | `h-[88px]` 或不固定高（`min-h-[80px]`） | 一屏信息密度 × 2 |
| 趋势图 `h-[480px]` | `h-[280px]` md 以上，`h-[240px]` 移动端 | 对标金蝶云星空 |
| 待办条 `h-[92px]` `rounded-[32px]` | `h-[60px]` `rounded-md` | 紧凑 |
| 产品排行 `h-[500px]` | `h-[360px]` + 滚动 | 紧凑 |
| `shadow-lg` / 自定义阴影 | `shadow-sm` 或 `.card-shadow-light`（已有 utility，`globals.css:489`） | 去装饰感 |
| KPI 卡标题 `text-base` / `text-lg` | `text-sm` | 与 AntD Statistic 对齐 |
| KPI 数字 `text-3xl` | `text-2xl` + `.num-tabular` | 与 P0-3 联动 |

### 具体示例

`components/dashboard/erp-dashboard.tsx:24` 当前：
```tsx
<div className="h-[480px] w-full animate-pulse rounded-3xl bg-white/40" />
```
改为：
```tsx
<div className="h-[280px] w-full animate-pulse rounded-md border border-border bg-muted/40" />
```

`components/dashboard/erp-dashboard.tsx:38` 当前：
```tsx
<div key={`stat-skeleton-${idx}`} className="h-[160px] animate-pulse rounded-3xl bg-white/40" />
```
改为：
```tsx
<div key={`stat-skeleton-${idx}`} className="h-[88px] animate-pulse rounded-md border border-border bg-muted/40" />
```

`components/dashboard/erp-dashboard.tsx:55` 当前：
```tsx
<div key={`todo-skeleton-${idx}`} className="h-[92px] animate-pulse rounded-[32px] bg-white/40" />
```
改为：
```tsx
<div key={`todo-skeleton-${idx}`} className="h-[60px] animate-pulse rounded-md border border-border bg-muted/40" />
```

### 附加：仪表板布局重组（可选，增益大）

当前：KPI 单行 4 列（160px 高）→ 一屏只能看 KPI + 趋势图顶部
建议：
```
[今日关键条] 今日营收 | 今日订单数 | 今日发货数 | 今日收款 | 待办数  (每格 72px 高，单行)
[主 KPI 4 格]  （88px 高）
[趋势图 280px] [产品排行 280px]  左右双栏
[订单动态 Tab]  最近/待处理/厂家发货 合并成 Tab
```
此项若需要落地视为 P1，不强求本 sprint。

### 落地步骤
1. 先改 6 个 dashboard 文件的 skeleton 样式（上面示例）
2. 逐一改 KPI 卡、趋势图、排行榜、待办条的实体组件
3. 浏览器验收：
   - 1920×1080 全屏下一屏可见信息从 5~8 条 → 20+ 条
   - 移动端 375 宽度仍可用
4. 让 2~3 位业务同事主观评价

### 验收标准
- grep `rounded-3xl|rounded-\[32px\]|bg-white/40` 在 `components/dashboard/` 下返回 0
- 1080p 一屏可见 KPI + 趋势图 + 订单动态头部
- 对比截图（改造前/后）交付

### 风险
- 中：不同业务角色对"信息密度"偏好不同 → 建议保留 density 开关（comfortable/compact）并默认 compact，用户可切回
- 低：Chart 库如 ECharts 的默认字号也要相应缩小

### 工时
- 6 文件样式调整：3~4 小时
- 视觉走查 + 微调：1~2 小时

---

## P0-5 移动端复杂表单改用 Sheet / 全屏页

### 目标
消除"窄屏 Dialog 按钮被软键盘遮挡 / 表单挤压 / 无法横向滑动"等移动端体验硬伤。

### 改造范围（12 个目标 Dialog）

从 44 个 Dialog 中筛选"复杂表单类"（非"确认/预览"类）：

**财务（4）**：
- `components/finance/payment-creation-dialog.tsx`
- `components/finance/payment-creation-dialog-form.tsx`
- `components/finance/refund-process-dialog.tsx`
- `components/finance/receivable-payment-dialog.tsx`
- `components/finance/payables-client/PayablePaymentDialog.tsx`

**销售订单（3）**：
- `components/sales-orders/customer-create-dialog/CustomerCreateDialog.tsx`
- `components/sales-orders/add-temporary-product-dialog/AddTemporaryProductDialog.tsx`
- `components/sales-orders/historical-temporary-product-dialog.tsx`

**库存（3）**：
- `app/(dashboard)/inventory/adjust/components/InventoryAdjustDialog.tsx`
- `app/(dashboard)/inventory/adjustments/components/AdjustmentCreateDialog.tsx`
- `components/inventory/initial-stock-import-dialog.tsx`

**产品（1）**：
- `components/products/quick-create-product-dialog.tsx`
- `components/products/product-import-dialog.tsx`

**保留 Dialog**：确认类（`confirm-inbound-dialog`、`category-delete-dialogs`、`supplier-delete-dialog`）、打印预览类、详情查看类。

### 具体方案

#### A. 封装 `ResponsiveFormDialog` 组件

新建 `components/ui/responsive-form-dialog.tsx`：
- PC 端（≥768px）：渲染为 Dialog，居中卡片
- 移动端（<768px）：渲染为 Sheet（从右侧/底部滑入，全屏或近全屏）
- API 保持与现有 Dialog 一致，便于替换

```tsx
'use client';
import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle,
  SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';

interface ResponsiveFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: 'right' | 'bottom';        // 移动端滑入方向，默认 right
  widthClass?: string;              // PC 端宽度，如 'sm:max-w-2xl'
  fullHeightMobile?: boolean;       // 移动端是否全屏
}

export function ResponsiveFormDialog({
  open, onOpenChange, title, description, children, footer,
  side = 'right', widthClass = 'sm:max-w-2xl', fullHeightMobile = true,
}: ResponsiveFormDialogProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={side}
          className={cn(
            'flex w-full flex-col p-0',
            side === 'right' && fullHeightMobile && 'h-screen max-w-full',
            side === 'bottom' && 'h-[90vh] rounded-t-xl'
          )}
        >
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="text-base">{title}</SheetTitle>
            {description && (
              <SheetDescription className="text-xs">{description}</SheetDescription>
            )}
          </SheetHeader>

          {/* 可滚动正文区 + 底部安全区 */}
          <div className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+88px)]">
            {children}
          </div>

          {/* 固定底部操作条 */}
          {footer && (
            <SheetFooter className="sticky bottom-0 border-t bg-background px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
              {footer}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(widthClass, 'max-h-[85vh] overflow-y-auto')}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
```

**关键细节**：
- 移动端正文区留 `pb-[calc(...+88px)]` 给 sticky footer
- 底部留 `env(safe-area-inset-bottom)` 给 iPhone 刘海/底部安全区
- `fullHeightMobile` 默认 true（右侧全屏），从右滑入符合 iOS 导航习惯

#### B. 迁移步骤（以 `payment-creation-dialog` 为例）

1. 把文件从 `Dialog` 切换到 `ResponsiveFormDialog`
2. 把 `DialogContent > { DialogHeader, DialogFooter, Form }` 的布局拆成 `title / footer / children`
3. 把所有 `fixed` / 绝对定位的按钮改为 footer 属性
4. 在 375×812 尺寸真机或 DevTools 虚拟设备验证：
   - 输入框弹出中文键盘不遮挡
   - 金额输入触发数字键盘（`inputMode="decimal"`，见 P0-3 附带改造）
   - 底部按钮始终可见
   - 滑动关闭手势正常

#### C. 移动端输入联动优化（随表单一起改）

金额类 input 添加：
```tsx
<Input
  inputMode="decimal"
  pattern="[0-9]*\\.?[0-9]*"
  autoComplete="off"
  ...
/>
```

数量类：`inputMode="numeric"`
电话类：`inputMode="tel"`
搜索类：`inputMode="search"`

### 落地步骤
1. 封装 `ResponsiveFormDialog`（含 `useMediaQuery` 联动）
2. 选第一个目标 `InventoryAdjustDialog` 试点，走通后 code review
3. 按财务/销售订单/库存/产品顺序逐个替换，每类 1 个 PR
4. 真机测试：iPhone SE / iPhone 15 / 某安卓（或 DevTools Responsive 375×812 + 412×915）
5. 回归：PC 端行为与原 Dialog 完全一致

### 验收标准
- 12 个目标 Dialog 全部使用 `ResponsiveFormDialog`
- 375×812 下：
  - 标题栏固定顶部
  - 操作按钮固定底部
  - 正文可滚动
  - 输入框聚焦时页面不抖、按钮不被键盘遮
- 768px 及以上：UI 与改造前一致（视觉回归测试截图对比）

### 风险
- 中：现有 Dialog 里可能用了 `DialogClose` 或特殊聚焦逻辑 → 迁移时人工审查每个 onSubmit / onCancel
- 中：Sheet 的高度撑满可能触发 body 滚动锁定与 iOS 橡皮筋冲突 → 在 Sheet 根上加 `overscroll-contain`

### 工时
- 封装组件：2 小时
- 12 个迁移（每个 0.5~1 小时 + 测试）：8~12 小时

---

## 汇总：P0 总工时与排期

| 项 | 工时（人·小时） | 依赖 |
|---|---:|---|
| P0-1 字体栈 | 0.5 | — |
| P0-2 排版清洗 | 4 | — |
| P0-3 tabular-nums + Money 组件 | 6~7 | P0-1 |
| P0-4 Dashboard 瘦身 | 5 | P0-3（KPI 数字用 Money）|
| P0-5 ResponsiveFormDialog | 10~14 | P0-2（不再 uppercase）|
| **合计** | **25~30 小时** | ~ 1 sprint（1 人）|

**推荐排期（5 工作日）**：
- Day 1 上午：P0-1 + P0-2 源头 + 5 高曝光点（合并 1 个 PR：全局基础调整）
- Day 1 下午：P0-2 批量清洗 codemod + review
- Day 2：P0-3 utility + Money 组件 + 财务列表改造（1 个 PR：金额标准化）
- Day 3 上午：P0-3 其余模块（销售/库存/产品/仪表板数字）
- Day 3 下午 ~ Day 4 上午：P0-4 Dashboard 改造（1 个 PR：仪表板视觉整改）
- Day 4 下午：P0-5 封装 `ResponsiveFormDialog` + 第一个试点
- Day 5：P0-5 余下 11 个 Dialog 迁移 + 真机回归测试

---

## 提交规范建议

按 P0 每一项开 1 个 PR，便于 review 和 revert：

```
feat(ui): 补充中文字体栈并移除对中文无效排版 (P0-1, P0-2)
feat(ui): 引入 tabular-nums 与 Money 组件，统一金额/数量对齐 (P0-3)
refactor(dashboard): 瘦身仪表板视觉，对齐国内 ERP 密度 (P0-4)
feat(ui): 引入 ResponsiveFormDialog，移动端复杂表单改 Sheet (P0-5)
```

---

## 验收 checklist（QA 使用）

- [ ] PC 1920 / 1440 / 1280 三分辨率截图：登录、仪表板、库存列表、销售订单列表、财务应收、产品列表
- [ ] 移动端 375 / 414 截图：同上 + 3 个典型表单（付款创建、库存调整、客户新建）
- [ ] 暗色模式至少抽查 2 页
- [ ] 字体栈回退：关闭系统字体模拟，中文回退到雅黑/思源黑体
- [ ] 金额对齐：打开任意财务列表，肉眼确认小数点对齐
- [ ] ESLint 通过 `npm run lint`
- [ ] 构建通过 `npm run build`
- [ ] 关键路径 E2E：登录 → 创建订单 → 收款 → 仪表板查看

---

**文档维护**：每完成一项，勾掉上面的验收 checklist 并在 PR 描述中引用本文件对应小节。
