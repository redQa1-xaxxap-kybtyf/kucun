# P2 实施方案 — UI 审计整改（优化项与行业特化）

> 配套文档：`docs/ui-audit-2026-04-17.md`、`docs/ui-audit-p0-plan-2026-04-17.md`、`docs/ui-audit-p1-plan-2026-04-17.md`
> 前置依赖：P0 + P1 完成（令牌、容器、基础组件到位）
> 目标：按业务节奏渐进落地，不强制单 sprint 完成
> 原则：P2 多为"锦上添花"或"行业特化"，允许按业务方诉求跳跃式选做

---

## 基线盘点

| 条目 | 现状 |
|---|---|
| 图标库 | 统一 `lucide-react`；自定义图标仅 `components/icons/chinese-yuan.tsx` 一个 |
| 队列基础设施 | BullMQ 已就位（`lib/queue/config.ts` + `inbound-queue` + `shipping-query-queue` + `workers/`），可直接承载导出任务 |
| 导出实现 | `lib/services/export-service.ts` (380 行) + `export-audit-service.ts` 已存在；当前是"前端遍历分页拉取后下载"的客户端方案 |
| 错误/结果页 | 30+ 个零散 `error.tsx`（每个路由段独立），`app/auth/error/page.tsx` 单独一套 |
| 产品规格 | 数据模型支持 `ProductVariant` + `BatchSpecification`，但**无矩阵录入 UI** |
| 移动端 inputMode | P0-5 已带部分改造，仍有散落位点未统一 |

---

## P2-15 图标体系优化

### 目标
在保留 Lucide 作为主图标库的前提下，解决"密集表格操作列辨识度低"的问题，并建立业务图标扩展机制。

### 改造策略

**方案 A（推荐，低成本）**：Lucide 按场景加粗 + 补充业务图标
**方案 B（重）**：整体切 `@ant-design/icons-svg`

选方案 A。

### 具体方案

#### A. Lucide 粗细分级

新建 `components/ui/icon.tsx` 封装 Lucide 使用规范：

```tsx
// components/ui/icon.tsx
import * as React from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IconProps extends React.SVGAttributes<SVGElement> {
  icon: LucideIcon;
  size?: 'xs' | 'sm' | 'md' | 'lg' | number;
  /** 场景：密集表格操作列用 dense，其它用 default */
  variant?: 'default' | 'dense' | 'emphasis';
}

const SIZES = { xs: 12, sm: 14, md: 16, lg: 20 };

export function Icon({
  icon: LucideComp, size = 'md', variant = 'default', className, ...props
}: IconProps) {
  const px = typeof size === 'number' ? size : SIZES[size];
  const strokeWidth =
    variant === 'dense' ? 2.25 :           // 密集列操作图标加粗
    variant === 'emphasis' ? 2.5 :          // 状态/警告加粗
    1.75;                                   // 默认比 lucide 2 略细，更符合中文界面
  return (
    <LucideComp
      size={px}
      strokeWidth={strokeWidth}
      className={cn('shrink-0', className)}
      {...props}
    />
  );
}
```

**使用规范**（写入 `docs/ui-spec/icons.md`）：
- 表格操作列：`<Icon icon={Edit} size="sm" variant="dense" />`
- 状态徽标：`variant="emphasis"`
- 其余位置：默认

#### B. 业务图标扩展

`components/icons/` 下按需补充：
- `chinese-yuan.tsx` ✅ 已有
- `cny.tsx` / `usd.tsx` / `eur.tsx` — 币种符号
- `tile.tsx` / `pallet.tsx` / `carton.tsx` — 瓷砖行业 SKU 单位
- `truck-loaded.tsx` — 厂家发货状态
- `receipt-red-punch.tsx` — 红冲单据（P2-16 用）

所有业务图标统一尺寸 24×24 viewBox、`currentColor` 描边、1.75 strokeWidth。

#### C. 引入图标预览页

`app/(dashboard)/dev/icons/page.tsx` 列出项目全部可用图标，方便开发检索。

### 落地步骤
1. 封装 `Icon` 组件 + 文档
2. 补 4~6 个业务图标
3. 改造 2 个密集表格（库存列表、销售订单列表）作为示范
4. 逐步推广（不强制）

### 验收标准
- 密集表格操作列图标在 1080p 屏幕 80cm 观看距离仍能清晰识别
- `grep "from 'lucide-react'"` 后的组件在规范中标明 variant

### 风险
- 低

### 工时
- Icon 组件 + 文档：2 小时
- 业务图标：3 小时
- 示范改造：2 小时

---

## P2-16 作废 / 红冲水印视觉

### 目标
国内财务用户对"作废单据"有强烈的视觉辨识诉求：传统习惯是加红色斜线水印 + "已作废/已红冲/已取消"文字。

### 改造范围

**适用场景**：
- 销售订单（状态 cancelled）
- 退货订单（状态 rejected/cancelled）
- 采购订单（状态 cancelled）
- 工厂发货（状态 cancelled）
- 财务付款/退款记录（状态 voided/red-punched）
- 费用记录（状态 voided）
- 打印模板（与 `components/print-designer/*` 集成）

### 具体方案

#### A. 封装 `VoidedBadge` / `VoidedWatermark`

```tsx
// components/common/voided-watermark.tsx
'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

type VoidedTone = 'cancelled' | 'voided' | 'red-punched' | 'rejected' | 'refunded';

const LABELS: Record<VoidedTone, string> = {
  cancelled: '已取消',
  voided: '已作废',
  'red-punched': '已红冲',
  rejected: '已驳回',
  refunded: '已退款',
};

interface VoidedWatermarkProps {
  tone: VoidedTone;
  /** 角度，默认 -20 度 */
  angle?: number;
  /** 文字尺寸 */
  size?: 'sm' | 'md' | 'lg';
  /** 是否带斜线背景条 */
  striped?: boolean;
  className?: string;
  children?: React.ReactNode;   // 作为容器包裹被作废内容
}

export function VoidedWatermark({
  tone, angle = -20, size = 'lg', striped = true, className, children,
}: VoidedWatermarkProps) {
  const label = LABELS[tone];
  const sizeClass = size === 'lg' ? 'text-5xl' : size === 'md' ? 'text-3xl' : 'text-xl';

  return (
    <div className={cn('relative', className)}>
      {children}
      {/* 覆盖层：不拦截点击，只作为视觉标记 */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 flex items-center justify-center',
          striped && 'bg-[repeating-linear-gradient(135deg,transparent_0,transparent_30px,hsl(var(--error-1))_30px,hsl(var(--error-1))_60px)]',
          'opacity-60'
        )}
      >
        <span
          style={{ transform: `rotate(${angle}deg)` }}
          className={cn(
            sizeClass,
            'rounded-md border-4 border-[hsl(var(--color-error))] px-6 py-2 font-bold tracking-widest text-[hsl(var(--color-error))]',
            'bg-[hsl(var(--color-bg-card))]/80'
          )}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

// 列表页行内徽标
export function VoidedBadge({ tone }: { tone: VoidedTone }) {
  return (
    <span className="inline-flex items-center rounded-sm border border-[hsl(var(--color-error))] px-1.5 py-0.5 text-xs font-semibold text-[hsl(var(--color-error))]">
      {LABELS[tone]}
    </span>
  );
}
```

**注**：P1-11 Statistic 组件和 P0-2 `text-caption` 令牌此处联动（作废金额用 line-through）。

#### B. 列表行视觉降级

```tsx
<tr className={cn(record.status === 'cancelled' && 'opacity-50 [&_td]:line-through')}>
  ...
  <td><VoidedBadge tone="cancelled" /></td>
</tr>
```

#### C. 详情页水印

```tsx
<VoidedWatermark tone="voided">
  <OrderDetailContent order={order} />
</VoidedWatermark>
```

#### D. 打印模板集成

`components/print-designer/*` 渲染时检测 `order.status`，若为作废类状态，自动在 PDF/打印层加水印（复用 `VoidedWatermark` 或单独打印版本）。

### 落地步骤
1. 实现 `VoidedWatermark` + `VoidedBadge` + CSS 条纹背景
2. 改造销售订单详情页：`app/(dashboard)/sales-orders/[id]/page.tsx`
3. 改造列表行降级：销售/退货/采购/发货
4. 财务红冲支持：`components/finance/*` 中所有退款、作废记录
5. 打印模板集成（低优先，可延后）

### 验收标准
- 作废订单详情页红色斜线水印清晰可见
- 列表行半透明 + 删除线 + 红色徽标
- 水印不遮挡交互元素（`pointer-events-none`）
- 打印出的 PDF 保留水印（若打印集成落地）

### 风险
- 低：纯视觉 + 辅助标识
- 中：打印水印涉及 `react-to-print` / puppeteer 的 CSS 兼容性，需单独测试

### 工时
- 组件：3 小时
- 5 个场景改造：5 小时
- 打印集成：4 小时（可延后）

---

## P2-17 账龄分析组件

### 目标
补齐财务"应收账龄 / 应付账龄"的标准展示与分析，对标金蝶/用友财务模块。

### 改造范围

**新增**：
- `components/finance/aging-analysis-card.tsx` — 账龄分析卡片
- `components/finance/aging-analysis-table.tsx` — 账龄分析明细表
- `lib/services/aging-analysis-service.ts` — 账龄计算服务
- `app/api/finance/aging/route.ts` — 账龄查询 API

**关联改造**：
- 应收账款详情页集成账龄
- 应付账款详情页集成账龄
- 客户对账单加账龄列

### 具体方案

#### A. 账龄分桶（国内惯例）

```ts
// lib/types/finance-aging.ts
export type AgingBucket = 'current' | '1-30' | '31-60' | '61-90' | '91-180' | '180+';

export const AGING_BUCKETS: { key: AgingBucket; label: string; days: [number, number | null] }[] = [
  { key: 'current', label: '未到期',   days: [-Infinity, 0] },
  { key: '1-30',    label: '1-30 天',  days: [1, 30] },
  { key: '31-60',   label: '31-60 天', days: [31, 60] },
  { key: '61-90',   label: '61-90 天', days: [61, 90] },
  { key: '91-180',  label: '91-180 天',days: [91, 180] },
  { key: '180+',    label: '180 天以上',days: [181, null] },
];

export const AGING_TONE: Record<AgingBucket, 'default' | 'info' | 'warning' | 'danger'> = {
  current: 'default',
  '1-30':  'info',
  '31-60': 'info',
  '61-90': 'warning',
  '91-180':'warning',
  '180+':  'danger',
};
```

#### B. 账龄计算服务

```ts
// lib/services/aging-analysis-service.ts
interface AgingResult {
  bucket: AgingBucket;
  count: number;
  amount: number;
  items: Array<{
    id: string;
    customer: string;
    orderNumber: string;
    amount: number;
    dueDate: Date;
    overdueDays: number;
  }>;
}

export async function calculateReceivableAging(
  params: { asOfDate?: Date; customerId?: string }
): Promise<AgingResult[]> {
  // 基于 receivables 表（或 sales_orders.balance > 0）计算
  // 按 AGING_BUCKETS 分桶
}
```

#### C. UI：账龄分析卡

```tsx
<AgingAnalysisCard
  title="应收账龄分析"
  data={agingResults}
  asOfDate={new Date()}
  onBucketClick={(bucket) => navigate(`/finance/receivables?aging=${bucket}`)}
/>
```

渲染：
```
┌───────────────────────────────────────────────────┐
│ 应收账龄分析          截至 2026-04-17  [导出] [▾]│
├─────────┬─────────┬─────────┬─────────┬──────────┤
│  未到期  │ 1-30天  │ 31-60天 │ 61-90天 │ 180天+   │
│ ￥12.5万 │ ￥8.2万 │ ￥3.1万 │ ￥1.8万 │ ￥2.4万   │
│  12 单   │ 8 单    │ 3 单    │ 2 单    │ 4 单 ⚠   │
└─────────┴─────────┴─────────┴─────────┴──────────┘
      ▼ 点击任意分桶展开明细表
```

金额用 P0-3 `Money` 组件，数字 `tabular-nums` 右对齐。

#### D. 账龄明细表

用 P1-9 的 data-table（支持密度/列显隐）：
客户名称 | 单号 | 金额 | 到期日 | 逾期天数 | 分桶 | 最近联系 | 操作

逾期天数列用色阶可视化：`hsl(var(--warning-7))` 渐深表示更严重。

#### E. 集成位置

| 位置 | 形态 |
|---|---|
| `app/(dashboard)/finance/receivables/page-client.tsx` | 顶部卡片常驻 |
| `app/(dashboard)/finance/payables/page-client.tsx` | 同上 |
| `app/(dashboard)/finance/customer-statements/[customerId]/page.tsx` | 作为对账单的一个 section |
| 仪表板（可选） | 作为财务 KPI 之一 |

### 落地步骤
1. 数据模型确认（`PaymentRecord` / `PayableRecord` 是否有到期日字段；若无需补字段）
2. 实现账龄计算服务 + API
3. 实现 `AgingAnalysisCard` + `AgingAnalysisTable`
4. 集成到 2 个主要财务页
5. 导出功能（用 P2-21 服务端导出）

### 验收标准
- 任意客户的应收账龄 6 桶分布正确
- 明细表切分桶筛选工作正常
- 到期日更新后账龄实时重算（或手动刷新）
- 180 天+ 分桶红色高亮警示

### 风险
- 中：账龄计算涉及业务规则（部分收款/分期/提前还款），需与财务方对齐
- 低：性能（大客户数场景需分页 + 缓存）

### 工时
- 数据模型 + 服务：8 小时
- UI 组件：6 小时
- API + 集成：4 小时
- 测试 + 对齐业务：4 小时

---

## P2-18 仪表板首屏重塑（横向 KPI 条 + 订单动态 Tab）

### 目标
把仪表板从"卡片堆叠"改为"关键数字密集 + 组件合并"，一屏可见信息量 ×2。

### 前置
P0-4 已瘦身（圆角/卡高降低），但**布局结构未变**。此项是结构性重组。

### 改造范围
- `components/dashboard/erp-dashboard.tsx` 主结构
- `components/dashboard/quick-stat-bar.tsx`（新增）
- `components/dashboard/order-activity-tabs.tsx`（新增，合并 `recent-orders` + `pending-orders` + `factory-shipments`）
- 既有 `recent-orders.tsx` / `pending-orders.tsx` / `factory-shipments.tsx` 保留逻辑，改为 tab 内容

### 新布局

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔴 今日营收 ￥12,500 │ 今日订单 18 │ 今日发货 24 │ 待收款 ￥8.5万│ 72px
│  (横向 5~7 格紧凑统计条)                                         │
├─────────────────────────────────────────────────────────────────┤
│ 主 KPI 4 格（月 GMV / 客户数 / 库存价值 / 毛利率）      88px     │
├────────────────────────────────────┬────────────────────────────┤
│ 销售趋势图                         │ 产品销量 TOP 10             │
│ (280px)                            │ (280px)                    │
├────────────────────────────────────┴────────────────────────────┤
│ 订单动态 Tab [最近订单(20)] [待处理(5)] [厂家发货(8)] [退货(2)] │
│ (合并三列为单组件，共用表格骨架，360px 高)                       │
├──────────────────────────────┬──────────────────────────────────┤
│ 库存预警 (低库存/超期批次)   │ 待办 (审批/对账/提醒)             │
└──────────────────────────────┴──────────────────────────────────┘
```

### 具体方案

#### A. `QuickStatBar`

```tsx
interface QuickStatItem {
  key: string;
  label: string;
  value: number;
  format?: 'money' | 'count';
  tone?: 'default' | 'warning' | 'danger';
  href?: string;
}

<QuickStatBar items={[
  { key: 'today-revenue',  label: '今日营收', value: 12500, format: 'money' },
  { key: 'today-orders',   label: '今日订单', value: 18, format: 'count' },
  ...
]} />
```

渲染为水平紧凑条（每项 `flex-1`，用 `.num-money` 对齐）。

#### B. `OrderActivityTabs`

```tsx
<OrderActivityTabs
  tabs={[
    { key: 'recent',    label: '最近订单', count: 20, component: <RecentOrders /> },
    { key: 'pending',   label: '待处理',   count: 5,  component: <PendingOrders />, tone: 'warning' },
    { key: 'shipments', label: '厂家发货', count: 8,  component: <FactoryShipments /> },
    { key: 'returns',   label: '退货',     count: 2,  component: <RecentReturns /> },
  ]}
  defaultTab="pending"   // 待处理优先
/>
```

复用 P1-12 的 `StatusTabs` 数字徽标。

#### C. 对齐到 12 格栅格

主体用 `grid grid-cols-12 gap-4`：
- `QuickStatBar`: `col-span-12`
- KPI: `col-span-12` 内部 4 格
- 趋势图: `col-span-12 lg:col-span-8`
- 产品排行: `col-span-12 lg:col-span-4`
- 订单动态: `col-span-12`
- 库存预警 / 待办: `col-span-12 md:col-span-6`

### 落地步骤
1. 实现 `QuickStatBar` + 新数据 API（今日关键指标）
2. 合并 `OrderActivityTabs`，迁移现有三组件为 tab content
3. 重排 `erp-dashboard.tsx` 主结构
4. 适配移动端（QuickStatBar 横向滚动；Tab 保持；Grid 降为 1 列）
5. A/B 灰度（保留 feature flag `dashboardLayout: 'classic' | 'compact'`）

### 验收标准
- 1080p 下一屏可见：QuickStatBar + KPI + 趋势图头部 + 订单动态头部
- 切 Tab 无卡顿，首次打开默认聚焦"待处理"
- 移动端 QuickStatBar 可横向滑动查看全部

### 风险
- 中：业务方对"布局大改"敏感 → 灰度 + 保留 classic 回退
- 中：需要后端补"今日关键指标"API

### 工时
- API：3 小时
- 组件：8 小时
- 重排 + 适配：4 小时
- A/B 开关：2 小时

---

## P2-19 瓷砖行业特化

> 这是整套 P2 中 **业务价值最高** 的一项，建议单独立项。

### 目标
瓷砖经销商场景有三大特殊需求，需要 UI 层深度适配：
1. **矩阵式 SKU**：同一款瓷砖有 N 种尺寸 × M 种花色 × K 个等级，需矩阵批量录入/改价
2. **产品缩略图**：铺贴效果图是下单关键决策，列表必须醒目展示
3. **左侧分类树常驻**：多级分类（砖种/系列/花色）下筛选，下拉用不动

### 改造范围

**新增**：
- `components/products/sku-matrix-editor.tsx` — 矩阵 SKU 录入
- `components/products/product-thumbnail.tsx` — 瀑布流/卡片产品缩略图
- `components/products/category-sidebar.tsx` — 左侧常驻分类树
- `components/products/tile-spec-form.tsx` — 瓷砖规格表单（尺寸/厚度/釉面/吸水率/防滑等级...）

**改造**：
- `app/(dashboard)/products/page.tsx` — 主列表页加分类侧边栏
- `app/(dashboard)/products/create/page.tsx` — 引入矩阵 SKU
- `app/(dashboard)/products/[id]/*` — 详情页图册 + 规格表

### 具体方案

#### A. 左侧分类树常驻

用 P1-11 的 `Tree` 组件：

```tsx
// app/(dashboard)/products/page.tsx 布局
<div className="flex h-full">
  <aside className="hidden w-60 flex-shrink-0 border-r lg:block">
    <CategorySidebar
      selectedId={categoryId}
      onSelect={(id) => setCategoryId(id)}
      defaultExpandLevel={1}
      showCounts                    // 每分类末尾显示产品数
    />
  </aside>
  <div className="flex-1 overflow-hidden">
    <PageContainer ...>
      <ProductList ... />
    </PageContainer>
  </div>
</div>
```

移动端降级：顶部分类选择器（Sheet 抽屉）。

#### B. 矩阵 SKU 编辑器

典型录入场景："意大利灰"系列，尺寸 800×800 / 600×1200 / 900×1800，等级 优等 / 一级 / 合格：

```tsx
<SkuMatrixEditor
  rowDimension={{ key: 'size',  label: '尺寸', options: [...] }}
  colDimension={{ key: 'grade', label: '等级', options: [...] }}
  value={skus}                   // Array<{ size, grade, price, cost, stock }>
  onChange={setSkus}
  fields={[
    { key: 'price', label: '售价', type: 'money', required: true },
    { key: 'cost',  label: '成本', type: 'money', required: true },
    { key: 'stock', label: '库存', type: 'number' },
  ]}
  bulkOperations   // 行/列批量复制、批量改价
/>
```

渲染：
```
         │ 优等品  │ 一级品  │ 合格品  │
─────────┼─────────┼─────────┼─────────┤
800×800  │ ￥85    │ ￥72    │ ￥55    │
600×1200 │ ￥128   │ ￥108   │ ￥85    │
900×1800 │ ￥258   │ ￥220   │ ￥178   │
```
- 每格可点击编辑
- 行头/列头可 checkbox 批量选择后批量改价
- 支持"行批量 +5%"、"列批量 -10%" 之类的操作

#### C. 产品缩略图

瓷砖列表必备"铺贴效果图"大图展示：

```tsx
<ProductThumbnail
  src={product.coverImage}
  fallbackSrc="/placeholder-tile.png"
  size="md"                      // sm 80×80 / md 120×120 / lg 200×200
  badge={product.isNew ? '新品' : undefined}
  onClick={() => openPreview(product.images)}
  lazy                           // Intersection Observer 懒加载
/>
```

图片预览弹层（多图轮播 + 缩放，基于 `yet-another-react-lightbox` 或自实现）。

列表视图切换：
- 卡片视图（瀑布流）：大图 + 产品名 + 价格
- 表格视图（现状）：小缩略图 + 详细列
- 用户切换后写入 localStorage（P1-9 列显隐联动）

#### D. 瓷砖规格表单

瓷砖特有字段（单独抽为 `tile-spec-form.tsx`）：
- 尺寸（长 × 宽 × 厚）
- 釉面（抛光 / 哑光 / 柔光 / 釉面）
- 吸水率（≤0.5% / ≤3% / ≤6% / ≤10% / >10%）
- 防滑等级（R9-R13）
- 铺贴方式（工字铺 / 人字铺 / ...）
- 产地、品牌、系列、花色编码
- 一箱几片、一片几平米
- 合格证、检测报告附件（用 P1-11 Upload）

### 落地步骤
1. 与业务方访谈，确认瓷砖行业刚需字段（2h）
2. 扩展 Prisma schema（如有缺字段）
3. 实现 4 个核心组件
4. 产品列表集成分类侧边栏 + 视图切换
5. 产品创建/编辑集成矩阵 SKU + 瓷砖规格表单
6. 产品详情页图册 + 规格表
7. 业务方真实数据回测

### 验收标准
- 创建一款 3 尺寸 × 3 等级 = 9 SKU 的瓷砖，录入时间 ≤ 5 分钟
- 分类树 4 层深度下滚动/展开流畅
- 图片懒加载 + 预览无卡顿（100+ 产品列表）
- 移动端矩阵 SKU 可横向滚动查看

### 风险
- 高：瓷砖业务细节多样，需业务方深度参与；建议拉通 1~2 个经销商做需求验证
- 中：矩阵编辑器交互复杂，需多轮设计迭代
- 中：数据模型若需扩展，涉及 migration 和已有数据填充

### 工时
- 需求对齐 + 设计：4 小时
- 数据模型 + migration：4 小时
- 4 个组件：20 小时
- 集成 + 联调：8 小时
- **合计：36 小时**（1 人 5 ~ 7 工作日）

---

## P2-20 移动端三件套（inputMode + 底部操作条 + 双列卡片）

### 目标
解决移动端表单/列表的三个高频痛点。

### A. 输入模式统一

全站扫描 `<Input>` / `<NumberInput>`，按类型标注 `inputMode`：

| 字段类型 | inputMode | pattern | 键盘 |
|---|---|---|---|
| 金额 | `decimal` | `[0-9]*\\.?[0-9]*` | 数字 + 小数点 |
| 数量/整数 | `numeric` | `[0-9]*` | 纯数字 |
| 手机号 | `tel` | `1[3-9][0-9]{9}` | 电话拨号 |
| 邮箱 | `email` | — | @/.com |
| 搜索 | `search` | — | 搜索键 |
| 单号/SKU | `text` + `autocapitalize="off"` | — | 默认 |

**落地**：
- 扩展 `components/ui/input.tsx` 和 `components/ui/number-cell.tsx`（P0-3）接受 `inputType` prop 自动映射
- codemod 批量扫描业务层 `<Input>`，加 TODO 注释给人工 review

```tsx
<Input
  inputType="money"        // 新 prop
  // 等价于：inputMode="decimal" pattern="[0-9]*\.?[0-9]*"
  value={...}
/>
```

### B. 固定底部操作条

P0-5 已在 `ResponsiveFormDialog` 中实现；此项是把同一模式下沉到**整页表单**（销售订单创建、库存单据、产品编辑）：

```tsx
// 用 P1-7 的 DocumentFormLayout 自带 sticky footer，已覆盖
<DocumentFormLayout
  header={...}
  details={...}
  actions={
    <div className="flex gap-2">
      <Button variant="outline" onClick={cancel}>取消</Button>
      <Button variant="outline" onClick={saveDraft}>存草稿</Button>
      <Button onClick={submit}>提交</Button>
    </div>
  }
/>
```

**验证点**：
- iOS Safari 底部 Home Indicator 不遮挡按钮（`pb-[calc(env(safe-area-inset-bottom)+12px)]`）
- 安卓软键盘弹起时按钮自动让位（`resize-content` vs `resize-view`，通过 `interactive-widget` viewport meta 控制）

`app/layout.tsx` / root layout 确认 viewport：
```tsx
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};
```

### C. 双列卡片布局

`MobileDataTable` 的卡片模式当前单列；对于信息字段多的场景（产品列表、客户列表），支持双列：

```tsx
<MobileDataTable
  data={products}
  columns={columns}
  mobileLayout={{
    columns: 2,                          // 双列
    compact: true,
    primaryField: 'name',
    secondaryFields: ['sku', 'price'],
    thumbnailField: 'coverImage',
  }}
/>
```

两列卡片模板（瓷砖场景）：
```
┌─────────────┬─────────────┐
│ [缩略图]     │ [缩略图]     │
│ 意大利灰 800 │ 卡拉拉白 600 │
│ ￥85  库存99 │ ￥72  库存45 │
└─────────────┴─────────────┘
```

### 落地步骤
1. 扩展 Input 的 `inputType` + codemod 加 TODO
2. 全站扫描 + 人工 review 每个标注
3. 更新 viewport 配置 + `env(safe-area-inset-*)` 工具类
4. 扩展 `MobileDataTable` 双列模式
5. 2 个示范列表（产品 + 客户）改造

### 验收标准
- 移动端金额/数量字段弹出正确数字键盘
- iPhone 15 / 某安卓真机：软键盘弹起时操作按钮不遮
- 产品列表移动端双列展示，信息清晰

### 风险
- 低：都是增量改造

### 工时
- inputMode：4 小时
- 底部操作条验证：2 小时
- 双列卡片：3 小时
- 示范迁移：3 小时

---

## P2-21 导出功能：服务端任务 + 通知

### 目标
把当前"前端遍历分页拉取全量再下载"的客户端导出，改为 BullMQ 服务端任务 + 完成通知。

### 现状
- `lib/services/export-service.ts` (380 行) 前端调用导出逻辑
- 库存导出代码 `fetchInventoryExportData`（`app/(dashboard)/inventory/page-client.tsx:63-106`）循环拉取 API，数据量大时前端等待久、易超时
- BullMQ 基础设施已就位（`lib/queue/`），可直接复用

### 改造范围

**新增**：
- `lib/queue/export-queue.ts` — 导出任务队列
- `lib/queue/workers/export-worker.ts` — 导出任务 worker
- `lib/services/export-job-service.ts` — 任务状态管理
- `app/api/exports/route.ts` — 创建/查询任务 API
- `app/api/exports/[id]/download/route.ts` — 下载结果
- `components/common/export-button.tsx` — 统一导出按钮
- `components/common/export-jobs-drawer.tsx` — "我的导出"抽屉

**改造**：
- `lib/services/export-service.ts` — 从同步转为入队 + worker 执行
- 各列表页的导出按钮 → 用统一 `<ExportButton />`

**数据模型**：
```prisma
model ExportJob {
  id          String   @id @default(cuid())
  userId      String
  type        String   // 'inventory' | 'sales-orders' | 'receivables' | ...
  status      ExportStatus    // pending / processing / success / failed
  params      Json            // 导出查询参数
  resultUrl   String?         // 七牛云文件 URL
  fileName    String?
  totalRows   Int?
  error       String?
  progress    Int?            // 0~100
  createdAt   DateTime @default(now())
  completedAt DateTime?
  expiresAt   DateTime        // 结果保留 7 天
  @@index([userId, createdAt])
}
```

### 具体方案

#### A. 导出流程

```
用户点导出
  ↓
POST /api/exports {type, params}
  ↓
创建 ExportJob (status=pending) → 入 BullMQ 队列
  ↓
返回 { jobId } 给前端
  ↓
前端 Toast: "导出任务已创建，完成后将通知您"
  ↓
Worker 处理 → 生成 xlsx/csv → 上传七牛 → 更新 DB (status=success, resultUrl)
  ↓
后端推送通知（复用现有 notifications 系统）
  ↓
前端 Toast: "导出完成 [下载]"，并在"我的导出"抽屉可见
```

#### B. 统一 ExportButton

```tsx
<ExportButton
  type="inventory"
  params={currentQueryParams}
  label="导出 Excel"
  formats={['xlsx', 'csv']}
  columns={visibleColumns}        // 与 P1-9 列显隐联动
/>
```

内部：
- 小数据量（≤500 行）→ 同步下载（保留原体验）
- 大数据量 → 入队 + 通知

#### C. "我的导出"抽屉

用户头像下拉中加入"我的导出"入口，或顶部通知栏中集成：

```tsx
<ExportJobsDrawer>
  - 今日
    - 库存导出 2026-04-17 10:23  ✅ 完成  [下载]  3.2 MB
    - 销售订单导出 10:45        ⏳ 处理中 45%
  - 本周
    - ...
</ExportJobsDrawer>
```

#### D. 进度汇报

Worker 定期更新 `progress` 字段（每处理 1000 行）；前端轮询 or WebSocket 订阅任务状态。

### 落地步骤
1. Prisma migration 加 `ExportJob` 表
2. 实现 `export-queue.ts` + `export-worker.ts`
3. 迁移 `export-service.ts` 生成逻辑到 worker
4. 创建/查询/下载 API
5. 前端 `ExportButton` + `ExportJobsDrawer`
6. 接入通知系统
7. 旧的 `fetchInventoryExportData` 客户端循环代码删除
8. 清理任务：cron 每天删除过期（>7 天）的 ExportJob 和七牛文件

### 验收标准
- 10 万行库存导出 ≤ 3 分钟完成
- 前端不再阻塞等待，可继续操作
- 任务失败有明确错误提示
- 下载文件带水印"导出人 / 导出时间"（配合 `export-audit-service.ts`）

### 风险
- 中：Worker 集群部署，需确保 PM2 cluster 模式下仅一个 worker 实例处理任务队列
- 中：七牛云文件生命周期管理（7 天自动删除）需配 bucket lifecycle policy
- 低：向后兼容 — 小数据量走旧路径

### 工时
- 数据模型 + 迁移：2 小时
- 队列 + Worker：8 小时
- API + 前端组件：8 小时
- 通知集成 + 抽屉：4 小时
- 清理任务 + 测试：3 小时
- **合计：25 小时**

---

## P2-22 统一 Result 页 + 错误页重构

### 目标
统一 404 / 403 / 500 / 网络错误 / 操作成功等结果页视觉，减少各路由 `error.tsx` 重复代码。

### 现状
- 项目中 30+ 个零散 `error.tsx`（按路由段划分）
- `app/auth/error/page.tsx` 另一套认证错误页
- 无统一"成功反馈页"（订单提交成功等场景用 toast 过于轻量）

### 改造范围

**新增**：
- `components/ui/result.tsx` — 统一 Result 组件（参考 AntD `<Result>`）
- `app/not-found.tsx` — 全局 404（若没有）
- `app/error.tsx` — 全局根级错误
- `app/global-error.tsx` — Next.js 全局错误边界
- `lib/constants/result-presets.ts` — 预设 Result 配置

**精简**：
- 30+ 个路由段 `error.tsx` → 统一用 `<Result>` + `reset()` 回调，代码从 20~50 行降到 5~10 行

### 具体方案

#### A. `Result` 组件

```tsx
// components/ui/result.tsx
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Icon } from './icon';

type ResultStatus =
  | 'success' | 'error' | 'warning' | 'info'
  | '404' | '403' | '500' | 'network';

interface ResultProps {
  status: ResultStatus;
  icon?: LucideIcon;                  // 自定义图标
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  extra?: React.ReactNode;            // 自定义操作按钮组
  actions?: Array<{
    label: string;
    onClick?: () => void;
    href?: string;
    variant?: 'default' | 'outline';
  }>;
  compact?: boolean;                  // 紧凑模式（列表内占位用）
  className?: string;
}

export function Result({ status, icon, title, subtitle, extra, actions, compact, className }: ResultProps) {
  const config = RESULT_STATUS_CONFIG[status];
  const FinalIcon = icon ?? config.icon;

  return (
    <div className={cn(
      'flex flex-col items-center justify-center gap-4 py-12 text-center',
      compact ? 'py-8' : 'min-h-[60vh]',
      className
    )}>
      <div className={cn('flex h-20 w-20 items-center justify-center rounded-full', config.bgClass)}>
        <FinalIcon size={40} className={config.iconClass} />
      </div>
      <div className="max-w-md">
        <h2 className="text-xl font-semibold">{title}</h2>
        {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap justify-center gap-2">
          {actions.map((a, i) => (
            <Button key={i} variant={a.variant} onClick={a.onClick} asChild={!!a.href}>
              {a.href ? <a href={a.href}>{a.label}</a> : a.label}
            </Button>
          ))}
        </div>
      )}
      {extra}
    </div>
  );
}
```

#### B. 预设配置

```ts
// lib/constants/result-presets.ts
import { CheckCircle, XCircle, AlertTriangle, Info, FileSearch, Lock, ServerCrash, WifiOff } from 'lucide-react';

export const RESULT_STATUS_CONFIG = {
  success:  { icon: CheckCircle,   bgClass: 'bg-success/10',   iconClass: 'text-success' },
  error:    { icon: XCircle,       bgClass: 'bg-destructive/10', iconClass: 'text-destructive' },
  warning:  { icon: AlertTriangle, bgClass: 'bg-warning/10',   iconClass: 'text-warning' },
  info:     { icon: Info,          bgClass: 'bg-info/10',      iconClass: 'text-info' },
  '404':    { icon: FileSearch,    bgClass: 'bg-muted',        iconClass: 'text-muted-foreground' },
  '403':    { icon: Lock,          bgClass: 'bg-warning/10',   iconClass: 'text-warning' },
  '500':    { icon: ServerCrash,   bgClass: 'bg-destructive/10', iconClass: 'text-destructive' },
  network:  { icon: WifiOff,       bgClass: 'bg-muted',        iconClass: 'text-muted-foreground' },
} as const;

export const RESULT_PRESETS = {
  notFound404: {
    status: '404' as const,
    title: '页面走丢了',
    subtitle: '您访问的页面不存在或已被删除',
    actions: [
      { label: '返回首页', href: '/dashboard', variant: 'default' as const },
      { label: '返回上一页', onClick: () => history.back(), variant: 'outline' as const },
    ],
  },
  forbidden403: {
    status: '403' as const,
    title: '无权限访问',
    subtitle: '您没有权限查看此页面，请联系管理员',
    actions: [
      { label: '返回首页', href: '/dashboard' },
    ],
  },
  serverError500: {
    status: '500' as const,
    title: '服务器开了点小差',
    subtitle: '请稍后重试，或联系技术支持',
  },
  networkError: {
    status: 'network' as const,
    title: '网络连接异常',
    subtitle: '请检查网络后重试',
  },
  orderSubmitted: {
    status: 'success' as const,
    title: '订单提交成功',
  },
};
```

#### C. 根级错误边界

```tsx
// app/not-found.tsx
import { Result } from '@/components/ui/result';
import { RESULT_PRESETS } from '@/lib/constants/result-presets';
export default function NotFound() { return <Result {...RESULT_PRESETS.notFound404} />; }

// app/error.tsx
'use client';
import { Result } from '@/components/ui/result';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <Result
      status="500"
      title="页面加载失败"
      subtitle={error.message || '发生未知错误'}
      actions={[
        { label: '重试', onClick: reset },
        { label: '返回首页', href: '/dashboard', variant: 'outline' },
      ]}
    />
  );
}
```

#### D. 替换路由段 `error.tsx`

把 30+ 个类似实现：
```tsx
// 旧：app/(dashboard)/inventory/error.tsx
'use client';
export default function Error({ error, reset }) {
  return <div>加载失败: {error.message} <button onClick={reset}>重试</button></div>;
}
```

改为（统一）：
```tsx
'use client';
import { Result } from '@/components/ui/result';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <Result
      status="error"
      title="数据加载失败"
      subtitle={error.message}
      actions={[{ label: '重试', onClick: reset }]}
    />
  );
}
```

**或**：创建通用 `components/common/route-error.tsx`：
```tsx
'use client';
export function RouteError({ error, reset, module }: { error: Error; reset: () => void; module: string }) {
  return <Result status="error" title={`${module}加载失败`} subtitle={error.message} actions={[{ label: '重试', onClick: reset }]} />;
}
```
各路由仅一行：
```tsx
'use client';
import { RouteError } from '@/components/common/route-error';
export default (p: any) => <RouteError {...p} module="库存" />;
```

### 落地步骤
1. 实现 `Result` + presets
2. 根级 `app/not-found.tsx` + `app/error.tsx` + `app/global-error.tsx`
3. 替换 `app/auth/error/page.tsx`
4. 抽通用 `RouteError` + codemod 替换 30+ 个路由段 error.tsx
5. 新增成功结果页示范（订单提交成功、导出任务创建成功）

### 验收标准
- 手动请求不存在的 URL 看到统一 404 页
- 触发任意路由错误看到统一 Error 页
- 所有 `error.tsx` ≤ 10 行
- 全站 Result 视觉风格一致

### 风险
- 低：纯视觉与代码收敛

### 工时
- 组件 + presets：4 小时
- 根级错误页：2 小时
- codemod + 验证：3 小时
- 成功场景示范：2 小时

---

## 汇总：P2 总工时与排期

| 项 | 工时（人·小时） | 依赖 | 业务价值 |
|---|---:|---|---|
| P2-15 图标体系 | 7 | — | 🟡 |
| P2-16 作废/红冲水印 | 12 | P1-6 令牌 | 🔴 财务刚需 |
| P2-17 账龄分析 | 22 | P1-9 表格 | 🔴 财务刚需 |
| P2-18 仪表板重塑 | 17 | P1-12 StatusTabs | 🟡 |
| P2-19 瓷砖行业特化 | 36 | P1-11 Tree/Upload | 🔴 核心业务 |
| P2-20 移动端三件套 | 12 | P0-5、P1-7 | 🟡 |
| P2-21 服务端导出 | 25 | — | 🟡 |
| P2-22 Result 统一 | 11 | — | 🟢 |
| **合计** | **142 小时** | — | ~ 18 工作日（1 人）|

### 推荐拆分：按业务价值分三批

**批次 1 · 财务深化（5~6 工作日）**
优先做财务相关的行业痛点：
- P2-16 作废/红冲水印（12h）
- P2-17 账龄分析（22h）
- P2-22 Result 统一（11h）
- 小计：45h

**批次 2 · 行业核心（5~6 工作日）**
- P2-19 瓷砖行业特化（36h）— **建议单独立项，与业务方深度共创**
- 小计：36h

**批次 3 · 体验优化（6~7 工作日）**
- P2-18 仪表板重塑（17h）
- P2-21 服务端导出（25h）
- P2-20 移动端三件套（12h）
- P2-15 图标体系（7h）
- 小计：61h

---

## 渐进落地原则

与 P0/P1 的"强制统一"不同，**P2 允许按业务方诉求跳跃式选做**：

1. **财务方诉求强** → 优先批次 1
2. **即将上线大客户试点** → 优先批次 2（瓷砖特化）
3. **日常打磨体验** → 选做批次 3 的单项

每项保持 **独立可回退**，单 PR 发布，灰度验证。

---

## 验收 checklist

### 批次 1（财务）
- [ ] 作废订单/退款详情红色斜线水印 + 列表删除线
- [ ] 账龄分析 6 桶分布展示 + 导出
- [ ] 180 天+ 应收红色警示
- [ ] 打印 PDF 保留水印（若落地）
- [ ] 全站 `error.tsx` ≤ 10 行且视觉统一
- [ ] 404/403/500 页可正常访问

### 批次 2（行业）
- [ ] 产品列表左侧分类树常驻
- [ ] 产品创建矩阵 SKU 录入 9 个变体 ≤ 5 分钟
- [ ] 产品图预览流畅（懒加载 + lightbox）
- [ ] 瓷砖特有字段完整（釉面/吸水率/防滑等级）
- [ ] 业务方真实数据灰度验证

### 批次 3（体验）
- [ ] 仪表板一屏可见 5+ 组信息
- [ ] QuickStatBar 移动端可横向滚动
- [ ] 10 万行导出后端任务完成
- [ ] "我的导出"抽屉可见历史任务
- [ ] 金额输入弹数字键盘
- [ ] 安卓/iOS 真机验证软键盘不遮按钮
- [ ] 产品列表移动端双列卡片

---

## 里程碑建议

```
Sprint 1 (P0)          [■■■■■]  5 工作日  — 必须
Sprint 2-4 (P1)        [■■■■■][■■■■■][■■■■■]  15 工作日  — 必须
Sprint 5-6 (P2 批次1)  [■■■■■][■]  6 工作日  — 强烈建议（财务刚需）
Sprint 7 (P2 批次2)    [■■■■■][■]  6 工作日  — 可并行业务立项
Sprint 8-9 (P2 批次3)  [■■■■■][■■]  7 工作日  — 按业务节奏
```

**总计 40 工作日（约 2 个月）** 完成 UI 审计 22 项整改。

---

## 交付物

- 本方案文档（`docs/ui-audit-p2-plan-2026-04-17.md`）
- 新增基础组件：`Icon`、`VoidedWatermark`、`AgingAnalysisCard`、`QuickStatBar`、`OrderActivityTabs`、`SkuMatrixEditor`、`ProductThumbnail`、`CategorySidebar`、`ExportButton`、`ExportJobsDrawer`、`Result`
- 新增行业模块：矩阵 SKU 编辑器、账龄分析
- 新增基础设施：导出任务队列 + Worker
- 数据模型新增：`ExportJob`
- 单元测试 + E2E 关键路径测试
- 业务方 A/B 灰度开关：dashboardLayout、productListView

---

**文档维护**：完成一项勾掉 checklist，在对应 PR 描述中回链本文对应小节。P2 建议每完成一批次做一次业务方走查，收集反馈进入下一批次。
