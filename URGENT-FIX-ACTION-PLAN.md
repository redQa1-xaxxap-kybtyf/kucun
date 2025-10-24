# 紧急修复行动计划

**创建日期**: 2025-10-24  
**目标**: 在 1 周内修复所有 P0 级别问题，2 周内修复 P1 级别问题

---

## 🚨 P0 问题 1: TypeScript 编译错误修复

### 问题清单（18 处错误）

#### 1. 类型不匹配问题（6 处）

**文件**: `components/inventory/erp-inbound-records.tsx:76`
```typescript
// ❌ 错误
Type 'InboundRecord[]' is not assignable to type 'InboundRecordWithProduct[]'
  - batchSpecification.weight: number | undefined ≠ number | null

// ✅ 修复方案
// 统一 batchSpecification 类型定义
// lib/types/inbound.ts
export interface BatchSpecInfo {
  id: string;
  batchNumber: string;
  piecesPerUnit: number;
  weight: number | null;      // 统一使用 null
  thickness: number | null;   // 统一使用 null
}
```

**文件**: `lib/api/products-server.ts:159`
```typescript
// ❌ 错误
batchSpecs.weight: number | null | undefined ≠ number | undefined

// ✅ 修复方案
// 在数据转换时统一处理 null 和 undefined
batchSpecs: inventory.map(inv => ({
  batchNumber: inv.batchNumber,
  piecesPerUnit: inv.piecesPerUnit,
  quantity: inv.quantity,
  weight: inv.weight ?? undefined, // null 转为 undefined
}))
```

**文件**: `lib/api/return-orders-server.ts:155`
```typescript
// ❌ 错误
returnMode: string ≠ ReturnOrderMode

// ✅ 修复方案
// 添加类型断言或验证
returnMode: record.returnMode as ReturnOrderMode,
// 或者在查询时就限制类型
where: {
  returnMode: { in: ['refund', 'exchange', 'repair'] }
}
```

#### 2. 隐式 any 类型（4 处）

**文件**: `components/return-orders/erp-return-order-list.tsx:189`
```typescript
// ❌ 错误
setQueryParams(prev => ({ ...prev, page: 1 }))
// Parameter 'prev' implicitly has an 'any' type

// ✅ 修复方案
setQueryParams((prev: QueryParams) => ({ ...prev, page: 1 }))
```

**文件**: `lib/api/handlers/products-list.ts:416`
```typescript
// ❌ 错误
inventory.batches?.map(batch => ...)
// Parameter 'batch' implicitly has an 'any' type

// ✅ 修复方案
inventory.batches?.map((batch: { batchNumber: string; quantity: number }) => ...)
```

#### 3. 属性缺失问题（3 处）

**文件**: `components/sales-orders/.../useOrderItemsManager.ts:36`
```typescript
// ❌ 错误
Property 'weightPerPieceKg' is missing

// ✅ 修复方案
// 在创建订单项时添加缺失属性
{
  ...item,
  weightPerPieceKg: item.weight || 0, // 添加缺失属性
}
```

**文件**: `lib/api/customer-transformers.ts:137`
```typescript
// ❌ 错误
'childCustomers' does not exist in type 'CustomerDetailResult'

// ✅ 修复方案
// 在类型定义中添加 childCustomers
export interface CustomerDetailResult {
  // ... 其他属性
  childCustomers?: Customer[]; // 添加此属性
}
```

#### 4. 类型转换问题（3 处）

**文件**: `components/sales-orders/.../OrderItemsCard.tsx:216,243`
```typescript
// ❌ 错误
Argument of type 'string | 0' is not assignable to parameter of type 'number | undefined'

// ✅ 修复方案
// 确保传入的是 number 类型
const value = typeof inputValue === 'string' ? parseFloat(inputValue) : inputValue;
handleChange(value || undefined);
```

#### 5. 模块导入问题（2 处）

**文件**: `hooks/use-export-to-image.ts:3`
```typescript
// ❌ 错误
Cannot find module 'html2canvas'

// ✅ 修复方案
npm install --save-dev @types/html2canvas
// 或者添加类型声明
declare module 'html2canvas';
```

**文件**: `components/payments/payment-list.tsx:213`
```typescript
// ❌ 错误
Cannot find name 'format'. Did you mean 'FormData'?

// ✅ 修复方案
// 添加缺失的导入
import { format } from 'date-fns';
```

### 修复步骤

```bash
# 1. 创建修复分支
git checkout -b fix/typescript-errors

# 2. 逐个修复错误
# 按照上述方案修复每个文件

# 3. 验证修复
npm run type-check

# 4. 提交修复
git add .
git commit -m "fix(types): 修复所有 TypeScript 编译错误

- 统一 batchSpecification 类型定义 (null vs undefined)
- 添加缺失的类型属性 (weightPerPieceKg, childCustomers)
- 修复隐式 any 类型
- 添加缺失的模块类型声明
- 修复类型转换问题

Closes #[issue-number]"

# 5. 推送并创建 PR
git push origin fix/typescript-errors
```

---

## 🚨 P0 问题 2: 超长文件拆分

### 拆分策略: `sales-orders/[id]/page.tsx` (1714 行 → < 300 行)

#### 目标结构

```
app/(dashboard)/sales-orders/[id]/
├── page.tsx                          (< 100 行)
├── components/
│   ├── SalesOrderHeader.tsx          (订单头部信息)
│   ├── SalesOrderItems.tsx           (订单明细表格)
│   ├── SalesOrderPayments.tsx        (收款记录)
│   ├── SalesOrderActions.tsx         (操作按钮组)
│   ├── SalesOrderStatusBadge.tsx     (状态徽章)
│   ├── SalesOrderPrintDialog.tsx     (打印对话框)
│   └── SalesOrderEditDialog.tsx      (编辑对话框)
├── hooks/
│   ├── useSalesOrderDetail.ts        (数据查询)
│   ├── useSalesOrderActions.ts       (操作逻辑)
│   ├── useSalesOrderPrint.ts         (打印功能)
│   └── useSalesOrderEdit.ts          (编辑功能)
└── types.ts                          (本地类型定义)
```

#### 拆分步骤

**步骤 1: 提取类型定义** (30 分钟)

```typescript
// app/(dashboard)/sales-orders/[id]/types.ts
export interface PaymentRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  actualPaymentAmount: number;
  roundingAmount: number;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  remarks?: string;
  createdAt: string;
}

export interface SalesOrderDetail {
  // ... 所有接口定义
}
```

**步骤 2: 提取数据查询 Hook** (1 小时)

```typescript
// app/(dashboard)/sales-orders/[id]/hooks/useSalesOrderDetail.ts
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import type { SalesOrderDetail } from '../types';

export function useSalesOrderDetail(orderId: string) {
  return useQuery({
    queryKey: queryKeys.salesOrders.detail(orderId),
    queryFn: async (): Promise<SalesOrderDetail> => {
      const response = await fetch(`/api/sales-orders/${orderId}`);
      if (!response.ok) {
        throw new Error('获取订单详情失败');
      }
      const result = await response.json();
      return result.data;
    },
    enabled: !!orderId,
    staleTime: 2 * 60 * 1000,
  });
}
```

**步骤 3: 提取操作逻辑 Hook** (1 小时)

```typescript
// app/(dashboard)/sales-orders/[id]/hooks/useSalesOrderActions.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useToast } from '@/components/ui/use-toast';

export function useSalesOrderActions(orderId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const response = await fetch(`/api/sales-orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('更新状态失败');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.detail(orderId) });
      toast({ title: '状态更新成功' });
    },
  });

  return { updateStatus };
}
```

**步骤 4: 提取 UI 组件** (2 小时)

```typescript
// app/(dashboard)/sales-orders/[id]/components/SalesOrderHeader.tsx
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SalesOrderDetail } from '../types';

interface SalesOrderHeaderProps {
  order: SalesOrderDetail;
}

export function SalesOrderHeader({ order }: SalesOrderHeaderProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>订单详情</span>
          <Badge variant={getStatusVariant(order.status)}>
            {order.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 订单头部信息 */}
      </CardContent>
    </Card>
  );
}
```

**步骤 5: 重构主页面** (1 小时)

```typescript
// app/(dashboard)/sales-orders/[id]/page.tsx (< 100 行)
'use client';

import { useParams } from 'next/navigation';
import { ContentLoading } from '@/components/common/loading';
import { ErrorMessage } from '@/components/ui/error-message';
import { SalesOrderHeader } from './components/SalesOrderHeader';
import { SalesOrderItems } from './components/SalesOrderItems';
import { SalesOrderPayments } from './components/SalesOrderPayments';
import { SalesOrderActions } from './components/SalesOrderActions';
import { useSalesOrderDetail } from './hooks/useSalesOrderDetail';

export default function SalesOrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  
  const { data: order, isLoading, error } = useSalesOrderDetail(orderId);

  if (isLoading) return <ContentLoading />;
  if (error) return <ErrorMessage message={error.message} />;
  if (!order) return <ErrorMessage message="订单不存在" />;

  return (
    <div className="space-y-6">
      <SalesOrderHeader order={order} />
      <SalesOrderItems items={order.items} />
      <SalesOrderPayments payments={order.payments} />
      <SalesOrderActions orderId={orderId} />
    </div>
  );
}
```

### 拆分其他超长文件

使用相同策略拆分以下文件:

1. `customers/[id]/page.tsx` (810 行)
2. `finance/payables/page-client.tsx` (629 行)
3. `return-orders/[id]/page-client.tsx` (699 行)
4. `finance/payments/create/page.tsx` (609 行)

---

## 🟠 P1 问题: ESLint 警告批量修复

### 1. 批量替换 console 语句 (2 小时)

```bash
# 搜索所有 console 语句
grep -rn "console\." app/ components/ --include="*.tsx" --include="*.ts" > console-usage.txt

# 批量替换脚本
cat > scripts/replace-console.sh << 'EOF'
#!/bin/bash
# 替换 console.log 为 logger.info
find app components -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  's/console\.log(/logger.info(/g' {} +

# 替换 console.error 为 logger.error
find app components -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  's/console\.error(/logger.error(/g' {} +

# 替换 console.warn 为 logger.warn
find app components -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i \
  's/console\.warn(/logger.warn(/g' {} +
EOF

chmod +x scripts/replace-console.sh
./scripts/replace-console.sh
```

### 2. 修复 React Hooks 依赖 (1 天)

**常见问题模式**:

```typescript
// ❌ 错误: 缺少依赖
React.useEffect(() => {
  fetchData(filters);
}, []); // filters 未包含在依赖数组中

// ✅ 修复方案 1: 添加依赖
React.useEffect(() => {
  fetchData(filters);
}, [filters]);

// ✅ 修复方案 2: 使用 useCallback 稳定引用
const fetchDataCallback = React.useCallback(() => {
  fetchData(filters);
}, [filters]);

React.useEffect(() => {
  fetchDataCallback();
}, [fetchDataCallback]);
```

### 3. 移除未使用变量 (1 天)

```bash
# 自动修复
npm run lint:fix

# 手动检查剩余问题
npm run lint | grep "no-unused-vars" > unused-vars.txt

# 逐个修复或添加下划线前缀
const _unusedVar = getValue(); // 临时保留
```

---

## 📊 进度跟踪

### 第 1 周任务清单

- [ ] **Day 1**: 修复 TypeScript 编译错误 (18 处)
- [ ] **Day 2**: 拆分 `sales-orders/[id]/page.tsx`
- [ ] **Day 3**: 拆分 `customers/[id]/page.tsx`
- [ ] **Day 4**: 拆分其他超长文件
- [ ] **Day 5**: 代码审查和测试

### 第 2 周任务清单

- [ ] **Day 1**: 批量替换 console 语句
- [ ] **Day 2**: 修复 React Hooks 依赖
- [ ] **Day 3**: 移除未使用变量
- [ ] **Day 4**: 修复 any 类型使用
- [ ] **Day 5**: 最终验证和部署

---

## ✅ 验证清单

### 每日验证

```bash
# 1. TypeScript 检查
npm run type-check

# 2. ESLint 检查
npm run lint

# 3. 构建检查
npm run build

# 4. 测试检查
npm run test
```

### 提交前验证

```bash
# 运行完整检查
npm run check-all

# 如果通过,提交代码
git add .
git commit -m "fix: [描述修复内容]"
git push
```

---

**创建时间**: 2025-10-24  
**预计完成时间**: 2025-11-07 (2 周)

