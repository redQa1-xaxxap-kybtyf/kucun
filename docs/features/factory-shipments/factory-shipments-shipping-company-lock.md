# 厂家发货订单 - 船运公司锁定规则

> 实现物流查询后锁定船运公司，防止修改导致数据不一致

## 📋 业务需求

**核心规则：** 一旦订单已经进行过物流查询（手动查询或自动查询），就不允许再修改船运公司名称。

**业务原因：**

1. 物流查询是基于船运公司名称进行的
2. 查询后修改船运公司会导致查询结果与实际物流信息不匹配
3. 保证数据一致性和查询结果的准确性
4. 避免用户误操作导致物流信息混乱

## ✅ 实现方案

### 1. 判断条件

使用 `lastShippingQueryAt` 字段判断订单是否已查询过：

```typescript
// 如果 lastShippingQueryAt 不为空（有值），说明已经查询过
const isLocked = Boolean(order.lastShippingQueryAt);
```

**字段说明：**

- **字段名：** `lastShippingQueryAt`
- **类型：** `DateTime?`（可选）
- **用途：** 记录最后一次物流查询时间（手动或自动）
- **更新时机：**
  - 用户点击"手动查询"按钮时
  - 自动查询调度器执行查询时

### 2. 前端限制

#### 2.1 列表页面

**文件：** `components/factory-shipments/factory-shipment-order-list-view.tsx`

**实现：**

1. **点击拦截：** 点击船运公司单元格时，检查是否已查询

   ```typescript
   const handleShippingCompanyClick = React.useCallback(
     (event: React.MouseEvent) => {
       event.stopPropagation();

       // 业务规则：如果订单已经进行过物流查询，不允许修改船运公司
       if (order.lastShippingQueryAt) {
         toast({
           title: '无法修改船运公司',
           description:
             '订单已进行物流查询，不允许修改船运公司。如需修改，请联系管理员。',
           variant: 'destructive',
         });
         return;
       }

       setIsShippingCompanyDialogOpen(true);
     },
     [order.lastShippingQueryAt, toast]
   );
   ```

2. **视觉提示：** 已查询的订单显示"已锁定"标签

   ```typescript
   <TableCell
     className={`px-4 py-3 text-[hsl(var(--color-text-secondary))] ${
       order.lastShippingQueryAt
         ? 'cursor-not-allowed opacity-60'
         : 'cursor-pointer'
     }`}
     title={
       order.lastShippingQueryAt
         ? '已查询，不可修改'
         : order.shippingCompany || '点击输入'
     }
   >
     {/* 已查询锁定提示 */}
     {order.lastShippingQueryAt && (
       <Badge variant="outline" className="border-gray-400 text-xs text-gray-600">
         已锁定
       </Badge>
     )}
   </TableCell>
   ```

3. **隐藏编辑图标：** 已查询的订单不显示编辑图标
   ```typescript
   {!order.lastShippingQueryAt && (
     <Edit className="h-3 w-3 flex-shrink-0 opacity-60 hover:opacity-100" />
   )}
   ```

#### 2.2 编辑对话框

**文件：** `components/factory-shipments/shipping-company-edit-dialog.tsx`

**实现：**

1. **字段禁用：** 已查询的订单，输入框禁用

   ```typescript
   <Input
     {...field}
     placeholder="请输入船公司名称，例如：HE YUAN SHUN 98"
     disabled={disabled || isLocked}
   />
   ```

2. **错误提示：** 显示红色警告信息

   ```typescript
   <FormDescription>
     {isLocked ? (
       <span className="text-[hsl(var(--color-error))]">
         ⚠️ 订单已进行物流查询，不允许修改船运公司。如需修改，请联系管理员。
       </span>
     ) : (
       '输入负责运输的船公司名称，用于运输追踪和查询'
     )}
   </FormDescription>
   ```

3. **按钮禁用：** 保存按钮禁用
   ```typescript
   <Button type="submit" disabled={isPending || isLocked}>
     {isPending ? '更新中...' : '保存'}
   </Button>
   ```

### 3. 后端验证

**文件：** `app/api/factory-shipments/[id]/shipping-company/route.ts`

**实现：**

```typescript
// 检查订单是否存在
const existingOrder = await prisma.factoryShipmentOrder.findFirst({
  where: { id, userId },
  select: {
    id: true,
    orderNumber: true,
    shippingCompany: true,
    status: true,
    lastShippingQueryAt: true, // ⭐ 新增字段
  },
});

if (!existingOrder) {
  return NextResponse.json(
    { success: false, message: '订单不存在或无权限访问' },
    { status: 404 }
  );
}

// 业务规则：如果订单已经进行过物流查询，不允许修改船运公司
// 原因：物流查询是基于船运公司名称进行的，修改后会导致查询结果与实际物流信息不匹配
if (existingOrder.lastShippingQueryAt) {
  return NextResponse.json(
    {
      success: false,
      message: '订单已进行物流查询，不允许修改船运公司',
      details: '如需修改，请联系管理员重置查询状态，或创建新的发货订单',
    },
    { status: 400 }
  );
}
```

**错误响应：**

```json
{
  "success": false,
  "message": "订单已进行物流查询，不允许修改船运公司",
  "details": "如需修改，请联系管理员重置查询状态，或创建新的发货订单"
}
```

## 🎯 用户体验流程

### 场景 1：未查询的订单（可编辑）

1. **列表页面：**
   - 船运公司单元格显示编辑图标
   - 鼠标悬停时，光标变为手型
   - 点击后打开编辑对话框

2. **编辑对话框：**
   - 输入框可编辑
   - 显示正常提示："输入负责运输的船公司名称，用于运输追踪和查询"
   - 保存按钮可点击

3. **保存成功：**
   - 显示成功提示
   - 列表自动刷新，显示新的船运公司名称

### 场景 2：已查询的订单（已锁定）

1. **列表页面：**
   - 船运公司单元格显示"已锁定"标签
   - 不显示编辑图标
   - 鼠标悬停时，光标变为禁止图标
   - 单元格半透明显示（`opacity-60`）
   - 提示文本："已查询，不可修改"

2. **点击尝试编辑：**
   - 显示错误提示 Toast：
     - 标题："无法修改船运公司"
     - 描述："订单已进行物流查询，不允许修改船运公司。如需修改，请联系管理员。"
   - 不打开编辑对话框

3. **如果对话框已打开（边界情况）：**
   - 输入框禁用，无法编辑
   - 显示红色警告："⚠️ 订单已进行物流查询，不允许修改船运公司。如需修改，请联系管理员。"
   - 保存按钮禁用

4. **如果绕过前端验证（API 调用）：**
   - 后端返回 400 错误
   - 错误信息："订单已进行物流查询，不允许修改船运公司"

## 📊 数据流程图

```
订单创建
  ↓
填写船运公司 ✅ 可编辑
  ↓
确认发货
  ↓
手动查询 / 自动查询
  ↓
lastShippingQueryAt 被设置 ⭐
  ↓
船运公司锁定 🔒 不可编辑
  ↓
查询成功 → estimatedArrival 被设置
查询失败 → shippingQueryError 被设置
  ↓
船运公司仍然锁定 🔒
```

## 🔍 技术实现细节

### 前端类型定义

```typescript
// components/factory-shipments/shipping-company-edit-dialog.tsx
interface ShippingCompanyEditDialogProps {
  order: {
    id: string;
    orderNumber: string;
    shippingCompany: string | null;
    lastShippingQueryAt?: Date | string | null; // ⭐ 新增字段
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}
```

### 锁定状态判断

```typescript
// 判断订单是否已查询（已锁定）
const isLocked = Boolean(order.lastShippingQueryAt);
```

### 条件渲染

```typescript
// 根据锁定状态显示不同的 UI
{isLocked ? (
  <span className="text-[hsl(var(--color-error))]">
    ⚠️ 订单已进行物流查询，不允许修改船运公司。如需修改，请联系管理员。
  </span>
) : (
  '输入负责运输的船公司名称，用于运输追踪和查询'
)}
```

## 🚨 特殊情况处理

### 1. 管理员重置功能（未实现）

如果确实需要修改已查询的订单，可以考虑添加管理员权限功能：

**实现思路：**

1. 添加"重置查询状态"按钮（仅管理员可见）
2. 重置时清空以下字段：
   - `lastShippingQueryAt` → `null`
   - `estimatedArrival` → `null`
   - `shippingQueryStatus` → `null`
   - `shippingQueryError` → `null`
3. 记录操作日志，包含操作人、操作时间、原因

**API 路由：**

```typescript
// POST /api/factory-shipments/[id]/reset-query-status
// 仅管理员可访问
```

### 2. 录入错误处理

**场景：** 用户填写错误的船运公司，点击查询后才发现

**解决方案：**

1. **预防措施：** 在确认发货前，提示用户仔细核对船运公司名称
2. **补救措施：** 联系管理员重置查询状态
3. **最佳实践：** 建立船运公司名称标准库，提供自动补全功能

### 3. 自动查询与手动查询

**问题：** 自动查询也会设置 `lastShippingQueryAt`，导致用户无法修改

**解决方案：** 这是预期行为

- 自动查询和手动查询都是基于船运公司名称的
- 无论哪种查询，都应该锁定船运公司
- 如果自动查询失败，用户可以在查询前修改船运公司

## 📝 相关文件

### 前端文件

- `components/factory-shipments/factory-shipment-order-list-view.tsx` - 列表页面
- `components/factory-shipments/shipping-company-edit-dialog.tsx` - 编辑对话框

### 后端文件

- `app/api/factory-shipments/[id]/shipping-company/route.ts` - 更新 API

### 数据库模型

- `prisma/schema.prisma` - `FactoryShipmentOrder` 模型
  - `lastShippingQueryAt` 字段

### 类型定义

- `lib/types/factory-shipment.ts` - TypeScript 类型定义

## 🎯 预期效果

**修改前：**

- ❌ 查询后仍可修改船运公司
- ❌ 可能导致查询结果与实际物流信息不匹配
- ❌ 数据一致性无法保证

**修改后：**

- ✅ 查询后自动锁定船运公司
- ✅ 前端显示"已锁定"标签和禁用状态
- ✅ 后端 API 验证并拒绝修改请求
- ✅ 提供清晰的错误提示信息
- ✅ 保证数据一致性和查询结果准确性

---

**实现时间：** 2025-11-10  
**实现负责人：** Augment Agent  
**验证状态：** ✅ ESLint 通过（1 个警告，0 个错误）
