# 08 - 业务侧如何使用可视化打印模板（必读）

> 目标：**完全迁移到可视化模板**，业务同事只需要点“打印”，无需再理解字段配置/样式配置。

---

## 1. 权限与角色

- **管理员（Admin）**：负责创建/维护模板，并为每个单据类型设置 **唯一默认模板**。
- **业务用户**：在各业务单据详情页点击 **打印**，系统自动使用该类型的默认模板渲染并打印。

---

## 2. 使用流程（业务用户）

1. 打开某个单据的详情页（例如销售订单、采购订单等）
2. 点击页面上的 **打印**
3. 系统自动：
   - 获取该单据类型的 **默认模板**
   - 获取该单据的 **打印数据**
   - 生成预览并调用浏览器打印

### 2.1 无默认模板时的表现

- 若该单据类型 **未配置默认模板**：提示“请联系管理员在系统设置中配置默认打印模板”。

---

## 3. 使用流程（管理员）

入口：**系统设置 → 打印 → 打印模板管理**

1. 创建模板（选择单据类型）
2. 进入可视化编辑器，拖拽元素并绑定字段
3. 保存模板
4. 在模板列表中对该类型点击 **设为默认**

> 约束：每个单据类型只保留 **一个默认模板**（系统会自动取消该类型其他默认）。

---

## 4. 单据类型与路由映射（当前范围）

| 模板类型（type） | 业务含义 | 典型入口 |
|---|---|---|
| `sales-order` | 销售订单/销售发货单 | `/sales-orders/[id]` |
| `purchase-order` | 采购订单 | `/purchase-orders/[id]` |
| `factory-shipment` | 厂家发货订单 | `/factory-shipments/[id]` |
| `inbound-record` | 仓库进货（入库记录） | `/inventory/inbound/[recordNumber]` |
| `return-order` | 退货订单 | `/return-orders/[id]` |

---

## 5. 数据契约（模板字段能取到什么）

> 模板绑定字段本质是“路径字符串”，运行时通过 `getNestedValue(data, path)` 取值。

### 5.1 通用顶层字段（所有类型建议提供）

- `company.*`：公司信息（如 `company.name`）
- `operator.*`：制单/操作人（如 `operator.name`）
- `printDate`：打印日期（YYYY-MM-DD）

### 5.2 通用明细表（建议统一使用 `items`）

- 表格元素的 `dataSource` 默认使用 `items`
- 建议明细行字段统一使用更易懂的通用 key：
  - `name`（名称）
  - `code`（编码）
  - `spec`（规格）
  - `unit`（单位）
  - `quantity`（数量）
  - `unitPrice`（单价）
  - `subtotal`（金额）
  - `remark`（备注）

> 系统会尽量对旧 key 做兼容映射（例如 `productName` / `specification` 等），但模板侧建议优先使用上述通用 key，方便小白上手。

---

## 6. 开发侧落地点（供研发排查）

- 模板管理：`/settings/print-templates`
- 模板编辑器：`/settings/print-designer`
- 模板渲染器：`components/print-designer/renderer/PrintCanvas.tsx`
- 单据→打印数据映射：`lib/print-designer/actions/preview-data.ts`

