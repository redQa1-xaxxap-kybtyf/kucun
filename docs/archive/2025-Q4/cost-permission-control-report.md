# 库存管理系统 - 成本信息权限控制检查报告

## 📋 检查概述

**检查时间**: 2025-11-19
**检查范围**: 库存管理系统中所有涉及成本信息的页面和API
**权限标识**: `finance:view` (查看财务数据权限)

---

## ✅ 已实现权限控制的模块

### 1. 库存列表页面 (`/inventory`)

**文件**:

- `components/inventory/InventoryGroupedTable.tsx` (第 131-135, 154-159, 354-369 行)
- `components/inventory/InventoryTableRow.tsx` (第 216-230 行)

**实现状态**: ✅ **已完整实现**

**权限控制逻辑**:

```typescript
// 检查用户是否有财务查看权限
const hasFinancePermission = React.useMemo(
  () => can(session?.user ?? null, 'finance:view'),
  [session?.user]
);

// 表头条件渲染
{hasFinancePermission && (
  <>
    <TableHead className="text-right">单位成本（元）</TableHead>
    <TableHead className="text-right">库存总成本（元）</TableHead>
  </>
)}

// 表格内容条件渲染
{hasFinancePermission && (
  <>
    <TableCell className="text-right">
      {item.unitCost ? formatCurrency(item.unitCost) : '-'}
    </TableCell>
    <TableCell className="text-right">
      {item.unitCost ? formatCurrency(item.quantity * item.unitCost) : '-'}
    </TableCell>
  </>
)}
```

**权限控制效果**:

- ✅ 无 `finance:view` 权限: 隐藏"单位成本"和"库存总成本"列
- ✅ 有 `finance:view` 权限: 显示完整成本信息

---

## ❌ 未实现权限控制的模块

### 2. 库存统计卡片

**文件**: `components/inventory/inventory-statistics-cards.tsx`

**实现状态**: ❌ **未实现权限控制**

**问题**: 所有用户都能看到以下敏感财务数据：

- 库存总金额 (totalValue)
- 期初库存金额 (openingBalance.totalCost)

**代码位置**: 第 45-63 行

**API 端点**: `GET /api/inventory/statistics`

- **当前权限**: `inventory:view` (仅库存查看权限)
- **问题**: ❌ 应该需要 `finance:view` 权限才能访问成本数据

---

### 3. 入库记录详情页

**文件**: `app/(dashboard)/inventory/inbound/[recordNumber]/page.tsx`

**实现状态**: ❌ **完全未实现权限控制**

**问题**: 所有用户都能看到以下成本信息（第 148-170 行）：

- 单位成本 (unitCost)
- 总成本 (totalCost)

---

### 4. 出库记录详情页

**文件**: `app/(dashboard)/inventory/outbound/[recordNumber]/page.tsx`

**实现状态**: ❌ **完全未实现权限控制**

**问题**: 所有用户都能看到单位成本信息（第 148-154 行）

---

### 5. 盘点记录表格

**文件**: `components/inventory/counts/count-items-table.tsx`

**实现状态**: ❌ **完全未实现权限控制**

**问题**: 所有用户都能看到：

- 单位成本 (unitCost)
- 总成本 (totalCost)

---

### 6. 入库/出库记录列表

**文件**:

- `components/inventory/forms/inbound-records-table.tsx`
- `components/inventory/forms/outbound-records-table.tsx`

**实现状态**: ✅ **表格中不显示成本信息**

**说明**: 列表页面不显示成本，符合预期

---

### 7. 库存调整记录

**文件**: `app/(dashboard)/inventory/adjustments/components/AdjustmentRecordsTable.tsx`

**实现状态**: ✅ **不涉及成本信息**

**说明**: 调整记录只记录数量变化，不涉及成本

---

## 📊 权限控制总结表

| 模块         | 文件/位置                            | 成本字段                   | 权限控制               | 状态          |
| ------------ | ------------------------------------ | -------------------------- | ---------------------- | ------------- |
| 库存列表表格 | `InventoryGroupedTable.tsx`          | unitCost, totalCost        | ✅ `finance:view`      | ✅ 已实现     |
| 库存列表表格 | `InventoryTableRow.tsx`              | unitCost, totalCost        | ✅ `finance:view`      | ✅ 已实现     |
| 库存统计卡片 | `inventory-statistics-cards.tsx`     | totalValue, openingBalance | ❌ 无                  | ❌ 需修复     |
| 库存统计API  | `/api/inventory/statistics`          | totalValue, openingBalance | ❌ 仅 `inventory:view` | ❌ 需修复     |
| 入库记录列表 | `inbound-records-table.tsx`          | -                          | N/A                    | ✅ 不显示成本 |
| 入库记录详情 | `/inventory/inbound/[recordNumber]`  | unitCost, totalCost        | ❌ 无                  | ❌ 需修复     |
| 出库记录列表 | `outbound-records-table.tsx`         | -                          | N/A                    | ✅ 不显示成本 |
| 出库记录详情 | `/inventory/outbound/[recordNumber]` | unitCost                   | ❌ 无                  | ❌ 需修复     |
| 调整记录列表 | `AdjustmentRecordsTable.tsx`         | -                          | N/A                    | ✅ 不涉及成本 |
| 盘点记录     | `count-items-table.tsx`              | unitCost, totalCost        | ❌ 无                  | ❌ 需修复     |

---

## 🔧 修复方案对比

## 🎯 推荐实施方案（方案 A）

### 第一阶段：修复高优先级模块

#### 1. 库存统计卡片 + API

**需修改文件**:

- `components/inventory/inventory-statistics-cards.tsx`
- `app/api/inventory/statistics/route.ts`
- `lib/types/inventory-statistics.ts` (类型定义)

**前端修改**:

```typescript
// components/inventory/inventory-statistics-cards.tsx
import { useSession } from 'next-auth/react';
import { can } from '@/lib/auth/permissions';

export function InventoryStatisticsCards({ statistics, isLoading }) {
  const { data: session } = useSession();
  const hasFinancePermission = can(session?.user ?? null, 'finance:view');

  const cards = [
    // 仅财务权限可见
    ...(hasFinancePermission && statistics?.totalValue !== undefined ? [
      {
        id: 'totalValue',
        title: '库存总金额',
        icon: DollarSign,
        value: `¥${formatCurrency(statistics.totalValue)}`,
        description: '当前库存总价值',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
      },
    ] : []),
    ...(hasFinancePermission && statistics?.openingBalance ? [
      {
        id: 'openingBalance',
        title: '期初库存金额',
        icon: Wallet,
        value: `¥${formatCurrency(statistics.openingBalance.totalCost)}`,
        description: `${statistics.openingBalance.recordCount} 条期初记录`,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
      },
    ] : []),
    // 所有人可见
    {
      id: 'totalProducts',
      title: '库存产品数',
      icon: Package,
      value: formatNumber(statistics.totalProducts),
      description: 'SKU 数量',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      id: 'totalQuantity',
      title: '库存总数量',
      icon: TrendingUp,
      value: formatNumber(statistics.totalQuantity),
      description: '片',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      id: 'stockHealth',
      title: '库存健康度',
      icon: AlertTriangle,
      value: `${statistics.stockHealthPercentage}%`,
      description: `${statistics.lowStockCount} 个低库存产品`,
      // 颜色逻辑...
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {/* 动态调整列数 */}
      {cards.map(card => (
        <Card key={card.id}>{/* ... */}</Card>
      ))}
    </div>
  );
}
```

**API 修改**:

```typescript
// app/api/inventory/statistics/route.ts
import { can } from '@/lib/auth/permissions';

export const GET = withAuth(
  async (request: NextRequest, { user }) => {
    // 检查是否有财务权限
    const hasFinancePermission = can(user, 'finance:view');

    // 基础统计（所有人可见）
    const statistics = {
      totalProducts: inventoryStats._count.id || 0,
      totalQuantity: inventoryStats._sum.quantity || 0,
      lowStockCount: lowStockProducts,
      stockHealthPercentage: /* 计算逻辑 */,
    };

    // 仅财务权限返回成本数据
    if (hasFinancePermission) {
      const totalInventoryValue = inventoryRecords.reduce((sum, record) => {
        return sum + record.quantity * (record.unitCost || 0);
      }, 0);

      Object.assign(statistics, {
        totalValue: Math.round(totalInventoryValue * 100) / 100,
        openingBalance: {
          totalCost: openingBalanceStats._sum.totalCost || 0,
          totalQuantity: openingBalanceStats._sum.quantity || 0,
          recordCount: openingBalanceStats._count.id || 0,
        },
      });
    }

    return NextResponse.json({ success: true, data: statistics });
  },
  { permissions: ['inventory:view'] }
);
```

**类型定义修改**:

```typescript
// lib/types/inventory-statistics.ts
export interface InventoryStatistics {
  // 基础统计（所有人可见）
  totalProducts: number;
  totalQuantity: number;
  lowStockCount: number;
  stockHealthPercentage: number;

  // 成本统计（仅财务权限可见，可选）
  totalValue?: number;
  openingBalance?: {
    totalCost: number;
    totalQuantity: number;
    recordCount: number;
  };
}
```

---

#### 2. 入库记录详情页

**需修改文件**: `app/(dashboard)/inventory/inbound/[recordNumber]/page.tsx`

**修改内容**:

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/auth/permissions';

export default async function InboundRecordDetailPage({ params }) {
  const session = await getServerSession(authOptions);
  const hasFinancePermission = can(session?.user ?? null, 'finance:view');

  // 获取入库记录...

  return (
    <div>
      {/* 其他信息卡片 */}

      <Card>
        <CardHeader>
          <CardTitle>入库详情</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DetailStat label="入库数量" value={/* ... */} />
          <DetailStat label="操作人" value={/* ... */} />
          <DetailStat label="批次号" value={/* ... */} />

          {/* 仅财务权限可见 */}
          {hasFinancePermission && (
            <>
              <DetailStat
                label="单位成本"
                value={record.unitCost ? formatCurrency(record.unitCost) : '—'}
                icon={<HandCoins className="h-5 w-5" />}
              />
              <DetailStat
                label="总成本"
                value={record.totalCost ? formatCurrency(record.totalCost) : '—'}
                icon={<DollarSign className="h-5 w-5" />}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

      </Card>
    </div>

);
}

````

---

#### 3. 出库记录详情页

**需修改文件**: `app/(dashboard)/inventory/outbound/[recordNumber]/page.tsx`

**修改内容**: 同入库记录详情页，添加权限检查后条件渲染成本信息

---

#### 4. 盘点记录表格

**需修改文件**: `components/inventory/counts/count-items-table.tsx`

**修改内容**:
```typescript
'use client';
import { useSession } from 'next-auth/react';
import { can } from '@/lib/auth/permissions';

export function CountItemsTable({ items }) {
  const { data: session } = useSession();
  const hasFinancePermission = can(session?.user ?? null, 'finance:view');

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>产品编码</TableHead>
          <TableHead>产品名称</TableHead>
          {/* 其他列 */}
          {hasFinancePermission && (
            <>
              <TableHead className="text-right">单位成本</TableHead>
              <TableHead className="text-right">总成本</TableHead>
            </>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map(item => (
          <TableRow key={item.id}>
            <TableCell>{item.productCode}</TableCell>
            <TableCell>{item.productName}</TableCell>
            {/* 其他单元格 */}
            {hasFinancePermission && (
              <>
                <TableCell className="text-right">
                  {formatNumber(item.unitCost)}
                </TableCell>
                <TableCell className="text-right">
                  {formatNumber(item.totalCost)}
                </TableCell>
              </>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
````

---

## 📝 实施检查清单

### 高优先级（必须修复）

- [ ] 库存统计卡片前端权限控制
- [ ] 库存统计 API 权限控制
- [ ] 库存统计类型定义更新
- [ ] 入库记录详情页权限控制
- [ ] 出库记录详情页权限控制

### 中优先级（建议修复）

- [ ] 盘点记录表格权限控制
- [ ] 盘点执行页面权限控制

### 低优先级（可选）

- [ ] API 响应数据过滤
- [ ] 添加权限控制单元测试
- [ ] 添加审计日志

---

## 🔐 权限配置说明

### 当前权限体系

**权限标识**: `finance:view`

**拥有该权限的角色**:

- ✅ `admin` (管理员)
- ✅ `finance` (财务)
- ❌ `sales` (销售)
- ❌ `warehouse` (仓库)
- ❌ `viewer` (查看者)

**权限定义位置**: `lib/auth/permissions.ts`

```typescript
export type Permission =
  | 'finance:view' // 查看财务数据
  | 'finance:manage' // 管理财务数据
  | 'finance:export' // 导出财务报表
  | 'finance:approve'; // 审批财务单据
// ...
```

---

## 🎯 预期效果

### 修复前

- ❌ 所有用户都能看到库存总金额、期初库存金额
- ❌ 销售人员可以查看产品成本，可能泄露定价策略
- ❌ 仓库人员可以看到成本数据，无业务必要

### 修复后

- ✅ 只有管理员和财务可以看到成本相关数据
- ✅ 销售和仓库人员只能看到数量信息
- ✅ 符合财务数据保密要求
- ✅ 降低商业信息泄露风险

---

## 📞 后续建议

1. **添加审计日志**: 记录成本数据的访问记录
2. **定期权限审查**: 每季度检查权限配置是否合理
3. **敏感数据加密**: 考虑对数据库中的成本字段加密存储
4. **权限测试**: 添加自动化测试验证权限控制
5. **文档更新**: 更新用户手册，说明权限要求

---

## 📄 涉及文件清单

### 需要修改的文件（共 6 个）

1. `components/inventory/inventory-statistics-cards.tsx` - 前端权限控制
2. `app/api/inventory/statistics/route.ts` - API 权限控制
3. `lib/types/inventory-statistics.ts` - 类型定义更新
4. `app/(dashboard)/inventory/inbound/[recordNumber]/page.tsx` - 入库详情权限
5. `app/(dashboard)/inventory/outbound/[recordNumber]/page.tsx` - 出库详情权限
6. `components/inventory/counts/count-items-table.tsx` - 盘点记录权限

### 已正确实现的文件（参考）

1. `components/inventory/InventoryGroupedTable.tsx` - 库存列表权限控制 ✅
2. `components/inventory/InventoryTableRow.tsx` - 库存行权限控制 ✅

---

**报告生成时间**: 2025-11-19
**检查人员**: AI Assistant
**下一步**: 请确认修复方案后开始实施

---

### 方案 A: 前端 + API 双重控制（推荐）

**优点**:

- ✅ 安全性最高（前后端双重验证）
- ✅ 用户体验好（无权限用户看不到敏感数据）
- ✅ API 数据不泄露

**缺点**:

- ⚠️ 需要修改多个文件
- ⚠️ 工作量较大

---

### 方案 B: 仅前端控制

**优点**:

- ✅ 实现简单快速
- ✅ 用户体验好

**缺点**:

- ❌ API 仍会返回成本数据（安全风险）
- ❌ 技术用户可通过开发者工具查看

---

### 方案 C: 仅 API 控制

**优点**:

- ✅ 安全性高（数据源头控制）
- ✅ 修改文件少

**缺点**:

- ❌ 用户体验差（前端仍显示成本字段，但值为空）
- ❌ UI 布局可能错乱

---
