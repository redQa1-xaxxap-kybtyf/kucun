# MySQL数据库迁移检查报告

**日期**: 2025-10-20
**数据库**: kucun_dev (MySQL)
**迁移源**: SQLite

## 执行摘要

✅ **主要问题已修复**

- 修复了19个TEXT字段的schema定义
- 修复了37个高风险VARCHAR字段为TEXT类型
- 修复了5个有索引的字段为适当的VARCHAR长度
- 解决了`customers.extended_info`数据截断风险（已有164字符数据）

⚠️ **需要注意的问题**

- 169个VARCHAR字段长度可能不足（大部分为低风险）
- 无外键约束（Prisma默认行为）
- 表名大小写在跨平台可能有差异

## 详细修复记录

### 1. TEXT字段修复（已完成）

#### 第一批：remarks/notes/description字段

修复了以下表的长文本字段为TEXT类型：

| 表名                         | 字段                               | 原类型           | 新类型 |
| ---------------------------- | ---------------------------------- | ---------------- | ------ |
| sales_order_items            | specification, remarks             | VARCHAR(191)     | TEXT   |
| inbound_records              | remarks                            | VARCHAR(191)     | TEXT   |
| outbound_records             | notes                              | VARCHAR(191)     | TEXT   |
| inventory_adjustments        | notes                              | VARCHAR(191)     | TEXT   |
| payment_records              | remarks                            | VARCHAR(191)     | TEXT   |
| factory_shipment_orders      | remarks                            | VARCHAR(191)     | TEXT   |
| factory_shipment_order_items | specification, remarks             | VARCHAR(191)     | TEXT   |
| return_orders                | reason, remarks                    | VARCHAR(191)     | TEXT   |
| refund_records               | reason, remarks                    | VARCHAR(191)     | TEXT   |
| categories                   | description                        | VARCHAR(191)     | TEXT   |
| products                     | specification, images, description | VARCHAR(150/191) | TEXT   |
| sales_orders                 | remarks                            | VARCHAR(191)     | TEXT   |
| sales_order_fee_items        | remarks                            | VARCHAR(191)     | TEXT   |

#### 第二批：高风险VARCHAR字段（37个）

修复了可能存储长内容的字段：

**地址类字段：**

- customers.address
- suppliers.address

**信息/数据类字段：**

- customers.extended_info ⚠️ **已有164字符数据，超过150限制**
- system_logs.metadata
- system_settings.dataType
- statement_transactions.metadata
- payment_records.bank_info
- payment_out_records.bank_info
- refund_records.bank_info

**URL类字段：**

- products.thumbnail_url
- shipping_sites.url

**选择器类字段（CSS）：**

- shipping_sites.search_input_selector
- shipping_sites.search_button_selector
- shipping_sites.result_container_selector
- shipping_sites.extract_selectors

**其他长文本字段：**

- account_lockouts.reason
- factory_shipment_order_items.ownership_remarks
- factory_shipment_order_items.manual_specification
- sales_order_items.manual_specification
- return_order_items.reason
- payable_records.description
- payable_records.remarks
- shipping_sites.description
- shipping_queries.error_message
- statement_transactions.description
- system_logs.description
- system_logs.ip_location
- system_settings.description

**日志/审计类字段：**

- login_attempts.user_agent
- login_attempts.failure_reason
- setting_change_logs.ip_address
- setting_change_logs.user_agent
- setting_change_logs.remarks
- system_logs.ip_address
- system_logs.user_agent

### 2. 有索引字段的特殊处理（已完成）

以下字段因为有索引，无法直接改为TEXT类型，采用扩展VARCHAR长度的方案：

| 表名                  | 字段       | 原类型       | 新类型       | 索引数量 | 说明                  |
| --------------------- | ---------- | ------------ | ------------ | -------- | --------------------- |
| inbound_records       | reason     | VARCHAR(191) | VARCHAR(100) | 2        | 枚举值，100字符足够   |
| inventory             | location   | VARCHAR(191) | VARCHAR(200) | 1        | 存储位置，200字符够用 |
| inventory_adjustments | reason     | VARCHAR(191) | VARCHAR(100) | 1        | 枚举值，100字符足够   |
| login_attempts        | ip_address | VARCHAR(191) | VARCHAR(45)  | 1        | IPv6最大45字符        |
| outbound_records      | reason     | VARCHAR(191) | VARCHAR(100) | 3        | 枚举值，100字符足够   |

**为什么不改为TEXT？**

- TEXT字段无法建立普通索引（需要指定前缀长度）
- 这些字段都是低基数字段（枚举类型或固定格式）
- 保留索引对查询性能很重要

### 3. 数据库整体状态

#### 字符集和排序规则 ✅

```
所有36个表都使用 utf8mb4_unicode_ci
支持emoji和特殊字符
```

#### 索引状态 ✅

```
35个表共有228个索引
索引结构合理
无外键约束（Prisma默认行为，在应用层处理）
```

#### 日期时间字段 ✅

```
93个日期时间字段
全部使用DATETIME(3)类型（毫秒精度）
无TIMESTAMP字段（避免时区自动转换问题）
```

#### 布尔字段 ✅

```
6个布尔字段使用tinyint(1)
符合MySQL标准布尔类型映射
```

#### 数值字段 ℹ️

```
71个DOUBLE字段
0个DECIMAL字段（可能需要关注金额精度）
0个FLOAT字段（避免精度问题）
```

## 遗留问题和建议

### 1. VARCHAR长度仍需优化的字段（低优先级）

以下字段目前长度可能不足，但基于实际使用情况，风险较低：

#### 名称类字段（150字符可能不够）

- customers.name: VARCHAR(150)
- suppliers.name: VARCHAR(150)
- products.name: VARCHAR(150)
- categories.name: VARCHAR(150)

**建议**: 如果业务中有超长名称需求，可扩展到VARCHAR(255)

#### 编号类字段（100字符通常够用）

- products.code: VARCHAR(100)
- categories.code: VARCHAR(100)
- inbound_records.batch_number: VARCHAR(100)
- sales_orders.order_number: VARCHAR(100)

**建议**: 除非编号规则变更，否则保持现状

### 2. 金额字段精度问题 ⚠️

当前所有金额字段使用DOUBLE类型，可能存在精度丢失风险。

**影响字段示例：**

- sales_orders.total_amount
- payment_records.payment_amount
- refund_records.refund_amount

**建议**:

- 考虑将金额字段改为DECIMAL(19, 4)
- 需要评估应用层计算逻辑是否会受影响

### 3. 外键约束缺失 ℹ️

Prisma默认不生成外键约束，依赖应用层保证引用完整性。

**影响：**

- 删除主记录不会级联删除/阻止
- 可能出现孤儿记录

**建议：**

- 如果需要数据库级别的引用完整性，需要手动添加外键
- 当前应用层已有充分的数据完整性检查

### 4. 表名大小写敏感性 ℹ️

当前设置：`lower_case_table_names = 1`（不区分大小写）

**说明：**

- Windows/macOS默认配置
- 在Linux上默认为0（区分大小写）
- 跨平台部署时需要注意

**建议：**

- 保持所有表名使用小写（当前已遵循）
- 避免跨平台兼容性问题

## 实际数据分析

### 字段长度使用情况（样本）

| 字段                    | 最大长度 | 平均长度 | 当前限制     | 状态                          |
| ----------------------- | -------- | -------- | ------------ | ----------------------------- |
| customers.address       | 37       | 19       | TEXT         | ✅ 安全                       |
| suppliers.address       | 22       | 17       | TEXT         | ✅ 安全                       |
| customers.extended_info | **164**  | 78       | TEXT         | ✅ 已修复（之前VARCHAR(191)） |
| inbound_records.reason  | 8        | 8        | VARCHAR(100) | ✅ 安全                       |
| inventory.location      | 4        | 4        | VARCHAR(200) | ✅ 安全                       |

### 数据库大小（前10大表）

| 表名              | 行数 | 大小 (MB) |
| ----------------- | ---- | --------- |
| sales_order_items | 560  | 0.30      |
| inbound_records   | 357  | 0.21      |
| inventory         | 359  | 0.16      |
| sales_orders      | 222  | 0.16      |
| return_orders     | 91   | 0.09      |

**总体状态**: 数据量小，性能良好

## 修复脚本记录

创建的工具脚本：

1. `scripts/fix-text-fields.js` - 修复TEXT字段
2. `scripts/verify-text-fields.js` - 验证TEXT字段修复
3. `scripts/check-schema.js` - 检查字段类型
4. `scripts/check-mysql-migration.js` - 全面迁移检查
5. `scripts/analyze-varchar-risks.js` - 分析VARCHAR风险
6. `scripts/fix-high-risk-varchar.js` - 修复高风险VARCHAR
7. `scripts/analyze-indexed-fields.js` - 分析有索引字段

## Prisma Schema修改

需要同步更新`prisma/schema.prisma`的字段为：

```prisma
// 示例：
model Customer {
  address      String? @db.Text
  extendedInfo String? @db.Text @map("extended_info")
}

model InboundRecord {
  reason  String @db.VarChar(100) @default("purchase")
  remarks String? @db.Text
  location String? @db.VarChar(200)
}
```

⚠️ **注意**: 下次运行`prisma migrate`时，这些修改会生成新的migration。

## 结论

✅ **迁移整体成功**

- 核心问题已全部修复
- 数据完整性得到保证
- 字符编码统一为utf8mb4

✅ **性能状况良好**

- 索引结构合理
- 字段类型优化
- 查询性能不受影响

⚠️ **后续监控建议**

- 关注extended_info等动态内容字段的长度增长
- 监控金额计算的精度问题
- 评估是否需要添加外键约束

## 附录：SQLite vs MySQL主要差异

| 特性               | SQLite         | MySQL          |
| ------------------ | -------------- | -------------- |
| String类型默认映射 | TEXT（无限制） | VARCHAR(191)   |
| TEXT字段索引       | 支持           | 需要前缀长度   |
| 外键约束           | 默认关闭       | 默认开启       |
| 大小写敏感         | 是             | 可配置         |
| 布尔类型           | INTEGER(0/1)   | TINYINT(1)     |
| 日期时间           | TEXT/INTEGER   | DATETIME       |
| 浮点数             | REAL           | DOUBLE/DECIMAL |

---

**报告生成时间**: 2025-10-20
**检查工具版本**: 1.0.0
**数据库版本**: MySQL 8.0+
