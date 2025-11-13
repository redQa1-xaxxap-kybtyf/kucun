# 🔍 应收货款未立即显示问题 - 完整诊断指南

## 📋 问题描述

创建销售订单后（点击"提交订单"），在应收货款页面没有立即看到新创建的订单。

## ✅ 已添加的调试代码

### 1. 订单创建成功回调日志

**文件**: `components/sales-orders/enhanced-sales-order-form/hooks/useSalesOrderSubmission.ts`

**日志内容**:

- 订单编号 (Order Number)
- 订单 ID (Order ID)
- 订单状态 (Order Status) - **关键字段**
- 完整订单数据
- 缓存失效确认

### 2. 应收货款 API 查询日志

**文件**: `app/api/finance/receivables/route.ts`

**日志内容**:

- 查询参数 (Query Params)
- 缓存键 (Cache Key)
- 是否从数据库查询
- 查询结果统计（总数、记录数、第一条记录）

### 3. 查询条件构建日志

**文件**: `lib/services/receivables-helpers.ts`

**日志内容**:

- WHERE 条件详细信息
- 状态筛选: `status IN ['confirmed', 'shipped', 'completed']`
- 搜索条件、客户筛选、日期范围

## 🧪 诊断步骤

### 第一步：验证订单创建和状态

1. **打开浏览器开发者工具**:
   - 按 `F12` 或右键 → "检查"
   - 切换到 **Console** 标签页

2. **创建销售订单**:
   - 访问销售订单创建页面
   - 填写订单信息
   - **点击"提交订单"按钮**（不是"保存草稿"）

3. **查看控制台日志**:

   ```
   🎯 [DEBUG] Sales Order Created
     Order Number: SO-20250106-XXXX
     Order ID: clxxxxxxxxxxxxx
     Order Status: confirmed  ← 确认这里是 'confirmed'
     Full Order Data: {...}

   🔄 [DEBUG] Invalidating receivables cache...
   ✅ [DEBUG] Receivables cache invalidated
   ```

4. **关键检查点**:
   - ✅ `Order Status` 必须是 `'confirmed'`（不是 `'draft'`）
   - ✅ 必须看到 "Invalidating receivables cache..." 日志
   - ✅ 必须看到 "Receivables cache invalidated" 日志

### 第二步：验证应收货款查询

1. **立即访问应收货款页面**:
   - 创建订单后，立即点击导航栏的"应收货款"
   - 或直接访问 `/finance/receivables`

2. **查看 Console 日志**:

   ```
   🔍 [DEBUG] Receivables Query
     Query Params: {page: 1, limit: 20, ...}
     User ID: clxxxxxxxxxxxxx
     Cache Key: finance:receivables:list:v2:clxxxxxxxxxxxxx:...

   🔎 [DEBUG] Receivables WHERE Conditions:
     {
       "status": {
         "in": ["confirmed", "shipped", "completed"]
       }
     }

   📊 [DEBUG] Fetching from database...
   📊 [DEBUG] Query Results:
     total: 5
     count: 5
     firstOrder: {
       orderNumber: "SO-20250106-XXXX",  ← 检查是否包含新订单
       status: "confirmed",
       createdAt: "2025-01-06T..."
     }

   ✅ [DEBUG] Final Result:
     total: 5
     count: 5
   ```

3. **关键检查点**:
   - ✅ 检查 `Query Results` 中的 `total` 是否增加
   - ✅ 检查 `firstOrder.orderNumber` 是否是刚创建的订单
   - ✅ 如果看到 "Fetching from database..."，说明缓存已失效

### 第三步：检查 Network 面板

1. **切换到 Network 标签页**:
   - 在开发者工具中点击 **Network**
   - 刷新应收货款页面

2. **查找 API 请求**:
   - 找到 `/api/finance/receivables?page=1&limit=20` 请求
   - 点击查看详情

3. **检查响应数据**:

   ```json
   {
     "success": true,
     "data": {
       "receivables": [
         {
           "id": "clxxxxxxxxxxxxx",
           "orderNumber": "SO-20250106-XXXX",  ← 检查是否包含新订单
           "status": "confirmed",
           "totalAmount": 1000,
           ...
         }
       ],
       "total": 5,
       "page": 1,
       "limit": 20
     }
   }
   ```

4. **关键检查点**:
   - ✅ 响应状态码是 `200 OK`
   - ✅ `data.receivables` 数组包含新创建的订单
   - ✅ `data.total` 数量正确

### 第四步：手动刷新测试

1. **创建订单后，手动刷新页面**:
   - 按 `F5` 或 `Ctrl+R` 刷新应收货款页面

2. **观察结果**:
   - ✅ 如果刷新后能看到新订单 → **缓存失效问题**
   - ❌ 如果刷新后仍看不到 → **数据查询问题**

### 第五步：数据库验证

1. **打开 Prisma Studio**:

   ```bash
   npm run db:studio
   ```

2. **查询 sales_orders 表**:
   - 找到刚创建的订单
   - 检查 `status` 字段值
   - 检查 `createdAt` 时间戳

3. **关键检查点**:
   - ✅ 订单存在于数据库中
   - ✅ `status` 字段是 `'confirmed'`
   - ✅ `createdAt` 时间正确

## 🐛 常见问题诊断

### 问题 1: 订单状态不是 'confirmed'

**症状**:

```
Order Status: draft  ← 错误!应该是 'confirmed'
```

**原因**: 点击了"保存草稿"而不是"提交订单"

**解决方案**: 确保点击"提交订单"按钮

---

### 问题 2: 缓存失效未被调用

**症状**:

```
🎯 [DEBUG] Sales Order Created
  ...
# 没有看到 "Invalidating receivables cache..." 日志
```

**原因**: `onSuccess` 回调未执行或代码逻辑错误

**解决方案**: 检查 `useSalesOrderSubmission.ts` 的 `onSuccess` 回调

---

### 问题 3: 查询条件过滤了新订单

**症状**:

```
🔎 [DEBUG] Receivables WHERE Conditions:
  {
    "status": {"in": ["confirmed", "shipped", "completed"]},
    "createdAt": {
      "gte": "2025-01-01T00:00:00.000Z",
      "lte": "2025-01-05T23:59:59.999Z"  ← 日期范围过滤
    }
  }
```

**原因**: 应收货款页面设置了日期筛选，新订单不在范围内

**解决方案**: 清除日期筛选或调整日期范围

---

### 问题 4: Redis 缓存未失效

**症状**:

- Console 显示缓存失效成功
- 但 API 仍返回旧数据
- Network 面板显示响应很快（< 50ms）

**原因**: Redis 缓存未正确删除

**解决方案**:

1. 检查 Redis 连接状态
2. 手动清除 Redis 缓存:
   ```bash
   npm run redis:flush
   ```

---

### 问题 5: 前端缓存键不匹配

**症状**:

```
🔄 [DEBUG] Invalidating receivables cache...
# 但查询仍使用旧缓存
```

**原因**: 失效的缓存键与查询使用的键不匹配

**解决方案**: 检查 `queryKeys.finance.receivables()` 返回值

## 📊 预期的完整日志流程

### 正常流程（订单应该显示）

```
1. 创建订单:
   🎯 [DEBUG] Sales Order Created
     Order Status: confirmed  ✅
   🔄 [DEBUG] Invalidating receivables cache...
   ✅ [DEBUG] Receivables cache invalidated

2. 访问应收货款页面:
   🔍 [DEBUG] Receivables Query
     Query Params: {page: 1, limit: 20}
   🔎 [DEBUG] Receivables WHERE Conditions:
     {"status": {"in": ["confirmed", "shipped", "completed"]}}
   📊 [DEBUG] Fetching from database...  ✅ 从数据库查询
   📊 [DEBUG] Query Results:
     total: 5  ✅ 数量增加
     firstOrder: {orderNumber: "SO-20250106-XXXX"}  ✅ 新订单

3. 结果: ✅ 新订单显示在列表中
```

### 异常流程（订单不显示）

```
1. 创建订单:
   🎯 [DEBUG] Sales Order Created
     Order Status: draft  ❌ 状态错误!

2. 访问应收货款页面:
   🔍 [DEBUG] Receivables Query
   🔎 [DEBUG] Receivables WHERE Conditions:
     {"status": {"in": ["confirmed", "shipped", "completed"]}}
   📊 [DEBUG] Query Results:
     total: 4  ❌ 数量未增加
     firstOrder: {orderNumber: "SO-20250105-XXXX"}  ❌ 旧订单

3. 结果: ❌ 新订单不显示（因为状态是 'draft'）
```

## 🔧 下一步行动

根据诊断结果，选择对应的修复方案:

1. **如果订单状态是 'draft'**:
   - 检查订单创建表单的提交逻辑
   - 确认"提交订单"按钮设置的状态

2. **如果缓存失效未被调用**:
   - 检查 `onSuccess` 回调是否正确执行
   - 检查是否有错误阻止了回调执行

3. **如果查询条件过滤了新订单**:
   - 清除应收货款页面的筛选条件
   - 检查日期范围设置

4. **如果 Redis 缓存未失效**:
   - 检查 `revalidateFinance()` 函数
   - 检查 Redis 连接状态
   - 手动清除缓存测试

## 📝 报告模板

请将以下信息提供给开发者:

```
### 诊断结果

**订单创建日志**:
```

[粘贴 Console 中的 "Sales Order Created" 日志]

```

**应收货款查询日志**:
```

[粘贴 Console 中的 "Receivables Query" 日志]

````

**Network 响应数据**:
```json
[粘贴 /api/finance/receivables 的响应 JSON]
````

**问题描述**:

- [ ] 订单状态是 'confirmed'
- [ ] 缓存失效被调用
- [ ] 查询条件正确
- [ ] 手动刷新后能看到新订单
- [ ] 数据库中订单存在且状态正确

**其他观察**:
[描述任何异常现象]

```

---

**注意**: 这些调试日志仅用于诊断，修复问题后应该移除。

```
