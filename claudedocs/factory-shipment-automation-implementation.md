# 厂家发货自动追踪功能实施总结

## 📋 实施概述

基于用户需求,实现了厂家发货订单的自动状态追踪系统,通过船运公司信息自动查询货物运输状态。

## ✅ 已完成的核心任务

### 1. 状态流转逻辑优化

**文件**: `lib/api/handlers/factory-shipment-status.ts`

**关键变更**:

- 更新状态流转规则,移除用户手动操作运输中和到港的权限
- 用户手动操作只能到"已发货"状态
- "运输中"和"到港"状态由系统自动判定

```typescript
// 手动操作流程: 草稿 → 已确认 → 待发货 → 已发货
// 系统自动流程: 已发货 → 运输中 → 到港 (通过运输查询自动判定)

export const validStatusTransitions: Record<string, string[]> = {
  [FACTORY_SHIPMENT_STATUS.DRAFT]: [
    FACTORY_SHIPMENT_STATUS.CONFIRMED,
    FACTORY_SHIPMENT_STATUS.CANCELLED,
  ],
  [FACTORY_SHIPMENT_STATUS.CONFIRMED]: [
    FACTORY_SHIPMENT_STATUS.PENDING_SHIPMENT,
    FACTORY_SHIPMENT_STATUS.CANCELLED,
  ],
  [FACTORY_SHIPMENT_STATUS.PENDING_SHIPMENT]: [
    FACTORY_SHIPMENT_STATUS.SHIPPED,
    FACTORY_SHIPMENT_STATUS.CANCELLED,
  ],
  // 重要: 已发货后,用户不能手动变更状态
  [FACTORY_SHIPMENT_STATUS.SHIPPED]: [],
  [FACTORY_SHIPMENT_STATUS.IN_TRANSIT]: [],
  [FACTORY_SHIPMENT_STATUS.ARRIVED]: [],
  [FACTORY_SHIPMENT_STATUS.CANCELLED]: [],
};
```

**应用的设计原则**:

- **单一职责原则 (SRP)**: 状态流转规则与业务逻辑分离
- **开闭原则 (OCP)**: 通过`isSystemUpdate`标志扩展功能,无需修改现有代码
- **简单至上 (KISS)**: 清晰的状态流转规则,易于理解和维护

### 2. 状态前置条件验证

**新增函数**: `validateStatusPrerequisites`

**验证规则**:

```typescript
export function validateStatusPrerequisites(
  newStatus: string,
  order: {
    items?: Array<{ id: string }>;
    totalAmount?: number;
    containerNumber?: string | null;
    shippingCompany?: string | null;
  }
): { valid: boolean; message: string };
```

**验证逻辑**:

1. **已确认状态**: 必须有商品明细和金额
2. **已发货状态**: 必须填写集装箱号和船运公司

**应用的设计原则**:

- **防御性编程**: 在状态变更前进行完整验证
- **明确的错误提示**: 帮助用户理解为什么操作失败

### 3. 确认发货对话框优化

**文件**: `components/factory-shipments/confirm-shipment-dialog.tsx`

**新增字段**:

1. **船运公司** (必填) - 用于自动查询运输状态
2. **预计到达时间** (可选)
3. **发货时间** (必填,默认当前时间)

**表单验证**:

```typescript
const confirmShipmentSchema = z.object({
  containerNumber: z
    .string()
    .min(1, '集装箱号码不能为空')
    .max(50, '集装箱号码不能超过50个字符'),
  shippingCompany: z
    .string()
    .min(1, '船运公司不能为空,用于自动查询运输状态')
    .max(100, '船运公司名称不能超过100个字符'),
  estimatedArrival: z.date().optional(),
  shipmentDate: z.date().default(() => new Date()),
});
```

**UI改进**:

- 添加船运公司输入框,标记为必填
- 添加说明文字:"系统将使用船运公司信息自动查询货物运输状态"
- 添加预计到达时间选择器(DateTimePicker)
- 更新对话框描述,明确需要填写的信息

**应用的设计原则**:

- **用户体验优先**: 清晰的标签和说明,帮助用户理解为什么需要这些信息
- **渐进式表单**: 必填字段优先,可选字段后置

### 4. 运输追踪服务优化

**文件**: `lib/services/shipping-tracking-service.ts`

**关键更新**:

- 使用`isSystemUpdate = true`标志调用状态更新
- 跳过用户权限验证,允许系统自动更新状态

```typescript
// 状态变更: shipped → in_transit
await updateFactoryShipmentStatus(
  orderId,
  FACTORY_SHIPMENT_STATUS.IN_TRANSIT,
  order.status as FactoryShipmentStatus,
  {
    estimatedArrival: trackingData.estimatedArrival
      ? new Date(trackingData.estimatedArrival)
      : undefined,
  },
  true // isSystemUpdate = true
);

// 状态变更: in_transit → arrived
await updateFactoryShipmentStatus(
  orderId,
  FACTORY_SHIPMENT_STATUS.ARRIVED,
  order.status as FactoryShipmentStatus,
  {
    arrivalDate: trackingData.updateTime
      ? new Date(trackingData.updateTime)
      : new Date(),
  },
  true // isSystemUpdate = true
);
```

**应用的设计原则**:

- **依赖倒置原则 (DIP)**: 依赖抽象的状态更新接口,而非具体实现
- **关注点分离**: 系统自动更新与用户手动操作逻辑分离

### 5. 数据验证层优化

**文件**: `lib/validations/factory-shipment.ts`

**新增字段验证**:

```typescript
// 更新订单schema
shippingCompany: z
  .string()
  .max(100, '船运公司名称不能超过100个字符')
  .optional()
  .or(z.literal('')),
estimatedArrival: z.date().optional(),

// 状态更新schema增加验证规则
.refine(
  data => {
    // 如果状态为已发货，船运公司必填
    if (
      data.status === FACTORY_SHIPMENT_STATUS.SHIPPED &&
      (!data.shippingCompany || data.shippingCompany.trim() === '')
    ) {
      return false;
    }
    return true;
  },
  {
    message: '确认发货时必须填写船运公司信息(用于自动查询运输状态)',
    path: ['shippingCompany'],
  }
)
```

**应用的设计原则**:

- **输入验证**: 在数据进入系统前进行完整验证
- **类型安全**: 使用Zod确保TypeScript类型和运行时验证一致

### 6. API路由更新

**文件**: `app/api/factory-shipments/[id]/route.ts`

**更新内容**:

- 解析请求体中的新字段:`shippingCompany`, `estimatedArrival`
- 传递新字段到状态更新函数
- 支持幂等性包装器处理新字段

**应用的设计原则**:

- **一致性**: API层、验证层、服务层保持字段一致性
- **幂等性保护**: 所有状态变更操作都有幂等性保护

## 📊 架构变更总结

### 状态流转架构

```
┌─────────────────────────────────────────────────────────────┐
│                    用户手动操作区域                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  草稿 → 已确认 → 待发货 → 已发货                            │
│                            ↓                                 │
│                    (必填:集装箱号+船运公司)                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    系统自动操作区域                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  已发货 → [运输查询API] → 运输中 → [运输查询API] → 到港     │
│           (每2-4小时)              (每12小时)                │
│                                                              │
│  自动更新:                                                   │
│  - 预计到达时间(estimatedArrival)                           │
│  - 到港时间(arrivalDate)                                    │
│  - 客户货交付状态(delivered)                                │
│  - 应收账款记录(自动创建)                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 数据流架构

```
用户确认发货
    ↓
填写表单(集装箱号+船运公司+预计到达)
    ↓
表单验证(Zod Schema)
    ↓
API验证(updateFactoryShipmentOrderSchema)
    ↓
状态前置条件验证(validateStatusPrerequisites)
    ↓
状态流转验证(validateStatusTransition)
    ↓
更新订单状态(updateFactoryShipmentStatus)
    ↓
定时任务开始
    ↓
运输状态查询(queryShippingTracking)
    ↓
系统自动更新(isSystemUpdate = true)
```

## 🔧 实施的核心设计原则

### SOLID原则应用

1. **单一职责原则 (SRP)**
   - 状态流转规则独立函数
   - 前置条件验证独立函数
   - 运输追踪服务专注于查询和更新

2. **开放/封闭原则 (OCP)**
   - 通过`isSystemUpdate`标志扩展功能
   - 不修改现有用户操作逻辑

3. **依赖倒置原则 (DIP)**
   - 运输追踪服务依赖抽象的状态更新接口
   - 不直接操作数据库,通过服务层

### 其他原则

1. **简单至上 (KISS)**
   - 清晰的状态流转规则
   - 简单的用户界面

2. **杜绝重复 (DRY)**
   - 状态更新逻辑复用
   - 验证规则集中管理

3. **防御性编程**
   - 多层验证(表单→API→业务逻辑)
   - 清晰的错误提示

## 📝 待实施功能

### 1. 运输查询API集成

**当前状态**: 服务层已完成,等待实际API接入

**需要提供的信息**:

```typescript
interface ShippingQueryAPI {
  // 接口地址
  endpoint: string; // 例如: '/api/settings/shipping-tracking/query'

  // 请求参数
  requestParams: {
    site: string; // 船运公司名称
    trackingNumber: string; // 集装箱号
  };

  // 响应格式
  response: {
    queryTime: string; // 查询时间
    status: string; // 状态: in_transit | arrived
    destination?: string; // 目的地
    estimatedArrival?: string; // 预到时间
    updateTime: string; // 更新时间
    result?: string; // 查询结果
  };
}
```

**实施步骤**:

1. 获取实际的运输查询API接口信息
2. 更新`queryShippingTracking`函数中的API调用
3. 测试API集成
4. 配置定时任务(cron job或webhook)

### 2. 定时任务配置

**选项1: Node-cron**

```typescript
// lib/cron/shipping-tracking-cron.ts
import { CronJob } from 'cron';
import { updateAllShippingStatuses } from '@/lib/services/shipping-tracking-service';

export const shippingTrackingCron = new CronJob(
  '0 */4 * * *', // 每4小时
  async () => {
    await updateAllShippingStatuses();
  },
  null,
  true,
  'Asia/Shanghai'
);
```

**选项2: Webhook接口**

```typescript
// app/api/cron/shipping-tracking/route.ts
export async function GET() {
  try {
    const result = await updateAllShippingStatuses();
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
```

### 3. UI优化

**建议移除的按钮**:

- "标记为运输中"按钮(因为是自动的)
- "标记为到港"按钮(因为是自动的)

**建议添加的功能**:

- 显示最后查询时间
- 显示查询状态(成功/失败)
- 手动刷新运输状态按钮(订单详情页)

## 🔒 数据库迁移

**必须执行的步骤**:

1. 停止应用程序
2. 运行Prisma生成客户端:
   ```bash
   npx prisma generate
   ```
3. 推送数据库变更:
   ```bash
   npx prisma db push
   ```
4. 重启应用程序

**新增的数据库字段**:

- `shipping_company` (String?) - 船运公司
- `estimated_arrival` (DateTime?) - 预计到达时间
- `last_shipping_query_at` (DateTime?) - 最后查询时间(待添加)
- `shipping_query_status` (String?) - 查询状态(待添加)
- `shipping_query_error` (String?) - 查询错误(待添加)

## 📈 预期收益

### 业务收益

1. **自动化**: 减少人工状态更新工作量
2. **准确性**: 基于实际运输数据更新状态
3. **及时性**: 定时查询确保状态实时更新
4. **可追溯**: 记录查询历史和错误

### 技术收益

1. **可维护性**: 清晰的状态流转规则
2. **可扩展性**: 易于添加新的自动化规则
3. **类型安全**: 完整的TypeScript类型定义
4. **错误处理**: 完善的错误日志和提示

## 🎯 下一步行动建议

1. **立即执行**: 数据库迁移(`npx prisma generate && npx prisma db push`)
2. **短期(1周内)**:
   - 提供运输查询API接口信息
   - 实施API集成
   - 测试自动状态更新
3. **中期(2周内)**:
   - 配置定时任务
   - 优化UI显示
   - 添加手动刷新功能
4. **长期(1个月内)**:
   - 监控系统运行状态
   - 优化查询频率
   - 收集用户反馈
