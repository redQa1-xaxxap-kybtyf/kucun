# 退货订单创建调试指南

## 新增调试功能

我已经为您添加了完整的调试系统，帮助快速定位创建失败的原因。

### 1. 页面内调试面板（推荐）

**位置**：退货订单创建页面右下角的圆形按钮（带 🐛 图标）

**功能**：
- ✅ 实时捕获所有控制台日志
- ✅ 按类型分类显示（LOG/ERROR/WARN/INFO）
- ✅ 显示时间戳
- ✅ 格式化 JSON 数据
- ✅ 保留最近 100 条日志
- ✅ 一键清空日志
- ✅ 错误时按钮变红色

**使用方法**：
1. 打开退货订单创建页面
2. 点击右下角的 🐛 按钮
3. 填写并提交表单
4. 调试面板会实时显示所有日志
5. 如果失败，错误信息会高亮显示（红色背景）

### 2. 浏览器控制台

**快捷键**：F12

**日志标记**：
- `=== 表单提交开始 ===` - 表单开始提交
- `提交表单数据:` - 表单的完整数据（JSON 格式）
- `表单验证状态:` - 验证错误（如果有）
- `表单是否有效:` - true/false
- `创建退货订单数据:` - 发送到 API 的数据
- `退货模式:` - single_order 或 multi_order
- `销售订单ID:` - 关联的订单
- `客户ID:` - 选择的客户
- `商品明细数量:` - 商品数量
- `✅ 创建成功！` - 成功响应
- `❌ 创建失败！` - 失败响应和错误详情

### 3. 服务器端日志

**位置**：运行 `npm run dev` 的终端窗口

**日志标记**：
- `=== API 接收到的请求数据 ===` - API 收到的请求
- `请求体:` - 完整的请求数据
- `验证通过，处理数据:` - 验证成功后的关键信息
- `退货订单创建成功:` - 成功创建的订单号
- `=== 创建退货订单失败 ===` - 错误信息和堆栈

### 4. 网络请求

**位置**：浏览器开发者工具 → Network 标签

**查看步骤**：
1. 打开 Network 标签
2. 提交表单
3. 找到 `return-orders` 的 POST 请求
4. 点击该请求
5. 查看：
   - **Headers** - 请求头
   - **Payload** - 发送的数据
   - **Response** - 服务器返回的数据
   - **Preview** - 格式化的响应

## 常见问题排查

### 问题 1：显示"创建失败"但没有详细信息

**检查**：
- 打开调试面板，查看是否有错误日志
- 检查 Network 标签中的 Response
- 查看服务器终端的输出

### 问题 2：表单验证失败

**特征**：
- Toast 显示"数据验证失败"
- 调试面板显示 `details` 数组

**解决**：
- 查看 `details` 数组中的具体错误
- 常见错误：
  - 缺少必填字段（customerId, items 等）
  - 数据格式不正确
  - 退货数量超过可退数量

### 问题 3：单订单模式下 salesOrderId 为空

**特征**：
- 日志显示 `销售订单ID: undefined` 或 `null`

**解决**：
- 确认已选择客户和销售订单
- 检查 CustomerSalesOrderSelector 组件是否正常工作
- 查看控制台是否有选择订单的日志

### 问题 4：商品明细为空

**特征**：
- 日志显示 `商品明细数量: 0`
- Toast 显示"至少需要一个退货明细"

**解决**：
- 单订单模式：选择销售订单后会自动加载商品
- 多订单模式：需要从订单列表中选择商品
- 检查 `returnableItemsData` 是否正确加载

### 问题 5：API 返回 500 错误

**特征**：
- 网络请求状态码 500
- Response 中有 error 字段

**解决**：
- 查看服务器终端的完整错误堆栈
- 检查数据库连接是否正常
- 确认所有外键关联的记录存在

## 数据流追踪

### 完整的数据流

```
1. 用户填写表单
   ↓
2. 表单验证（Zod schema）
   ↓
3. onSubmit 函数
   ↓
4. createMutation.mutate()
   ↓
5. fetch('/api/return-orders')
   ↓
6. API 验证（createReturnOrderSchema）
   ↓
7. 数据库验证（销售订单、商品等）
   ↓
8. Prisma 事务创建
   ↓
9. 返回结果
   ↓
10. onSuccess/onError 回调
   ↓
11. Toast 提示
```

### 每个步骤的日志

| 步骤 | 日志位置 | 关键信息 |
|------|---------|---------|
| 1-2 | 浏览器控制台 | 表单数据、验证状态 |
| 3-4 | 浏览器控制台 | 提交数据、退货模式 |
| 5 | Network 标签 | Payload |
| 6-9 | 服务器终端 | API 请求、验证、创建 |
| 10-11 | 浏览器控制台 + Toast | 成功/失败消息 |

## 获取帮助

如果问题仍未解决，请提供：

1. **调试面板的截图**（特别是错误日志）
2. **Network 标签中的 Response** 内容
3. **服务器终端的错误输出**
4. **当前的操作步骤**（选择了什么、填写了什么）

将这些信息一起发送，可以帮助快速定位问题！

## 测试数据示例

### 单订单模式最小测试数据

```json
{
  "returnMode": "single_order",
  "salesOrderId": "有效的销售订单ID",
  "customerId": "有效的客户ID",
  "type": "quality_issue",
  "processType": "refund",
  "items": [
    {
      "salesOrderItemId": "有效的订单明细ID",
      "productId": "有效的产品ID",
      "returnQuantity": 1,
      "originalQuantity": 10,
      "unitPrice": 100,
      "subtotal": 100,
      "condition": "good"
    }
  ]
}
```

### 多订单模式最小测试数据

```json
{
  "returnMode": "multi_order",
  "salesOrderId": null,
  "customerId": "有效的客户ID",
  "type": "quality_issue",
  "processType": "refund",
  "items": [
    {
      "salesOrderItemId": "有效的订单明细ID",
      "productId": "有效的产品ID",
      "returnQuantity": 1,
      "originalQuantity": 10,
      "unitPrice": 100,
      "subtotal": 100,
      "condition": "good"
    }
  ]
}
```
