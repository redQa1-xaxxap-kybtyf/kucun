# 06 - 旧系统替换方案

> 本文档定义旧打印系统的完整替换策略，**不保留兼容**。

---

## 1. 待删除文件清单

### 1.1 类型定义

```
lib/types/
├── print-style.ts         # 删除 (约 900 行)
└── print-config.ts        # 保留部分，重构为新 Schema
```

### 1.2 服务层

```
lib/services/
└── print-template-service.ts  # 删除 (localStorage 存储)
```

### 1.3 组件层

```
components/print/
├── StyleEditor.tsx            # 删除 (20KB)
├── FieldSelector.tsx          # 删除 (9KB)
├── PrintPreviewDialog.tsx     # 重写 (使用新渲染器)
├── PrintLayout.tsx            # 删除 (被 PrintCanvas 替代)
├── common/                    # 删除整个目录
└── style-panels/              # 删除整个目录
```

### 1.4 业务打印组件

```
app/(dashboard)/sales-orders/[id]/components/
├── SalesOrderPrintContent.tsx     # 删除 (硬编码模板)
└── SalesOrderPrintTemplate.tsx    # 删除

components/purchase-orders/
└── PurchaseOrderPrintContent.tsx  # 删除

components/factory-shipments/
└── FactoryShipmentPrintContent.tsx # 删除
```

---

## 2. 替换策略

### 2.1 一次性切换

| 步骤 | 操作              | 说明                                                          |
| ---- | ----------------- | ------------------------------------------------------------- |
| 1    | 完成新设计器开发  | 全部功能就绪                                                  |
| 2    | 创建默认模板      | 为每个单据类型各创建 **1 个默认模板**（系统自动强制唯一默认） |
| 3    | 删除旧文件        | 按上述清单删除                                                |
| 4    | 更新引用          | 修改所有打印入口使用新组件                                    |
| 5    | 清理 localStorage | 删除 `print_templates`、`print_default_*`                     |

### 2.2 新系统入口

```typescript
// 统一使用新的打印预览（基于可视化模板）
import { PrintTemplatePreviewDialog } from '@/components/print-designer';

// 业务页面调用
<PrintTemplatePreviewDialog
  open={open}
  onOpenChange={setOpen}
  templateType="sales-order"
  documentId={orderId}
/>
```

---

## 3. 默认模板创建

替换前需在数据库中预置以下模板：

| 类型             | 模板名称          | 说明                       |
| ---------------- | ----------------- | -------------------------- |
| sales-order      | 销售发货单 (默认) | 基于旧 "天津豪星" 样式重建 |
| purchase-order   | 采购订单 (默认)   | 标准 A4 横向               |
| factory-shipment | 工厂发货单 (默认) | 标准 A4 横向               |
| inbound-record   | 仓库进货单 (默认) | 入库记录打印（单条/单品）  |
| return-order     | 退货单 (默认)     | 退货订单打印               |

---

## 4. 实施路线调整

原 Day 13-14 后端集成 → 增加 **Day 15: 清理旧代码**

| 任务              | 预估 (h) | 说明                                      |
| ----------------- | -------- | ----------------------------------------- |
| 删除旧组件文件    | 1        | 按清单删除                                |
| 更新业务页面引用  | 2        | 修改 HeaderCard, purchase-order-detail 等 |
| 创建默认模板数据  | 2        | seed 脚本或手动录入                       |
| 清理 localStorage | 0.5      | 迁移脚本                                  |
| 回归测试          | 2        | 验证打印功能正常                          |

---

## 5. 风险

| 风险               | 缓解                              |
| ------------------ | --------------------------------- |
| 删除后发现遗漏引用 | TypeScript 编译会报错，按提示修复 |
| 用户习惯旧 UI      | 在删除前告知用户新功能入口        |
