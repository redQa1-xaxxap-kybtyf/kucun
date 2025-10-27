# 厂家发货业务流程分析与改进建议

## 📋 当前业务流程问题分析

### 问题1: 状态流转时机不明确

**当前状态流程**:

```
草稿 → 已确认 → 待发货 → 已发货 → 运输中 → 到港
```

**存在的问题**:

1. **草稿 → 已确认**: 什么时候应该确认?
2. **集装箱号**: 创建时填写 vs 发货时填写?
3. **船运公司**: 信息获取延迟导致无法及时查询货物状态

---

## 🎯 业务场景分析

### 典型业务流程

#### 场景1: 正常流程

```
1. 销售人员创建订单(草稿状态)
   - 录入客户信息
   - 录入商品明细
   - 计算金额
   - **此时可能没有集装箱号和船运公司**

2. 订单审核/确认
   - 财务/主管审核订单金额
   - 确认库存/供应商
   - **什么时候变成"已确认"?**

3. 工厂安排发货
   - 工厂确认发货时间
   - **此时获得集装箱号**(可能会变更)
   - **此时获得船运公司信息**(可能延迟提供)

4. 货物运输
   - 已发货 → 运输中 → 到港
   - **需要通过船运公司查询货物状态**
```

#### 场景2: 信息变更流程

```
问题: 集装箱号码可能变更
- 初始: ABCD1234567
- 变更: EFGH7654321

问题: 船运公司信息延迟
- 发货时: 未提供船运公司
- 3天后: 船运公司提供追踪信息
- 需求: 通过船运公司名称查询货物位置
```

---

## 💡 改进建议方案

### 方案A: 优化状态流转(推荐) ⭐

#### 1. 明确状态含义和触发条件

```typescript
// 建议的状态流转逻辑

1. 草稿 (draft)
   触发条件: 订单创建
   必填字段: 客户、商品明细
   可选字段: 集装箱号、船运公司

2. 已确认 (confirmed)
   触发条件: 财务/主管审核通过
   业务含义: 订单金额、商品明细已确认，可以安排发货
   必填字段: 客户、商品明细、金额
   可选字段: 集装箱号、船运公司
   操作人: 主管/财务

3. 待发货 (pending_shipment)
   触发条件: 工厂确认可以发货
   业务含义: 已联系工厂，等待装柜发货
   可选字段: 预计发货时间、集装箱号(预分配)
   操作人: 采购/业务员

4. 已发货 (shipped)
   触发条件: 货物已装柜离开工厂
   业务含义: 货物开始运输
   必填字段: 集装箱号、发货时间
   建议字段: 船运公司(如已知)
   操作人: 采购/业务员

5. 运输中 (in_transit)
   触发条件: 手动标记或系统自动(有船运公司信息时)
   业务含义: 货物在海上/陆地运输中
   必填字段: 船运公司(用于追踪)
   可选字段: 预计到达时间

6. 到港 (arrived)
   触发条件: 确认货物到达目的港
   业务含义: 可以安排提货和入库
   自动操作: 创建应收账款
```

#### 2. 集装箱号管理策略

**方案2-1: 允许多次更新(推荐)**

```typescript
// 数据库设计
interface FactoryShipmentOrder {
  // 当前集装箱号
  containerNumber: string | null;

  // 集装箱号变更历史(新增)
  containerHistory?: {
    oldNumber: string;
    newNumber: string;
    changedAt: Date;
    changedBy: string;
    reason: string;
  }[];
}

// 业务逻辑
- 草稿阶段: 可以不填写
- 已确认阶段: 可以填写预分配的集装箱号
- 待发货阶段: 可以更新集装箱号
- 已发货阶段: 可以更新集装箱号(记录变更历史)
- 运输中/到港: 不允许更改(或需要特殊权限)
```

**方案2-2: 简化版(次选)**

```typescript
// 只允许在"已发货"时强制填写，之后可以更新一次
- 草稿~待发货: containerNumber可选
- 已发货时: 必须填写containerNumber
- 已发货后: 允许更新一次(用于纠错)
```

#### 3. 船运公司信息管理策略

**核心问题**: 船运公司信息延迟提供，但又是查询货物状态的关键

**解决方案: 分阶段填写 + 提醒机制**

```typescript
// 数据库字段设计
interface FactoryShipmentOrder {
  shippingCompany: string | null;        // 船运公司名称
  estimatedArrival: Date | null;         // 预计到达时间
  trackingNumber: string | null;         // 追踪号(可选)
  shippingCompanyUpdatedAt: Date | null; // 船运信息更新时间
}

// 业务规则
1. 草稿~待发货阶段
   - shippingCompany: 可选
   - 前端提示: "如已知船运公司，请填写以便追踪"

2. 已发货阶段
   - shippingCompany: 可选但推荐填写
   - 系统提示: "建议填写船运公司以便追踪货物"

3. 运输中阶段(关键)
   - shippingCompany: 必填
   - 状态流转限制: 如果没有船运公司信息，不能变更为"运输中"
   - 系统提示: "必须填写船运公司信息才能标记为运输中"

4. 补充信息机制
   - 已发货但未填写船运公司时，系统每日提醒
   - 提供"补充船运信息"的快捷操作入口
```

---

## 🔧 技术实现建议

### 1. 状态流转验证增强

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
  [FACTORY_SHIPMENT_STATUS.SHIPPED]: [FACTORY_SHIPMENT_STATUS.IN_TRANSIT],
  [FACTORY_SHIPMENT_STATUS.IN_TRANSIT]: [FACTORY_SHIPMENT_STATUS.ARRIVED],
  [FACTORY_SHIPMENT_STATUS.ARRIVED]: [],
  [FACTORY_SHIPMENT_STATUS.CANCELLED]: [],
};

// 新增: 状态前置条件验证
export const statusPrerequisites: Record<
  string,
  (order: Order) => { valid: boolean; message: string }
> = {
  [FACTORY_SHIPMENT_STATUS.CONFIRMED]: order => {
    // 已确认: 必须有商品明细和金额
    if (!order.items?.length) {
      return { valid: false, message: '必须有商品明细才能确认订单' };
    }
    if (order.totalAmount <= 0) {
      return { valid: false, message: '订单金额必须大于0' };
    }
    return { valid: true, message: '' };
  },

  [FACTORY_SHIPMENT_STATUS.SHIPPED]: order => {
    // 已发货: 必须有集装箱号
    if (!order.containerNumber?.trim()) {
      return { valid: false, message: '必须填写集装箱号才能标记为已发货' };
    }
    return { valid: true, message: '' };
  },

  [FACTORY_SHIPMENT_STATUS.IN_TRANSIT]: order => {
    // 运输中: 必须有船运公司信息
    if (!order.shippingCompany?.trim()) {
      return { valid: false, message: '必须填写船运公司信息才能标记为运输中' };
    }
    return { valid: true, message: '' };
  },
};
```

### 2. 集装箱号变更日志

```typescript
// prisma/schema.prisma

model ContainerNumberChangeLog {
  id                     String   @id @default(uuid())
  factoryShipmentOrderId String   @map("factory_shipment_order_id")
  oldNumber              String?  @map("old_number")
  newNumber              String   @map("new_number")
  reason                 String?  @db.Text
  changedBy              String   @map("changed_by")
  changedAt              DateTime @default(now()) @map("changed_at")

  order FactoryShipmentOrder @relation(fields: [factoryShipmentOrderId], references: [id])
  user  User                 @relation(fields: [changedBy], references: [id])

  @@index([factoryShipmentOrderId])
  @@map("container_number_change_logs")
}
```

### 3. UI改进建议

#### 订单编辑表单

```typescript
// 根据状态显示不同的提示和必填要求

<FormField name="containerNumber">
  <FormLabel>
    集装箱号码
    {status === 'shipped' && <span className="text-red-500">*</span>}
  </FormLabel>
  <FormControl>
    <Input
      placeholder={
        status === 'draft' ? '可选，发货时填写' :
        status === 'confirmed' ? '可填写预分配的集装箱号' :
        '请输入集装箱号码'
      }
    />
  </FormControl>
  {status === 'shipped' && (
    <FormMessage>发货时必须填写集装箱号</FormMessage>
  )}
</FormField>

<FormField name="shippingCompany">
  <FormLabel>
    船运公司
    {status === 'in_transit' && <span className="text-red-500">*</span>}
  </FormLabel>
  <FormControl>
    <Input placeholder="请输入船运公司名称" />
  </FormControl>
  {status === 'shipped' && !shippingCompany && (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        建议填写船运公司信息，以便后续追踪货物状态
      </AlertDescription>
    </Alert>
  )}
</FormField>
```

#### 补充信息快捷入口

```typescript
// 在订单详情页面，如果已发货但缺少船运公司信息

{order.status === 'shipped' && !order.shippingCompany && (
  <Alert variant="warning">
    <Ship className="h-4 w-4" />
    <AlertTitle>需要补充船运信息</AlertTitle>
    <AlertDescription>
      请填写船运公司信息以便追踪货物状态
      <Button size="sm" variant="outline" className="ml-2">
        补充信息
      </Button>
    </AlertDescription>
  </Alert>
)}
```

### 4. 状态变更确认对话框优化

```typescript
// 确认发货对话框(confirm-shipment-dialog.tsx)

const confirmShipmentSchema = z.object({
  containerNumber: z.string().min(1, '集装箱号码不能为空'),
  shippingCompany: z.string().optional(),
  estimatedArrival: z.date().optional(),
  shipmentDate: z.date().default(() => new Date()),
});

<Form>
  <FormField name="containerNumber">
    <FormLabel>集装箱号码 <span className="text-red-500">*</span></FormLabel>
    <Input placeholder="请输入集装箱号码" />
  </FormField>

  <FormField name="shippingCompany">
    <FormLabel>船运公司 <span className="text-yellow-600">(推荐填写)</span></FormLabel>
    <Input placeholder="如已知，请填写船运公司" />
    <FormDescription>
      填写船运公司信息可以更好地追踪货物状态
    </FormDescription>
  </FormField>

  <FormField name="estimatedArrival">
    <FormLabel>预计到达时间</FormLabel>
    <DateTimePicker />
  </FormField>
</Form>
```

---

## 📊 状态流转对照表

| 状态   | 业务含义    | 触发条件 | 必填字段               | 推荐字段     | 操作人    |
| ------ | ----------- | -------- | ---------------------- | ------------ | --------- |
| 草稿   | 订单创建中  | 新建订单 | 客户、商品             | -            | 业务员    |
| 已确认 | 审核通过    | 主管审核 | 金额>0                 | -            | 主管/财务 |
| 待发货 | 等待装柜    | 联系工厂 | -                      | 预计发货时间 | 采购      |
| 已发货 | 货物离厂    | 确认发货 | **集装箱号**、发货时间 | 船运公司     | 采购      |
| 运输中 | 海运/陆运中 | 货物在途 | **船运公司**           | 预计到达     | 系统/采购 |
| 到港   | 货物到达    | 到达港口 | 到港时间               | -            | 采购      |

---

## 🎯 实施优先级建议

### 第一阶段(立即实施) - 高优先级

1. ✅ **已完成**: 添加船运公司和预计到达时间字段
2. ⭐ **待实施**: 状态前置条件验证
   - 已发货必须填写集装箱号
   - 运输中必须填写船运公司
3. ⭐ **待实施**: 优化确认发货对话框
   - 添加船运公司输入(可选)
   - 添加预计到达时间输入

### 第二阶段(近期实施) - 中优先级

4. 📋 集装箱号变更历史记录
5. 📋 状态含义和触发条件文档化
6. 📋 补充船运信息的提醒机制

### 第三阶段(长期优化) - 低优先级

7. 🔮 对接船运公司API自动追踪
8. 🔮 自动更新货物状态(运输中→到港)
9. 🔮 预计到达时间的智能预测

---

## ✅ 推荐行动方案

### 最小改动方案(快速上线)

```typescript
1. 调整状态流转验证
   - 已发货: 必须填集装箱号
   - 运输中: 必须填船运公司

2. 优化确认发货对话框
   - 必填: 集装箱号
   - 推荐: 船运公司、预计到达

3. 补充信息提醒
   - 已发货但缺船运公司时显示提醒
   - 提供快捷补充入口
```

### 完整优化方案(全面升级)

```typescript
1. 状态流转验证 + 前置条件
2. 集装箱号变更历史
3. 船运信息管理策略
4. UI提示和引导优化
5. 补充信息机制
```

---

## 💬 需要您确认的关键问题

1. **草稿 → 已确认的触发时机**
   - 是否需要主管/财务审核?
   - 还是业务员自己可以确认?

2. **集装箱号的管理方式**
   - 是否允许多次变更?
   - 是否需要记录变更历史?

3. **船运公司信息的重要性**
   - 是否是查询货物的唯一方式?
   - 如果没有船运公司，如何追踪货物?

4. **状态自动化程度**
   - 是否需要对接船运公司API?
   - 还是手动更新状态?

---

## 📝 总结

### 当前问题

- ❌ 状态流转时机不明确
- ❌ 集装箱号管理策略不清晰
- ❌ 船运公司信息延迟影响追踪

### 建议改进

- ✅ 明确状态含义和触发条件
- ✅ 分阶段填写必填字段
- ✅ 添加前置条件验证
- ✅ 优化UI提示和引导
- ✅ 补充信息机制

### 实施路径

1. **快速**: 状态验证 + 对话框优化(1天)
2. **完整**: 变更历史 + 提醒机制(3天)
3. **长期**: API对接 + 自动化(后续迭代)

请根据您的实际业务需求选择合适的实施方案,我可以帮您进一步完善和实施! 🚀
