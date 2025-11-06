# 厂家发货最终业务流程设计

## 📋 确认的业务规则

### 1. 状态流转逻辑

```
手动操作:
草稿 → 已确认 → 待发货 → 已发货

系统自动:
已发货 → [自动查询] → 运输中 → [自动查询] → 到港
```

### 2. 核心规则

| 规则         | 说明                                      |
| ------------ | ----------------------------------------- |
| 草稿→已确认  | 业务员自己确认,不需要主管审核             |
| 集装箱号变更 | 允许直接更新,不需要记录历史               |
| 船运公司     | **唯一查询方式**,必须填写才能查询运输状态 |
| 运输中状态   | **系统自动判定**,通过运输查询功能         |
| 到港状态     | **系统自动判定**,通过运输查询功能         |
| 到港时间     | **系统自动填写**,从查询结果获取           |

---

## 🎯 改进后的状态流程

### 用户手动操作的状态

#### 1. 草稿 (draft)

```typescript
触发: 订单创建
操作人: 业务员
必填字段: 客户、产品明细
可选字段: 集装箱号(可预填)、船运公司(可预填)
```

#### 2. 已确认 (confirmed)

```typescript
触发: 业务员点击"确认订单"
操作人: 业务员(无需主管审核)
业务含义: 订单信息确认完整,可以安排发货
前置条件:
  - 产品明细不为空
  - 订单金额 > 0
```

#### 3. 待发货 (pending_shipment)

```typescript
触发: 业务员点击"安排发货"
操作人: 业务员/采购
业务含义: 已联系工厂,等待装柜发货
可选字段: 预计发货时间
```

#### 4. 已发货 (shipped)

```typescript
触发: 业务员点击"确认发货"
操作人: 业务员/采购
业务含义: 货物已装柜离厂,开始运输
必填字段:
  - 集装箱号 (containerNumber) *
  - 船运公司 (shippingCompany) * 【关键!用于后续自动查询】
  - 发货时间 (shipmentDate)
可选字段:
  - 预计到达时间 (estimatedArrival)

重要: 船运公司必填,否则无法自动查询运输状态!
```

### 系统自动判定的状态

#### 5. 运输中 (in_transit)

```typescript
触发: 系统自动判定
判定方式:
  - 通过"运输查询"功能
  - 使用船运公司名称查询
  - 货物状态 = "在途" → 自动更新为 in_transit

查询频率建议:
  - 已发货状态: 每4小时查询一次
  - 运输中状态: 每12小时查询一次

系统操作:
  - 自动更新 status = 'in_transit'
  - 更新查询时间戳
  - 如果有预计到达时间,自动更新 estimatedArrival
```

#### 6. 到港 (arrived)

```typescript
触发: 系统自动判定
判定方式:
  - 通过"运输查询"功能
  - 使用船运公司名称查询
  - 货物状态 = "已到港" → 自动更新为 arrived

系统操作:
  - 自动更新 status = 'arrived'
  - 自动更新 arrivalDate = 查询到的到港时间
  - 自动标记客户货为"已交付"
  - 自动创建应收账款记录
```

---

## 🔧 技术实现方案

### 1. 数据库Schema更新

```typescript
// prisma/schema.prisma

model FactoryShipmentOrder {
  // ... 现有字段

  shippingCompany  String?   @map("shipping_company")   // 船运公司(已发货时必填)
  estimatedArrival DateTime? @map("estimated_arrival")  // 预计到达时间

  // 新增: 运输查询相关字段
  lastShippingQueryAt DateTime? @map("last_shipping_query_at") // 最后查询时间
  shippingQueryStatus String?   @map("shipping_query_status")   // 查询状态: success/failed/pending
  shippingQueryError  String?   @db.Text @map("shipping_query_error") // 查询错误信息
}
```

### 2. 状态流转规则更新

```typescript
// lib/api/handlers/factory-shipment-status.ts

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

  // 重要变更: 已发货后,用户不能手动变更状态
  // 运输中和到港由系统自动判定
  [FACTORY_SHIPMENT_STATUS.SHIPPED]: [
    // 用户不能手动操作,只能由系统自动更新
    // FACTORY_SHIPMENT_STATUS.IN_TRANSIT, // 系统自动
  ],
  [FACTORY_SHIPMENT_STATUS.IN_TRANSIT]: [
    // 用户不能手动操作,只能由系统自动更新
    // FACTORY_SHIPMENT_STATUS.ARRIVED, // 系统自动
  ],

  [FACTORY_SHIPMENT_STATUS.ARRIVED]: [],
  [FACTORY_SHIPMENT_STATUS.CANCELLED]: [],
};

// 新增: 状态前置条件验证
export function validateStatusPrerequisites(
  newStatus: string,
  order: {
    items?: Array<{ id: string }>;
    totalAmount?: number;
    containerNumber?: string | null;
    shippingCompany?: string | null;
  }
): { valid: boolean; message: string } {
  switch (newStatus) {
    case FACTORY_SHIPMENT_STATUS.CONFIRMED:
      if (!order.items || order.items.length === 0) {
        return { valid: false, message: '必须有产品明细才能确认订单' };
      }
      if (!order.totalAmount || order.totalAmount <= 0) {
        return { valid: false, message: '订单金额必须大于0才能确认' };
      }
      return { valid: true, message: '' };

    case FACTORY_SHIPMENT_STATUS.SHIPPED:
      if (!order.containerNumber?.trim()) {
        return { valid: false, message: '必须填写集装箱号才能标记为已发货' };
      }
      if (!order.shippingCompany?.trim()) {
        return {
          valid: false,
          message: '必须填写船运公司信息才能标记为已发货(用于自动查询运输状态)',
        };
      }
      return { valid: true, message: '' };

    default:
      return { valid: true, message: '' };
  }
}
```

### 3. 确认发货对话框优化

```typescript
// components/factory-shipments/confirm-shipment-dialog.tsx

const confirmShipmentSchema = z.object({
  containerNumber: z
    .string()
    .min(1, '集装箱号码不能为空')
    .max(50, '集装箱号码不能超过50个字符'),

  // 新增: 船运公司必填
  shippingCompany: z
    .string()
    .min(1, '船运公司不能为空,用于自动查询运输状态')
    .max(100, '船运公司名称不能超过100个字符'),

  // 新增: 预计到达时间(可选)
  estimatedArrival: z.date().optional(),

  shipmentDate: z.date().default(() => new Date()),
});

// UI更新
<Form>
  <FormField name="containerNumber">
    <FormLabel>
      集装箱号码 <span className="text-red-500">*</span>
    </FormLabel>
    <Input placeholder="请输入集装箱号码" />
  </FormField>

  <FormField name="shippingCompany">
    <FormLabel>
      船运公司 <span className="text-red-500">*</span>
    </FormLabel>
    <Input placeholder="请输入船运公司名称" />
    <FormDescription>
      系统将使用船运公司信息自动查询货物运输状态
    </FormDescription>
  </FormField>

  <FormField name="estimatedArrival">
    <FormLabel>预计到达时间</FormLabel>
    <DateTimePicker />
    <FormDescription>
      可选,如有预计时间请填写
    </FormDescription>
  </FormField>

  <FormField name="shipmentDate">
    <FormLabel>发货时间</FormLabel>
    <DateTimePicker defaultValue={new Date()} />
  </FormField>
</Form>
```

### 4. 运输状态查询服务

```typescript
// lib/services/shipping-tracking-service.ts

export interface ShippingTrackingResult {
  status: 'in_transit' | 'arrived' | 'unknown';
  arrivedAt?: Date;
  estimatedArrival?: Date;
  currentLocation?: string;
  lastUpdate: Date;
}

/**
 * 查询运输状态
 * 通过船运公司名称查询货物状态
 */
export async function queryShippingStatus(
  shippingCompany: string,
  containerNumber: string
): Promise<ShippingTrackingResult> {
  // TODO: 对接您的"运输查询"功能
  // 这里需要调用系统设置中的运输查询接口

  try {
    // 示例: 调用运输查询API
    const response = await fetch('/api/shipping-tracking/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shippingCompany,
        containerNumber,
      }),
    });

    const data = await response.json();

    return {
      status: data.status, // 'in_transit' | 'arrived'
      arrivedAt: data.arrivedAt ? new Date(data.arrivedAt) : undefined,
      estimatedArrival: data.estimatedArrival
        ? new Date(data.estimatedArrival)
        : undefined,
      currentLocation: data.currentLocation,
      lastUpdate: new Date(),
    };
  } catch (error) {
    logger.error('shipping-tracking', '查询运输状态失败', error);
    return {
      status: 'unknown',
      lastUpdate: new Date(),
    };
  }
}

/**
 * 自动更新订单运输状态
 * 定时任务调用
 */
export async function updateShippingStatusAutomatically() {
  // 查询所有"已发货"和"运输中"的订单
  const orders = await prisma.factoryShipmentOrder.findMany({
    where: {
      status: {
        in: [
          FACTORY_SHIPMENT_STATUS.SHIPPED,
          FACTORY_SHIPMENT_STATUS.IN_TRANSIT,
        ],
      },
      shippingCompany: {
        not: null,
      },
    },
    select: {
      id: true,
      orderNumber: true,
      containerNumber: true,
      shippingCompany: true,
      status: true,
      lastShippingQueryAt: true,
    },
  });

  for (const order of orders) {
    try {
      // 查询运输状态
      const trackingResult = await queryShippingStatus(
        order.shippingCompany!,
        order.containerNumber || ''
      );

      // 根据查询结果更新订单状态
      if (
        trackingResult.status === 'in_transit' &&
        order.status === FACTORY_SHIPMENT_STATUS.SHIPPED
      ) {
        await prisma.factoryShipmentOrder.update({
          where: { id: order.id },
          data: {
            status: FACTORY_SHIPMENT_STATUS.IN_TRANSIT,
            estimatedArrival: trackingResult.estimatedArrival,
            lastShippingQueryAt: new Date(),
            shippingQueryStatus: 'success',
          },
        });

        logger.info(
          'shipping-tracking',
          `订单 ${order.orderNumber} 自动更新为运输中`
        );
      }

      if (trackingResult.status === 'arrived') {
        // 调用现有的状态更新逻辑(会自动创建应收账款)
        await updateFactoryShipmentStatus(
          order.id,
          FACTORY_SHIPMENT_STATUS.ARRIVED,
          order.status,
          {
            arrivalDate: trackingResult.arrivedAt || new Date(),
          }
        );

        logger.info(
          'shipping-tracking',
          `订单 ${order.orderNumber} 自动更新为到港`
        );
      }

      // 更新查询时间
      await prisma.factoryShipmentOrder.update({
        where: { id: order.id },
        data: {
          lastShippingQueryAt: new Date(),
          shippingQueryStatus:
            trackingResult.status === 'unknown' ? 'failed' : 'success',
        },
      });
    } catch (error) {
      logger.error(
        'shipping-tracking',
        `更新订单 ${order.orderNumber} 失败`,
        error
      );

      await prisma.factoryShipmentOrder.update({
        where: { id: order.id },
        data: {
          lastShippingQueryAt: new Date(),
          shippingQueryStatus: 'failed',
          shippingQueryError:
            error instanceof Error ? error.message : '未知错误',
        },
      });
    }
  }
}
```

### 5. 定时任务配置

```typescript
// lib/cron/shipping-tracking-cron.ts

import { CronJob } from 'cron';
import { updateShippingStatusAutomatically } from '@/lib/services/shipping-tracking-service';

/**
 * 运输状态自动查询定时任务
 * 每4小时执行一次
 */
export const shippingTrackingCron = new CronJob(
  '0 */4 * * *', // 每4小时
  async () => {
    logger.info('cron', '开始执行运输状态自动查询');
    await updateShippingStatusAutomatically();
    logger.info('cron', '运输状态自动查询完成');
  },
  null,
  true,
  'Asia/Shanghai'
);

// 或者使用Next.js API路由作为webhook
// app/api/cron/shipping-tracking/route.ts
export async function GET() {
  try {
    await updateShippingStatusAutomatically();
    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
```

---

## 📊 最终状态流转图

```
┌─────────┐
│  草稿    │ (业务员创建)
└────┬────┘
     │ 业务员确认
     ▼
┌─────────┐
│ 已确认   │ (无需主管审核)
└────┬────┘
     │ 业务员安排发货
     ▼
┌─────────┐
│ 待发货   │
└────┬────┘
     │ 业务员确认发货(必填: 集装箱号 + 船运公司)
     ▼
┌─────────┐
│ 已发货   │ ← 用户手动操作到此为止
└────┬────┘
     │
     │ ═══════════════════════════════
     │ 以下由系统自动判定(通过运输查询)
     │ ═══════════════════════════════
     │
     │ 系统查询: 货物在途
     ▼
┌─────────┐
│ 运输中   │ (系统自动更新)
└────┬────┘
     │ 系统查询: 货物到港
     ▼
┌─────────┐
│  到港    │ (系统自动更新 + 创建应收账款)
└─────────┘
```

---

## ✅ 实施清单

### 数据库层

- [ ] 添加 `lastShippingQueryAt` 字段
- [ ] 添加 `shippingQueryStatus` 字段
- [ ] 添加 `shippingQueryError` 字段

### 业务逻辑层

- [ ] 更新状态流转规则(移除用户手动操作 shipped→in_transit)
- [ ] 添加状态前置条件验证(shipped必填集装箱号+船运公司)
- [ ] 实现运输状态查询服务
- [ ] 实现自动更新状态逻辑

### UI层

- [ ] 更新确认发货对话框(船运公司必填)
- [ ] 移除"标记为运输中"按钮(因为是自动的)
- [ ] 移除"标记为到港"按钮(因为是自动的)
- [ ] 添加运输状态查询时间显示
- [ ] 添加查询失败提醒

### 定时任务

- [ ] 配置定时任务(每4小时查询一次)
- [ ] 或配置webhook接口供外部调用

---

## 🔗 需要对接的运输查询接口

请提供您的"运输查询"功能的接口信息:

```typescript
// 需要的接口信息
interface ShippingQueryAPI {
  // 接口地址
  endpoint: string; // 例如: '/api/shipping-tracking/query'

  // 请求参数
  requestParams: {
    shippingCompany: string; // 船运公司名称
    containerNumber: string; // 集装箱号
  };

  // 响应格式
  response: {
    status: 'in_transit' | 'arrived' | 'unknown';
    arrivedAt?: string; // ISO日期格式
    estimatedArrival?: string;
    currentLocation?: string;
  };
}
```

我可以根据您的实际接口格式来实现对接! 🚀
