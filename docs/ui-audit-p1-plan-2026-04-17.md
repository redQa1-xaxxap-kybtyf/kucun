# P1 实施方案 — UI 审计整改（一致性与效率）

> 配套文档：`docs/ui-audit-2026-04-17.md`、`docs/ui-audit-p0-plan-2026-04-17.md`
> 前置依赖：P0 全部完成（字体栈、tabular-nums、ResponsiveFormDialog 等）
> 目标：2 ~ 3 个 sprint（10~15 工作日，1 人）
> 原则：优先动基础设施（令牌、容器、组件库），再带动业务页面收敛；每项独立 PR

---

## 基线统计

| 条目 | 影响面 |
|---|---|
| `useMediaQuery` JS 响应式 | 仅 2 个文件（`DashboardLayoutClient.tsx`、`MobileOptimized.tsx`） — 迁移成本低 |
| `finance/page.tsx` | 690 行（项目规范 ≤ 300） |
| `PageHeader` 现有能力 | 标题 + 描述 + 图标 + 操作区；**缺** 面包屑/Tab/副标题/内容插槽 |
| `search-filter-card.tsx` | 632 行（已经是"大而全" — 需审慎扩展，不重构）|
| `data-table.tsx` | 331 行 — 支持基本功能，**缺** 列显隐/筛选方案保存/密度切换 |
| 缺失基础组件 | Tree / Cascader / Upload / Descriptions / Steps / Statistic |

---

## P1-6 设计令牌补全至 8 阶色阶 + 全状态语义令牌

### 目标
将 3~5 档的简易色阶扩展到 AntD 风格 8 阶（1~10，核心用 1/3/5/6/7/10），补齐 hover/active/selected/disabled/focus 全状态。

### 改造范围
- 唯一源：`app/globals.css`（新增变量）
- 不改动组件层（令牌向下兼容现有 primary-500 / primary-100 等）

### 具体方案

#### A. 色阶扩展

对每个核心色（primary/success/warning/error/info/purple/cyan）从 3~5 档扩到 10 档。以 primary 为例：

```css
:root {
  /* AntD Blue 对照：1~10 色阶（HSL 近似） */
  --primary-1:  208 100% 97.1%;   /* #e6f4ff  背景 */
  --primary-2:  210 100% 94.1%;   /* #bae0ff  浅背景 */
  --primary-3:  211 100% 86.3%;   /* #91caff  悬浮态背景 */
  --primary-4:  213 100% 76.7%;   /* #69b1ff  浅边框 */
  --primary-5:  214 100% 64.3%;   /* #4096ff  悬浮主色 */
  --primary-6:  215 100% 54.3%;   /* #1677ff  主品牌色 ⭐ */
  --primary-7:  217 92%  44.3%;   /* #0958d9  按下/深主色 */
  --primary-8:  219 88%  35.1%;   /* #003eb3  强调 */
  --primary-9:  221 85%  25.9%;   /* #002c8c  深文字 */
  --primary-10: 223 80%  16.7%;   /* #001d66  最深 */

  /* 旧 token 向下兼容映射 */
  --primary-50:  var(--primary-1);
  --primary-100: var(--primary-2);
  --primary-400: var(--primary-5);
  --primary-500: var(--primary-6);
  --primary-600: var(--primary-7);
}
```

同规则扩展 success / warning / error / info。gray 已经 10 阶（50~950），不动。

#### B. 全状态语义令牌

```css
:root {
  /* 主色状态 */
  --color-primary:          var(--primary-6);
  --color-primary-hover:    var(--primary-5);
  --color-primary-active:   var(--primary-7);
  --color-primary-selected: var(--primary-1);
  --color-primary-disabled: var(--primary-3);
  --color-primary-border:   var(--primary-5);
  --color-primary-bg:       var(--primary-1);
  --color-primary-bg-hover: var(--primary-2);

  /* 表格状态 */
  --color-table-row-hover:    var(--gray-50);
  --color-table-row-selected: var(--primary-1);
  --color-table-row-striped:  var(--gray-50);
  --color-table-border:       var(--color-border-primary);
  --color-table-header-bg:    var(--gray-50);

  /* 链接状态 */
  --color-link:          var(--primary-6);
  --color-link-hover:    var(--primary-5);
  --color-link-active:   var(--primary-7);
  --color-link-visited:  var(--purple-500);

  /* Focus 两档 */
  --color-focus-ring:    var(--primary-5);
  --color-focus-shadow:  var(--primary-2);

  /* 状态文本（用于标签/徽标） */
  --color-status-processing-bg: var(--info-1);
  --color-status-processing-fg: var(--info-7);
  --color-status-success-bg:    var(--success-1);
  --color-status-success-fg:    var(--success-7);
  --color-status-warning-bg:    var(--warning-1);
  --color-status-warning-fg:    var(--warning-7);
  --color-status-error-bg:      var(--error-1);
  --color-status-error-fg:      var(--error-7);
  --color-status-default-bg:    var(--gray-100);
  --color-status-default-fg:    var(--gray-600);
}
```

#### C. 暗色模式对偶映射
同一批令牌在 `@media (prefers-color-scheme: dark)` 下反转（浅↔深），确保组件无需条件判断即可适配。

### 落地步骤
1. 改 `globals.css` 新增变量（**不删除**旧变量，仅新增映射）
2. 新建 `docs/ui-spec/design-tokens.md` 列出完整令牌矩阵（色阶 × 状态）
3. 在 Storybook / dev 页面（`app/(dashboard)/dev/`）加一个 `tokens-preview` 路由展示所有色阶
4. P1 后续条目（P1-7/P1-9 等）再用新令牌

### 验收标准
- `hsl(var(--primary-6))` 与 `hsl(var(--primary-500))` 渲染完全相同
- tokens-preview 页能看到 7 种色 × 10 档色阶矩阵 + 所有状态色
- 现有页面无视觉回归（因为仅新增未修改）

### 风险
- 低；纯增量
- 后续组件层切换到新命名（primary-6）可能要用 codemod

### 工时
- 令牌设计 + 编码：4 小时
- tokens-preview 页：2 小时
- 文档：1 小时

---

## P1-7 抽象 PageContainer / DocumentFormLayout

### 目标
建立全站统一的"页面骨架"，让任何业务页面只关心内容不关心布局；替换掉散落在各页面的自制 header 代码。

### 改造范围

**新增**：
- `components/layouts/page-container.tsx`
- `components/layouts/document-form-layout.tsx`
- `components/layouts/filter-bar.tsx`
- `components/layouts/action-bar.tsx`

**替换/兼容**：
- 现有 `components/common/page-header.tsx` 保留，让 `PageContainer` 内部复用它；标记 deprecated 引导迁移
- 现有各业务 `*-page-header.tsx` 保持不动，但新页面一律用 `PageContainer`

### 具体方案

#### A. `PageContainer`（列表/详情通用容器）

```tsx
// components/layouts/page-container.tsx
'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  /** 顶部面包屑（可选，若 layout 已处理可不传） */
  breadcrumb?: React.ReactNode;
  /** 主标题 */
  title?: React.ReactNode;
  /** 副标题 */
  subtitle?: React.ReactNode;
  /** 左侧图标 */
  icon?: React.ReactNode;
  /** 顶部右侧操作区 */
  extra?: React.ReactNode;
  /** 标题下方 Tab（sticky） */
  tabs?: React.ReactNode;
  /** 标题下方筛选/统计条 */
  banner?: React.ReactNode;
  /** 主体内容 */
  children: React.ReactNode;
  /** 底部 sticky 操作条（表单常用） */
  footer?: React.ReactNode;
  /** 正文内边距，默认 true */
  padded?: boolean;
  className?: string;
}

export function PageContainer({
  breadcrumb, title, subtitle, icon, extra, tabs, banner,
  children, footer, padded = true, className,
}: PageContainerProps) {
  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* 标题区 */}
      {(title || extra) && (
        <div className="border-b bg-card px-4 py-3 md:px-6 md:py-4">
          {breadcrumb && <div className="mb-2">{breadcrumb}</div>}
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {icon && <div className="flex-shrink-0">{icon}</div>}
              <div className="min-w-0">
                {title && (
                  <h1 className="text-page-title truncate">{title}</h1>
                )}
                {subtitle && (
                  <p className="text-caption mt-0.5 truncate">{subtitle}</p>
                )}
              </div>
            </div>
            {extra && <div className="flex flex-shrink-0 gap-2">{extra}</div>}
          </div>
        </div>
      )}

      {/* Tab 条 */}
      {tabs && (
        <div className="sticky top-0 z-10 border-b bg-card px-4 md:px-6">
          {tabs}
        </div>
      )}

      {/* Banner（统计/提示） */}
      {banner && <div className="border-b bg-muted/30 px-4 py-2 md:px-6">{banner}</div>}

      {/* 主体 */}
      <div
        className={cn(
          'flex-1 overflow-auto',
          padded && 'p-4 md:p-6',
        )}
      >
        {children}
      </div>

      {/* 底部 sticky 操作条 */}
      {footer && (
        <div className="sticky bottom-0 border-t bg-card px-4 py-3 md:px-6">
          {footer}
        </div>
      )}
    </div>
  );
}
```

#### B. `DocumentFormLayout`（单据类表单）

针对入库/出库/盘点/订单创建等"头 + 明细 + 底部汇总"场景：

```tsx
// components/layouts/document-form-layout.tsx
'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

interface DocumentFormLayoutProps {
  /** 单据头（基础信息卡片） */
  header: React.ReactNode;
  /** 明细区（表格或表单） */
  details: React.ReactNode;
  /** 汇总区（金额、数量等 — sticky 在底部内容上方） */
  summary?: React.ReactNode;
  /** 扩展区（附件、备注、审批历史） */
  extras?: React.ReactNode;
  /** 右侧操作/信息栏（可选，桌面端展示） */
  side?: React.ReactNode;
  /** 页面 footer 操作按钮条 */
  actions: React.ReactNode;
  className?: string;
}

export function DocumentFormLayout({
  header, details, summary, extras, side, actions, className,
}: DocumentFormLayoutProps) {
  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex flex-1 gap-4 overflow-hidden p-4 md:p-6">
        {/* 主列 */}
        <div className="flex flex-1 flex-col gap-4 overflow-auto">
          <section>{header}</section>
          <section className="flex-1">{details}</section>
          {extras && <section>{extras}</section>}
        </div>

        {/* 桌面端右侧栏 */}
        {side && (
          <aside className="hidden w-80 flex-shrink-0 overflow-auto lg:block">
            {side}
          </aside>
        )}
      </div>

      {/* 汇总 + 操作 sticky 底部 */}
      {summary && (
        <div className="border-t bg-muted/30 px-4 py-2 md:px-6">{summary}</div>
      )}
      <div className="sticky bottom-0 border-t bg-card px-4 py-3 md:px-6 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        {actions}
      </div>
    </div>
  );
}
```

#### C. `FilterBar`（查询筛选栏）

对标 AntD Pro 的 `QueryFilter`：单行显示常用筛选，多余收到"展开"，支持"查询/重置/保存方案"。

```tsx
// components/layouts/filter-bar.tsx
interface FilterBarProps {
  /** 主筛选字段（单行展示） */
  primary: React.ReactNode;
  /** 扩展筛选字段（展开后显示） */
  secondary?: React.ReactNode;
  onSearch: () => void;
  onReset: () => void;
  onSaveScheme?: () => void;     // P1-9 联动
  schemes?: React.ReactNode;      // 已保存方案下拉
  defaultExpanded?: boolean;
  className?: string;
}
```

内置行为：
- 桌面端横向 grid 3~4 列
- 移动端折叠为抽屉（用 P0-5 的 ResponsiveFormDialog）
- 支持 Enter 触发搜索

### 落地步骤

1. 先落 `PageContainer` + `FilterBar`
2. 选 2 个示范页：`app/(dashboard)/customers/page-client.tsx` + `app/(dashboard)/suppliers/page-client.tsx`（复杂度中等）迁移
3. 验收后，再落 `DocumentFormLayout`
4. 示范页：`app/(dashboard)/inventory/inbound/*`（入库表单）
5. 其余页面作为 P2 渐进迁移，不做强制

### 验收标准
- 示范 4 个页面使用新容器，代码行数比原实现减少 ≥ 30%
- 视觉一致：四个页面的标题栏、筛选栏、底部操作条完全对齐
- 移动端：标题栏可折叠、操作按钮固定底部、筛选栏可抽屉

### 风险
- 中：现有页面迁移时容易把业务逻辑带入容器；严守"容器不关心业务"原则
- 低：`search-filter-card.tsx` (632 行) 暂不动，`FilterBar` 是并行新组件，老组件逐步淘汰

### 工时
- 容器 + 文档：6 小时
- 4 个示范页迁移：6 小时

---

## P1-8 色彩饱和度下调（稳重化）

### 目标
把 primary / error / warning / info 等核心色从 95~100% 饱和度降至 70~85%，降低视觉疲劳与"玩具感"。

### 改造范围
仅 `app/globals.css` 的色阶定义（一次改，全站生效）。

### 具体方案

| 令牌 | 当前 HSL | 建议 HSL | 说明 |
|---|---|---|---|
| `--primary-500/6` | `215 100% 54.3%` | `215 86% 52%` | 对齐 AntD #1677ff |
| `--error-500/6`   | `359.3 100% 65.1%` | `0 78% 56%` | 对齐 AntD #ff4d4f |
| `--warning-500/6` | `31.1 95.8% 53.3%` | `34 90% 54%` | 对齐 AntD #faad14 |
| `--info-500/6`    | `208.8 100% 54.7%` | `205 85% 54%` | — |
| `--success-500/6` | `100.2 76.6% 43.5%` | `118 55% 41%` | 对齐 AntD #52c41a（建议改色相更暖） |
| `--purple-500`    | `265 63.9% 50%` | `265 55% 54%` | 稍提亮降饱和 |
| `--cyan-500`      | `180 82.2% 41.8%` | `180 65% 45%` | — |

### 落地步骤
1. 改 `globals.css` 7 个 500 档色值（以及 P1-6 后新增的 6 档同步调整）
2. 浏览：仪表板、财务报表（图表）、库存列表（状态徽标）、登录页
3. 在 tokens-preview 页看前后对比
4. 把 3 位业务/设计同事拉来做 A/B 视觉评审

### 验收标准
- 新旧对比截图归档
- error/warning 红黄视觉不刺眼，可长时间阅读
- 图表（ECharts/Recharts）调色板自动适配（若图表用自定义色板，需同步替换）

### 风险
- 中：业务方可能对"降饱和"敏感 → 提供 A/B 开关走灰度
- 低：已生成的品牌物料（favicon/启动图）若用了旧主色，视觉有差异

### 工时
- 调色 + 评审：3 小时
- 图表色板同步：2 小时

---

## P1-9 表格默认密度 compact + 列显隐 + 筛选方案

### 目标
三件套让表格更贴近国内 ERP 用户的"一屏信息最大化 + 按需定制 + 常用查询保存"习惯。

### 改造范围

**新增**：
- `components/common/table-density-toggle.tsx`
- `components/common/column-visibility-toggle.tsx`
- `components/common/filter-scheme-manager.tsx`
- `hooks/use-filter-schemes.ts`

**改造**：
- `components/common/data-table.tsx`（331 行，加 density/column props）
- `components/ui/mobile-data-table.tsx`（同步支持 density）
- 5 个核心列表页默认改 compact：inventory / sales-orders / finance-receivables / products / customers

### 具体方案

#### A. 密度切换

```tsx
// components/common/table-density-toggle.tsx
export type TableDensity = 'compact' | 'middle' | 'comfortable';

export const DENSITY_PRESETS: Record<TableDensity, {
  cellPy: string;   // padding-y
  cellPx: string;
  fontSize: string;
}> = {
  compact:     { cellPy: 'py-1',   cellPx: 'px-2',  fontSize: 'text-xs' },
  middle:      { cellPy: 'py-2',   cellPx: 'px-3',  fontSize: 'text-sm' },
  comfortable: { cellPy: 'py-3',   cellPx: 'px-4',  fontSize: 'text-sm' },
};

export function TableDensityToggle({ value, onChange }: {
  value: TableDensity;
  onChange: (v: TableDensity) => void;
}) {
  // 下拉菜单 "紧凑/默认/宽松"，图标用 AlignJustify
}
```

Data-table 内部：
```tsx
const preset = DENSITY_PRESETS[density];
<td className={cn(preset.cellPy, preset.cellPx, preset.fontSize, ...)} />
```

**默认值**：`compact`，用户切换后写入 localStorage key `table:density:{pageKey}`。

#### B. 列显隐

```tsx
// hooks/use-column-visibility.ts
export function useColumnVisibility(pageKey: string, defaults: string[]) {
  // 读取/写入 localStorage: `table:columns:{pageKey}`
  // 返回 { visibleKeys, setVisibleKeys, reset }
}

// components/common/column-visibility-toggle.tsx
// 下拉菜单 + CheckboxList，支持"重置默认"
```

列定义扩展：
```tsx
interface ColumnDef<T> {
  key: string;
  title: string;
  // 新增
  hideable?: boolean;        // 默认 true；主键/操作列设为 false
  defaultHidden?: boolean;   // 默认隐藏（如高级字段）
  // ...
}
```

#### C. 筛选方案保存

```tsx
// hooks/use-filter-schemes.ts
export interface FilterScheme {
  id: string;
  name: string;
  params: Record<string, unknown>;
  createdAt: string;
  isDefault?: boolean;
}

export function useFilterSchemes(pageKey: string) {
  // 存储：localStorage 或服务端 /api/user-preferences/filter-schemes
  // 返回 { schemes, save, apply, delete, setDefault }
}
```

**存储位置权衡**：
- 起步阶段：localStorage（0 后端工作）
- 后期扩展：新增 `UserPreference` 表存服务端（跨设备同步）

UI：
```
[已保存方案 ▾] [📌 保存当前为方案] [↺ 重置]
  └ 我的待处理     [默认]  ✏  🗑
    本月大客户              ✏  🗑
    超期未发货              ✏  🗑
```

### 落地步骤
1. 实现三件套组件 + hooks（不改动业务页面）
2. 改 `data-table.tsx` 接受 `density/visibleColumns/pageKey` props
3. 示范改造：`components/inventory/erp-inventory-list.tsx`
4. 测试 E2E：切换密度、隐藏列、保存方案、刷新页面保留
5. 推广到其余 4 个核心列表

### 验收标准
- 5 个列表页默认 compact，一屏行数比原 comfortable 多 ≥ 50%
- 用户可独立为每页面保存密度/列/筛选方案，互不干扰
- 清除 localStorage 后回到 compact 默认态

### 风险
- 中：`data-table.tsx` 改造要避免破坏已上生产的所有列表页 → 新 props 可选，默认行为不变
- 低：筛选方案 localStorage 有 5MB 上限，对 ERP 使用场景绰绰有余

### 工时
- 组件 + hooks：8 小时
- data-table 改造 + 示范：4 小时
- 推广 4 个列表：4 小时

---

## P1-10 断点从 JS `useMediaQuery` 切换到 Tailwind CSS

### 目标
消除 SSR 首屏与客户端的"桌面 → 移动闪烁"；统一用 Tailwind `md:/lg:` 前缀。

### 改造范围
仅 2 个文件用了 `useMediaQuery`：
- `components/common/DashboardLayoutClient.tsx`（主布局，**主战场**）
- `components/common/MobileOptimized.tsx`（5 处）

ResponsiveFormDialog（P0-5）**必须**保留 JS hook（Dialog 和 Sheet 无法用 CSS 条件渲染，需运行时选组件）。

### 具体方案

#### A. `DashboardLayoutClient` 改造思路

当前：JS 判断 `isMobile/isTablet` → 条件渲染 `SidebarClient` 或 `MobileNav`，并给 main 加 `ml-72/ml-20`。

改造：**让桌面侧边栏与移动抽屉始终都在 DOM**，靠 CSS 控制显隐与位置：

```tsx
// 伪代码
return (
  <div className="flex h-screen flex-col">
    <Header
      // 菜单按钮用 CSS 控制
      menuButtonClassName="md:hidden"
    />
    <div className="flex flex-1">
      {/* 桌面侧边栏：md 以下隐藏 */}
      <SidebarClient className="hidden md:flex md:w-72 data-[collapsed=true]:md:w-20" />

      {/* 移动抽屉：md 及以上隐藏 */}
      <MobileNav open={mobileOpen} onOpenChange={setMobileOpen} triggerClassName="md:hidden" />

      <main className="flex-1 overflow-y-auto md:ml-0">
        {children}
      </main>
    </div>
  </div>
);
```

**要点**：
- 侧边栏折叠态用 `data-collapsed` 属性 + CSS 规则切换宽度
- 主内容区不再手动 `ml-72/ml-20`，靠 flex 自动布局
- 状态（折叠/抽屉开）仍需 useState，但**不再依赖媒体查询判断设备**
- 手势处理保留（仅 mobileOpen 相关）

SSR 首屏：服务端默认渲染"假设桌面态"，CSS 在 md 以下自然隐藏侧边栏，不闪烁。

#### B. `MobileOptimized` 改造

该组件多处 `useMediaQuery` 用于条件渲染不同组件（如 `MobileCard` vs `DesktopRow`）。部分可以转为 CSS，部分（涉及完全不同组件）保留 JS。

**策略**：
- 如果只是"不同样式" → 纯 CSS `hidden md:block` / `md:hidden`
- 如果是"不同组件" → 保留 JS hook，但加 `suppressHydrationWarning` 和服务端默认值兜底

### 落地步骤
1. 改 `DashboardLayoutClient` 并在本地开发模式刷新首页，开 Chrome DevTools Throttling 模拟慢速加载，观察是否有布局跳动
2. 改 `MobileOptimized` 各处
3. 跑 `npm run build && npm run start`，SSR 产出的 HTML 里直接搜 `hidden md:block` 验证
4. Chrome Lighthouse CLS 指标对比（改造前 vs 后）

### 验收标准
- CLS（累计布局偏移）< 0.1
- 首屏视觉无闪烁（录屏对比）
- 移动端手势仍正常

### 风险
- 中：`DashboardLayoutClient` 改动影响全站，需全量回归
- 低：CSS 断点与业务逻辑解耦后更易维护

### 工时
- DashboardLayoutClient：4 小时（含回归）
- MobileOptimized：2 小时
- 测试：2 小时

---

## P1-11 补充基础组件：Tree / Cascader / Upload / Descriptions / Steps / Statistic

### 目标
补全 shadcn/ui 未覆盖、而 ERP/国内业务高频用到的 6 个基础组件。

### 优先级（按业务阻塞度）

| 优先级 | 组件 | 业务阻塞 |
|---|---|---|
| P1a | **Tree** | 分类、权限、组织架构（分类树当前是业务层自实现） |
| P1a | **Descriptions** | 所有详情页现在用 grid 自拼 |
| P1a | **Statistic** | KPI 数字 + 单位 + 趋势，dashboard 刚需 |
| P1b | **Upload** | 图片上传已在 `image-upload.tsx` 单点实现，需统一 |
| P1b | **Steps** | 订单/单据状态流，可延后但强需 |
| P1c | **Cascader** | 地区用 `address-selector` 已覆盖，其它场景少 |

### 具体方案（逐个）

#### A. `Tree` (`components/ui/tree.tsx`)

基于 Radix 无原生 Tree，自实现：
```tsx
interface TreeNode {
  key: string;
  title: React.ReactNode;
  children?: TreeNode[];
  disabled?: boolean;
  selectable?: boolean;
  icon?: React.ReactNode;
}

interface TreeProps {
  data: TreeNode[];
  selectedKeys?: string[];
  expandedKeys?: string[];
  checkable?: boolean;            // 多选
  checkedKeys?: string[];
  onSelect?: (keys: string[], node: TreeNode) => void;
  onCheck?: (keys: string[]) => void;
  onExpand?: (keys: string[]) => void;
  defaultExpandAll?: boolean;
  showLine?: boolean;             // 连接线
  draggable?: boolean;
  onDrop?: (info: { dragNode: TreeNode; dropNode: TreeNode; position: 'before' | 'after' | 'inside' }) => void;
  virtual?: boolean;              // 大数据虚拟化
  height?: number;
}
```

**实现要点**：
- 键盘导航（↑↓←→/Enter/Space）
- 拖拽排序（引入 `@dnd-kit/core` 或 `react-dnd`）
- 虚拟滚动（>500 节点，引入 `@tanstack/react-virtual`）
- 可后续替换 `components/categories/*` 的自实现

#### B. `Descriptions` (`components/ui/descriptions.tsx`)

```tsx
<Descriptions title="客户基本信息" column={2} bordered size="small">
  <DescriptionsItem label="客户名称">张三</DescriptionsItem>
  <DescriptionsItem label="联系电话">13800000000</DescriptionsItem>
  <DescriptionsItem label="地址" span={2}>广东省佛山市...</DescriptionsItem>
</Descriptions>
```

API 与 AntD 对齐，简化实现（CSS Grid）：
```tsx
interface DescriptionsProps {
  title?: React.ReactNode;
  extra?: React.ReactNode;
  column?: number | { xs: number; sm: number; md: number; lg: number };
  bordered?: boolean;
  size?: 'small' | 'middle' | 'large';
  colon?: boolean;
  layout?: 'horizontal' | 'vertical';
}
```

#### C. `Statistic` (`components/ui/statistic.tsx`)

```tsx
<Statistic
  title="本月营收"
  value={125800.50}
  precision={2}
  prefix="￥"
  suffix={<TrendingUp className="h-3 w-3" />}
  valueClassName="num-money text-success"
  description="较上月 +12.5%"
/>
```

集成 `count-up.tsx` 做数字滚动动画。

#### D. `Upload` (`components/ui/upload.tsx`)

封装已有 `image-upload.tsx` 的七牛上传逻辑，抽象通用 Upload：
```tsx
interface UploadProps {
  accept?: string;
  multiple?: boolean;
  maxCount?: number;
  maxSize?: number;             // MB
  listType?: 'text' | 'picture' | 'picture-card';
  fileList?: UploadFile[];
  onChange?: (files: UploadFile[]) => void;
  beforeUpload?: (file: File) => boolean | Promise<boolean>;
  customUpload?: (file: File) => Promise<string>;  // 默认走七牛
  drag?: boolean;
  disabled?: boolean;
}
```

#### E. `Steps` (`components/ui/steps.tsx`)

```tsx
<Steps current={2} size="small" direction="horizontal" status="process">
  <StepsItem title="草稿" description="2026-04-10 创建" />
  <StepsItem title="已确认" description="2026-04-11 审批通过" />
  <StepsItem title="已发货" description="待发货" />
  <StepsItem title="已签收" />
</Steps>
```

#### F. `Cascader` (`components/ui/cascader.tsx`)

多级级联选择，基于 Popover + 多列列表，支持搜索、懒加载。

### 落地步骤
1. 每个组件独立 PR，按优先级顺序：Descriptions → Statistic → Tree → Upload → Steps → Cascader
2. 每个组件配一个 `__tests__/` 单测 + dev 预览页（`app/(dashboard)/dev/components/{name}/page.tsx`）
3. 落地后：分类管理用 Tree、客户详情用 Descriptions、仪表板 KPI 用 Statistic 各自重构示范

### 验收标准
- 6 个组件在 dev 预览页可见、可交互
- API 参考 AntD 文档，迁移成本低
- 示范业务页重构后代码精简

### 风险
- 中：Tree 自实现工作量大 → 可选用 `react-arborist` 二次封装，省 50% 工作
- 低：组件 API 不稳定期，业务使用要做版本控制

### 工时
- Descriptions：3 小时
- Statistic：2 小时
- Tree（自实现）：8 小时 / （用 react-arborist）：4 小时
- Upload：4 小时
- Steps：3 小时
- Cascader：6 小时
- **合计：22~26 小时**

---

## P1-12 订单状态 Tab 增加数字徽标

### 目标
列表页顶部的状态 Tab（全部/待审核/已发货/已完成/已取消）显示各状态的订单数，对标 AntD/国内电商 ERP 惯例。

### 改造范围
- 销售订单列表 `components/sales-orders/erp-sales-order-list.tsx`
- 退货订单 `components/return-orders/*`（若存在 Tab）
- 采购订单 `components/purchase-orders/*`
- 工厂发货 `components/factory-shipments/*`
- 财务应收/应付（按状态分组）

### 具体方案

#### A. API 端返回计数

改/加 API：列表接口的 `?includeStatusCounts=1` 参数返回：
```json
{
  "data": [...],
  "pagination": {...},
  "statusCounts": {
    "all": 1234,
    "draft": 23,
    "confirmed": 45,
    "shipped": 88,
    "completed": 1050,
    "cancelled": 28
  }
}
```

#### B. UI 组件

封装 `components/common/status-tabs.tsx`：
```tsx
interface StatusTabItem {
  key: string;
  label: string;
  count?: number;
  tone?: 'default' | 'warning' | 'danger' | 'success';  // 驱动徽标颜色
}

<StatusTabs
  items={[
    { key: 'all', label: '全部' },
    { key: 'draft', label: '草稿', count: 23, tone: 'default' },
    { key: 'confirmed', label: '待发货', count: 45, tone: 'warning' },
    { key: 'shipped', label: '已发货', count: 88, tone: 'success' },
  ]}
  value={status}
  onChange={setStatus}
/>
```

**视觉**：
```
[全部]  [草稿 23]  [待发货 ⓢ 45]  [已发货 88]  [已取消 28]
```
- 数字大于 99 显示 "99+"
- 危险/警告 tone 用状态色徽标（`.num-tabular`）

#### C. 缓存策略
- 前端 TanStack Query 缓存 statusCounts，staleTime 30s
- 用户切换 Tab 时数字不重新请求（只过滤前端）
- 创建/删除订单后使用 `queryClient.invalidateQueries` 刷新

### 落地步骤
1. 后端加 `statusCounts` 返回（优先销售订单接口）
2. 前端新增 `StatusTabs` 组件
3. 改造销售订单列表
4. 复制到其余 4 个列表

### 验收标准
- 5 个列表的状态 Tab 显示正确计数
- 新建/删除单据后 Tab 数字同步更新（≤5s 延迟）
- 移动端徽标不溢出

### 风险
- 中：后端计数查询需加索引，避免性能问题
- 低：状态定义散落在各业务服务，需统一收敛到 `lib/types/*`

### 工时
- 后端（按模块 1h）× 5 = 5 小时
- StatusTabs 组件：2 小时
- 5 个列表改造：4 小时

---

## P1-13 拆分 `finance/page.tsx`（690 行 → ≤300 行）

### 目标
遵守项目 CLAUDE.md 约定（文件 ≤ 300 行），提升可维护性。

### 改造范围
- `app/(dashboard)/finance/page.tsx` (690 行) 拆分
- 不改动子路由 (`receivables/` / `payables/` 等)

### 具体方案

#### A. 按职责拆分

从 `page.tsx` 抽取：

```
app/(dashboard)/finance/
├── page.tsx                    # ≤ 100 行，仅数据获取 + 渲染
├── _components/
│   ├── FinanceWorkbenchSection.tsx    # 财务工作台卡片组
│   ├── FinancePrioritySection.tsx     # 待办优先级卡片
│   ├── FinanceShortcutsSection.tsx    # 快捷入口分组
│   └── FinanceOverviewHeader.tsx      # 顶部统计
└── _lib/
    ├── priority-cards.config.ts        # PriorityCard 数据配置
    ├── shortcut-groups.config.ts       # ShortcutGroup 数据配置
    └── workbench-cards.builder.ts      # 从 metrics 构建卡片数据的纯函数
```

#### B. 类型与配置外移

当前 `page.tsx` 内定义的 `PriorityCard` / `ShortcutItem` / `ShortcutGroup` / `FinanceWorkbenchCard` / `WorkbenchTone` 类型 → 移到 `lib/types/finance-dashboard.ts`。

### 落地步骤
1. 抽取 4 个 section 组件，每个独立文件 + 单测
2. 抽取 3 个 config/builder 文件
3. `page.tsx` 瘦身到只做数据获取 + 组件编排
4. 视觉回归（首屏截图对比）

### 验收标准
- `page.tsx` ≤ 100 行
- 每个 section 组件 ≤ 200 行
- 现有视觉与交互不变

### 风险
- 低：纯重构，不改逻辑
- 拆分后 SSR props 传递层级增加，注意类型一致性

### 工时
- 4 小时

---

## P1-14 列表加载态从文本改为 Skeleton

### 目标
消除"列表加载中..."这种无定位的文字 loading，用结构化骨架屏，与主流 ERP/AntD 体验对齐。

### 改造范围

**现状**：`app/(dashboard)/sales-orders/page-client.tsx:24-28` 等多处用"列表加载中..."虚线框占位。

**盘点**（grep "列表加载中" / "加载中..."）：
- 销售订单列表
- 库存列表（已用 `InventoryListSkeleton`，可参考）
- 产品列表
- 客户列表
- 供应商列表
- 财务各列表

### 具体方案

#### A. 通用 `TableSkeleton`

`components/ui/skeleton-compositions.tsx` 已存在 `InventoryListSkeleton`，抽象为通用：

```tsx
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  showPagination?: boolean;
  showToolbar?: boolean;
  density?: TableDensity;
}

export function TableSkeleton({
  rows = 10, columns = 6, showHeader = true,
  showPagination = true, showToolbar = true, density = 'compact',
}: TableSkeletonProps) {
  // 渲染与真实表格结构一致的占位
}
```

#### B. 详情页骨架

```tsx
export function DetailPageSkeleton() {
  // 标题栏 + 3 个 Card（描述 + 表格 + 表格）
}
```

#### C. 仪表板骨架

`ERPDashboard` 已有各区域 loading fallback（P0-4 调整过尺寸）— 直接复用。

### 落地步骤
1. 提取通用 `TableSkeleton` 到 `components/ui/skeleton-compositions.tsx`
2. 替换所有"列表加载中..."文本为 `<TableSkeleton />`
3. 验收：动态 `import()` 的 `loading` fallback 全部用 Skeleton

### 验收标准
- `grep "列表加载中"` 返回 0（UI 代码中）
- Skeleton 与实际表格列数/行高接近，切换时无跳动

### 风险
- 低：纯视觉改进

### 工时
- Skeleton 组件：2 小时
- 替换全站 loading：3 小时

---

## 汇总：P1 总工时与排期

| 项 | 工时（人·小时） | 依赖 |
|---|---:|---|
| P1-6 令牌 8 阶 + 全状态 | 7 | — |
| P1-7 PageContainer / DocumentFormLayout | 12 | P0-2（排版令牌） |
| P1-8 色彩饱和度下调 | 5 | P1-6 |
| P1-9 表格密度/列显隐/筛选方案 | 16 | — |
| P1-10 断点 CSS 化 | 8 | — |
| P1-11 6 个基础组件 | 22~26 | — |
| P1-12 状态 Tab 数字徽标 | 11 | 后端配合 |
| P1-13 拆分 finance/page.tsx | 4 | — |
| P1-14 Skeleton 替换文字 loading | 5 | — |
| **合计** | **90~94 小时** | ~ 12 工作日（1 人） |

### 推荐三 Sprint 拆分

**Sprint A（基础设施，5 工作日）**
- P1-6 令牌扩展
- P1-8 色彩调整
- P1-10 断点 CSS 化
- P1-13 finance 拆分
- P1-14 Skeleton 替换

**Sprint B（组件库，5 工作日）**
- P1-7 PageContainer / DocumentFormLayout
- P1-11 基础组件（Descriptions / Statistic / Tree 优先）

**Sprint C（业务增强，5 工作日）**
- P1-9 表格三件套
- P1-12 状态 Tab 徽标
- P1-11 剩余组件（Upload / Steps / Cascader）
- 示范迁移（客户、供应商、入库单据）

---

## 验收 checklist

### 基础设施
- [ ] tokens-preview 页展示 7 色 × 10 阶 + 全状态
- [ ] `grep useMediaQuery` 仅剩 ResponsiveFormDialog 和必要位置
- [ ] CLS < 0.1（Lighthouse）
- [ ] `finance/page.tsx` ≤ 100 行
- [ ] `grep "列表加载中"` = 0

### 组件库
- [ ] dev 预览页可交互：Descriptions / Statistic / Tree / Upload / Steps / Cascader
- [ ] PageContainer 在 4 个示范页生效
- [ ] DocumentFormLayout 在入库表单生效

### 业务增强
- [ ] 5 个核心列表：默认 compact，支持列显隐，支持保存筛选方案
- [ ] 5 个核心列表：状态 Tab 显示数字徽标
- [ ] 列表切换密度/隐藏列/应用筛选方案后刷新保留

### 视觉
- [ ] 对比截图归档：改造前后的仪表板、5 个列表、2 个详情
- [ ] 暗色模式 2 页抽查

---

## 交付物

- 本方案文档（`docs/ui-audit-p1-plan-2026-04-17.md`）
- `docs/ui-spec/design-tokens.md`
- 11~14 个 PR（每项独立）
- Dev 预览页 `/dev/tokens-preview`、`/dev/components/*`
- 改造前后截图存档 `docs/ui-audit/screenshots/`

---

**文档维护**：完成一项勾掉 checklist，在对应 PR 描述中回链本文。
