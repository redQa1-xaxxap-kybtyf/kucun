# 收款记录创建问题调试指南

## 问题描述

在应收账款页面点击"收款"按钮时，创建收款记录失败。

## 已完成的修复

### 1. API错误处理改进 (lib/api/payments.ts)

- ✅ 修复了 `createPaymentRecord` 函数的错误处理
- ✅ 现在能够正确解析并显示服务器返回的详细验证错误
- ✅ 改进了 `confirmPayment` 函数的错误处理

### 2. 前端验证增强 (components/finance/receivable-payment-dialog.tsx)

- ✅ 添加了收款金额必须大于0的验证
- ✅ 添加了收款金额不能超过待收金额的验证
- ✅ 添加了详细的控制台日志记录
- ✅ 改进了错误提示的用户体验

## 调试步骤

### 步骤 1: 检查浏览器控制台

1. 打开应收账款页面
2. 按 `F12` 打开开发者工具
3. 切换到 **Console（控制台）** 标签
4. 点击某个订单的"收款"按钮
5. 查看控制台输出，应该看到类似以下的日志：

```
[收款对话框] 开始创建收款记录 {orderId: "...", customerId: "...", ...}
```

如果创建失败，会显示：

```
[收款对话框] 收款失败 Error: ...
```

**请记录错误消息的完整内容！**

### 步骤 2: 检查网络请求

1. 在开发者工具中切换到 **Network（网络）** 标签
2. 点击"收款"按钮
3. 找到 `POST /api/payments` 请求
4. 点击该请求，查看：
   - **Headers（请求头）**: 确认 Content-Type 是 `application/json`
   - **Payload（请求体）**: 查看发送的数据是否正确
   - **Response（响应）**: 查看服务器返回的错误信息

### 步骤 3: 检查数据完整性

确认选择的订单数据是否完整：

- `id`: 订单ID（必填）
- `customerId`: 客户ID（必填）
- `remainingAmount`: 待收金额（必须大于0）

### 步骤 4: 使用测试脚本

运行测试脚本来独立测试API：

```bash
# 1. 确保开发服务器正在运行
npm run dev

# 2. 在另一个终端运行测试脚本
npx tsx scripts/test-payment-creation.ts
```

**注意**: 修改脚本中的 `salesOrderId` 和 `customerId` 为真实值！

## 常见错误和解决方案

### 错误 1: "销售订单ID必须是字符串"

**原因**: `salesOrderId` 为空或格式不正确
**解决**: 确认应收账款数据中的订单ID正确

### 错误 2: "请选择客户"

**原因**: `customerId` 为空
**解决**: 确认应收账款数据中的客户ID正确

### 错误 3: "收款金额必须大于0"

**原因**: 输入的收款金额为0或负数
**解决**: 输入正确的收款金额

### 错误 4: "收款金额不能超过待收金额"

**原因**: 输入的收款金额超过了订单的剩余应收金额
**解决**: 调整收款金额不超过 `remainingAmount`

### 错误 5: "订单收款时必须关联销售订单或厂家发货单"

**原因**: `paymentType` 为 'order_payment' 但没有提供订单ID
**解决**: 确认应收账款item的id字段正确传递为salesOrderId

### 错误 6: "销售订单不存在"

**原因**: 数据库中找不到对应的订单
**解决**: 确认订单ID正确且订单存在于数据库中

### 错误 7: "客户信息与订单不匹配"

**原因**: 提供的客户ID与订单的客户ID不一致
**解决**: 确认应收账款数据中的客户ID与订单匹配

## 数据流程图

```
用户点击"收款"
    ↓
打开 ReceivablePaymentDialog 对话框
    ↓
用户填写收款信息（金额、日期、方式等）
    ↓
点击"确认收款"按钮
    ↓
handleSubmit 函数验证:
  - receivable 对象存在？
  - paymentAmount > 0？
  - paymentAmount <= remainingAmount？
    ↓
构造 payload 数据:
  {
    paymentType: 'order_payment',
    salesOrderId: receivable.id,
    customerId: receivable.customerId,
    paymentAmount: Number(values.paymentAmount),
    actualPaymentAmount: Number(values.actualPaymentAmount),
    roundingAmount: Number(values.roundingAmount),
    paymentDate: values.paymentDate,
    paymentMethod: values.paymentMethod,
    remarks: values.remarks,
    receiptNumber: values.receiptNumber,
    bankInfo: values.bankInfo
  }
    ↓
调用 createPaymentMutation.mutateAsync(payload)
    ↓
paymentsApi.createPaymentRecord(payload)
    ↓
POST /api/payments
    ↓
服务器验证 (app/api/payments/route.ts):
  - Zod schema 验证
  - 销售订单存在性验证
  - 客户ID匹配验证
  - 收款金额验证
    ↓
创建 PaymentRecord 记录（状态: pending）
    ↓
返回创建的 payment 对象
    ↓
调用 confirmPaymentMutation.mutateAsync({id: paymentRecord.id})
    ↓
POST /api/payments/{id}/confirm
    ↓
更新 PaymentRecord 状态为 'confirmed'
    ↓
记录 partner transaction（如果是 order_payment）
    ↓
成功！显示成功提示
```

## 需要用户提供的信息

请在测试后提供以下信息：

1. **浏览器控制台的完整错误信息**
   - 包括 `[收款对话框]` 开头的所有日志
   - 任何红色的错误堆栈信息

2. **Network 标签中的请求详情**
   - Request Payload（请求体）的完整内容
   - Response（响应体）的完整内容
   - HTTP 状态码（200? 400? 500?）

3. **Toast 提示信息**
   - 屏幕上显示的任何错误提示内容

4. **订单信息**
   - 尝试收款的订单编号
   - 订单的待收金额
   - 输入的收款金额

## 进一步调试

如果以上步骤都无法解决问题，请提供：

1. 完整的错误堆栈信息
2. 数据库中该订单的完整信息（可以运行 SQL 查询）
3. 浏览器和操作系统版本
4. 是否在本地开发环境还是生产环境

## 预期的正常流程

正常情况下，控制台应该显示：

```
[收款对话框] 开始创建收款记录 {orderId: "xxx", customerId: "yyy", paymentAmount: 100, actualPaymentAmount: 100}
[收款对话框] 收款记录已创建 {id: "zzz", paymentNumber: "PAY-20250122-123456", ...}
[收款对话框] 收款记录已确认
```

然后对话框关闭，页面显示成功提示，应收账款列表自动刷新。
