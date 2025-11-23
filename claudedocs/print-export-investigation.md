# 打印/导出 PDF 功能调研与落地方案

**调研日期**: 2025-11-22
**优先级**: P1（重要功能）
**状态**: 调研完成，待实施

---

## 1. 现状盘点

### 1.1 已有基础设施

| 文件                                         | 功能                           | 可复用性          |
| -------------------------------------------- | ------------------------------ | ----------------- |
| `SalesOrderPrintTemplate.tsx`                | 销售订单 A4 横向打印模板       | ⭐⭐⭐ 高         |
| `lib/services/export-service.ts`             | html2canvas CDN 加载、图片导出 | ⭐⭐⭐ 高         |
| `hooks/use-export-to-image.ts`               | React Hook 导出图片            | ⭐⭐ 中（有重复） |
| `lib/services/sales-order-export-service.ts` | 销售订单 Excel 导出            | ⭐⭐ 中           |
| `hooks/use-sales-order-export.ts`            | 销售订单导出 Hook              | ⭐⭐ 中           |

### 1.2 现有代码分析

#### SalesOrderPrintTemplate.tsx (305 行)

```typescript
// 关键特性：
- A4 横向布局：297mm × 210mm
- 中文大写金额转换 (numberToChinese)
- 表格边框样式
- 公司抬头、客户信息、订单明细
- 重量汇总计算
```

**优点**：

- 完整的打印模板结构
- 中文货币格式化已实现
- 内联样式确保打印一致性

**缺点**：

- 硬编码字段，无法自定义
- 缺少 `@media print` CSS
- 无字段配置机制

#### export-service.ts (391 行)

```typescript
// 关键特性：
- html2canvas CDN 动态加载
- 图片导出（PNG、JPEG、WebP）
- Excel 导出（XLSX 库）
- useExport React Hook
```

**优点**：

- CDN 动态加载减少包体积
- scale=2 确保高 DPI 输出
- 错误处理完善

**缺点**：

- 缺少 jsPDF 集成
- 无 PDF 直接导出能力

### 1.3 缺失能力

| 能力                  | 当前状态 | 需要实现 |
| --------------------- | -------- | -------- |
| @media print CSS      | ❌ 无    | ✅ 需要  |
| 通用 PrintLayout 组件 | ❌ 无    | ✅ 需要  |
| 字段配置系统          | ❌ 无    | ✅ 需要  |
| **DIY 表单样式系统**  | ❌ 无    | ✅ 需要  |
| PDF 直接导出          | ❌ 无    | ✅ 需要  |
| 打印预览对话框        | ❌ 无    | ✅ 需要  |
| 采购订单打印模板      | ❌ 无    | ✅ 需要  |
| 厂家发货打印模板      | ❌ 无    | ✅ 需要  |
| 样式模板保存/加载     | ❌ 无    | ✅ 需要  |

### 1.4 DRY 违规发现

`use-export-to-image.ts` 与 `export-service.ts` 存在功能重复：

- 两处都实现了 html2canvas 加载逻辑
- 建议：删除 `use-export-to-image.ts`，统一使用 `export-service.ts`

---

## 2. 技术选型

### 2.1 方案对比

| 方案                    | 优点                       | 缺点                           | 推荐度        |
| ----------------------- | -------------------------- | ------------------------------ | ------------- |
| **HTML + @media print** | 原生支持、零依赖、样式可控 | 跨浏览器差异、无法自动保存 PDF | ⭐⭐⭐⭐ 主选 |
| **html2canvas + jsPDF** | 输出一致、可自动保存       | 依赖库、渲染质量有限           | ⭐⭐⭐ 备选   |
| **react-to-print**      | React 友好、简单易用       | 功能有限、定制性差             | ⭐⭐ 参考     |
| **Puppeteer/服务端**    | 输出完美、可批量           | 需要服务端、复杂度高           | ⭐ 暂不考虑   |

### 2.2 最终选型

```
主方案：HTML + CSS @media print + window.print()
备选方案：html2canvas + jsPDF（用于"保存为 PDF"按钮）
```

**理由**：

1. 符合用户需求文档要求
2. 复用现有 html2canvas 基础设施
3. 渐进增强，主流程零依赖

---

## 3. 架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Print/Export System                       │
├─────────────────────────────────────────────────────────────┤
│  UI Layer                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ PrintButton  │  │ PrintPreview │  │ FieldSelector│       │
│  │ Component    │  │ Dialog       │  │ Component    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
├─────────────────────────────────────────────────────────────┤
│  Template Layer                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ SalesOrder   │  │ PurchaseOrder│  │ FactoryShip  │       │
│  │ PrintTemplate│  │ PrintTemplate│  │ PrintTemplate│       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
├─────────────────────────────────────────────────────────────┤
│  Core Layer                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ PrintLayout  │  │ FieldConfig  │  │ PrintService │       │
│  │ (A4/Letter)  │  │ System       │  │ (print/PDF)  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
├─────────────────────────────────────────────────────────────┤
│  Style Layer                                                 │
│  ┌──────────────────────────────────────────────────┐       │
│  │ globals.css (@media print rules)                 │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 核心组件设计

#### 3.2.1 PrintLayout 组件

```typescript
// components/print/PrintLayout.tsx
interface PrintLayoutProps {
  size?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  margin?: string;
  children: React.ReactNode;
}

// 功能：
// - 统一的打印容器
// - 尺寸和方向控制
// - 页边距设置
// - 打印时隐藏非打印元素
```

#### 3.2.2 字段配置系统

```typescript
// lib/types/print-config.ts
interface PrintFieldDefinition {
  key: string; // 字段标识
  label: string; // 显示标签
  type: 'header' | 'item' | 'summary'; // 字段类型
  width?: string; // 列宽
  align?: 'left' | 'center' | 'right';
  format?: (value: any) => string; // 格式化函数
  defaultVisible: boolean; // 默认是否显示
}

interface PrintConfig {
  documentType: 'sales-order' | 'purchase-order' | 'factory-shipment';
  title: string;
  fields: PrintFieldDefinition[];
  headerFields: PrintFieldDefinition[];
  summaryFields: PrintFieldDefinition[];
}
```

#### 3.2.3 DIY 表单样式系统

```typescript
// lib/types/print-style.ts

/**
 * 打印样式配置
 */
export interface PrintStyleConfig {
  id?: string; // 模板ID（保存时生成）
  name: string; // 模板名称
  documentType: 'sales-order' | 'purchase-order' | 'factory-shipment';

  // 页面设置
  page: {
    size: 'A4' | 'A5' | 'Letter';
    orientation: 'portrait' | 'landscape';
    margin: {
      top: number; // mm
      right: number;
      bottom: number;
      left: number;
    };
  };

  // 表头样式
  header: {
    showLogo: boolean;
    logoUrl?: string;
    companyName: string;
    companyNameFontSize: number; // px
    subtitle?: string; // 副标题，如"销售订单"
    subtitleFontSize: number;
    alignment: 'left' | 'center' | 'right';
    showBorder: boolean;
    backgroundColor?: string;
  };

  // 信息区样式（客户信息、订单信息等）
  infoSection: {
    layout: 'single-column' | 'two-column' | 'three-column';
    labelFontSize: number;
    valueFontSize: number;
    labelColor: string;
    valueColor: string;
    rowSpacing: number; // px
  };

  // 表格样式
  table: {
    headerBgColor: string;
    headerTextColor: string;
    headerFontSize: number;
    headerFontWeight: 'normal' | 'bold';
    rowFontSize: number;
    rowHeight: number; // px
    borderStyle: 'none' | 'solid' | 'dashed';
    borderColor: string;
    borderWidth: number; // px
    stripedRows: boolean; // 斑马纹
    stripedColor: string;
    cellPadding: number; // px
  };

  // 汇总区样式
  summary: {
    alignment: 'left' | 'right';
    fontSize: number;
    fontWeight: 'normal' | 'bold';
    showChineseAmount: boolean; // 显示大写金额
    highlightTotal: boolean; // 高亮总计行
    highlightColor: string;
  };

  // 页脚样式
  footer: {
    show: boolean;
    content: string; // 支持变量如 {pageNumber}, {totalPages}, {date}
    fontSize: number;
    alignment: 'left' | 'center' | 'right';
  };

  // 签名区
  signature: {
    show: boolean;
    fields: Array<{
      label: string; // 如"制单人"、"审核人"、"客户签收"
      width: number; // 签名线宽度 mm
    }>;
    spacing: number; // 签名区与表格的间距 px
  };
}

/**
 * 预设样式模板
 */
export const PRESET_STYLES: Record<string, Partial<PrintStyleConfig>> = {
  classic: {
    name: '经典样式',
    page: {
      size: 'A4',
      orientation: 'landscape',
      margin: { top: 10, right: 10, bottom: 10, left: 10 },
    },
    header: {
      showLogo: false,
      companyNameFontSize: 20,
      alignment: 'center',
      showBorder: true,
    },
    table: {
      headerBgColor: '#f5f5f5',
      borderStyle: 'solid',
      borderWidth: 1,
      stripedRows: false,
    },
  },
  modern: {
    name: '现代简约',
    page: {
      size: 'A4',
      orientation: 'landscape',
      margin: { top: 15, right: 15, bottom: 15, left: 15 },
    },
    header: {
      showLogo: true,
      companyNameFontSize: 18,
      alignment: 'left',
      showBorder: false,
    },
    table: {
      headerBgColor: '#1a1a2e',
      headerTextColor: '#ffffff',
      borderStyle: 'none',
      stripedRows: true,
    },
  },
  compact: {
    name: '紧凑型',
    page: {
      size: 'A4',
      orientation: 'portrait',
      margin: { top: 5, right: 5, bottom: 5, left: 5 },
    },
    header: { companyNameFontSize: 14, alignment: 'center', showBorder: false },
    table: {
      headerFontSize: 10,
      rowFontSize: 9,
      rowHeight: 24,
      cellPadding: 4,
    },
  },
};
```

#### 3.2.4 样式编辑器组件

```typescript
// components/print/StyleEditor.tsx
interface StyleEditorProps {
  documentType: 'sales-order' | 'purchase-order' | 'factory-shipment';
  value: PrintStyleConfig;
  onChange: (config: PrintStyleConfig) => void;
  onSave: (config: PrintStyleConfig) => Promise<void>;
  onLoad: (templateId: string) => Promise<PrintStyleConfig>;
}

// 功能模块：
// 1. 预设模板选择（经典/现代/紧凑）
// 2. 页面设置面板（纸张大小、方向、边距）
// 3. 表头设置面板（Logo、公司名、字体）
// 4. 表格设置面板（边框、颜色、斑马纹）
// 5. 签名区设置面板
// 6. 实时预览
// 7. 保存为自定义模板
// 8. 加载已保存模板

// UI 布局：
// ┌─────────────────────────────────────────────────────────┐
// │  预设模板: [经典] [现代] [紧凑] [我的模板 ▼]            │
// ├─────────────────────────────────────────────────────────┤
// │  ┌─────────────┐  ┌──────────────────────────────────┐  │
// │  │ 设置面板    │  │                                  │  │
// │  │ ├─ 页面     │  │         实时预览区域             │  │
// │  │ ├─ 表头     │  │                                  │  │
// │  │ ├─ 信息区   │  │                                  │  │
// │  │ ├─ 表格     │  │                                  │  │
// │  │ ├─ 汇总     │  │                                  │  │
// │  │ ├─ 页脚     │  │                                  │  │
// │  │ └─ 签名区   │  │                                  │  │
// │  └─────────────┘  └──────────────────────────────────┘  │
// ├─────────────────────────────────────────────────────────┤
// │  [保存模板] [另存为...] [重置]    [取消] [应用并打印]   │
// └─────────────────────────────────────────────────────────┘
```

#### 3.2.5 样式存储服务

```typescript
// lib/services/print-template-service.ts

/**
 * 打印模板存储（使用 localStorage + 可选服务端同步）
 */
export class PrintTemplateService {
  private static STORAGE_KEY = 'print_templates';

  // 获取所有已保存模板
  static getTemplates(documentType?: string): PrintStyleConfig[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    const templates = stored ? JSON.parse(stored) : [];
    return documentType
      ? templates.filter(
          (t: PrintStyleConfig) => t.documentType === documentType
        )
      : templates;
  }

  // 保存模板
  static saveTemplate(config: PrintStyleConfig): string {
    const templates = this.getTemplates();
    const id = config.id || `tpl_${Date.now()}`;
    const index = templates.findIndex((t: PrintStyleConfig) => t.id === id);

    const newConfig = { ...config, id, updatedAt: new Date().toISOString() };

    if (index >= 0) {
      templates[index] = newConfig;
    } else {
      templates.push(newConfig);
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(templates));
    return id;
  }

  // 删除模板
  static deleteTemplate(id: string): void {
    const templates = this.getTemplates().filter(
      (t: PrintStyleConfig) => t.id !== id
    );
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(templates));
  }

  // 获取默认模板（上次使用的）
  static getDefaultTemplate(documentType: string): PrintStyleConfig | null {
    const key = `print_default_${documentType}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  }

  // 设置默认模板
  static setDefaultTemplate(
    documentType: string,
    config: PrintStyleConfig
  ): void {
    const key = `print_default_${documentType}`;
    localStorage.setItem(key, JSON.stringify(config));
  }
}
```

#### 3.2.6 销售订单字段配置示例

```typescript
// lib/config/print/sales-order-fields.ts
export const SALES_ORDER_PRINT_FIELDS: PrintFieldDefinition[] = [
  // 表头字段
  { key: 'orderNumber', label: '订单号', type: 'header', defaultVisible: true },
  {
    key: 'customerName',
    label: '客户名称',
    type: 'header',
    defaultVisible: true,
  },
  {
    key: 'customerPhone',
    label: '客户电话',
    type: 'header',
    defaultVisible: true,
  },
  {
    key: 'customerAddress',
    label: '送货地址',
    type: 'header',
    defaultVisible: true,
  },
  { key: 'createdAt', label: '下单日期', type: 'header', defaultVisible: true },
  {
    key: 'salesperson',
    label: '销售员',
    type: 'header',
    defaultVisible: false,
  },

  // 明细字段
  { key: 'productName', label: '产品名称', type: 'item', defaultVisible: true },
  { key: 'productCode', label: '产品编码', type: 'item', defaultVisible: true },
  { key: 'specification', label: '规格', type: 'item', defaultVisible: true },
  { key: 'colorCode', label: '色号', type: 'item', defaultVisible: false },
  { key: 'batchNumber', label: '批次号', type: 'item', defaultVisible: false },
  {
    key: 'quantity',
    label: '数量',
    type: 'item',
    align: 'right',
    defaultVisible: true,
  },
  { key: 'unit', label: '单位', type: 'item', defaultVisible: true },
  {
    key: 'unitPrice',
    label: '单价',
    type: 'item',
    align: 'right',
    defaultVisible: true,
  },
  {
    key: 'subtotal',
    label: '小计',
    type: 'item',
    align: 'right',
    defaultVisible: true,
  },
  { key: 'remarks', label: '备注', type: 'item', defaultVisible: false },

  // 汇总字段
  {
    key: 'itemsAmount',
    label: '产品合计',
    type: 'summary',
    defaultVisible: true,
  },
  {
    key: 'additionalFees',
    label: '额外费用',
    type: 'summary',
    defaultVisible: true,
  },
  {
    key: 'roundingAdjustment',
    label: '抹零',
    type: 'summary',
    defaultVisible: false,
  },
  {
    key: 'totalAmount',
    label: '应收金额',
    type: 'summary',
    defaultVisible: true,
  },
  {
    key: 'totalAmountChinese',
    label: '大写金额',
    type: 'summary',
    defaultVisible: true,
  },
];
```

#### 3.2.4 PrintService 服务

```typescript
// lib/services/print-service.ts
export class PrintService {
  // HTML 打印（主方案）
  static print(elementId: string): void {
    window.print();
  }

  // PDF 导出（备选方案）
  static async exportToPDF(
    element: HTMLElement,
    filename: string,
    options?: PDFExportOptions
  ): Promise<void> {
    const html2canvas = await loadHtml2canvas();
    const { jsPDF } = await import('jspdf');

    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    const pdf = new jsPDF({
      orientation: options?.orientation || 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // A4 尺寸处理
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth * ratio, imgHeight * ratio);
    pdf.save(filename);
  }
}
```

### 3.3 @media print CSS 规则

```css
/* globals.css 新增 */

@media print {
  /* 隐藏非打印元素 */
  .no-print,
  nav,
  header,
  footer,
  .sidebar,
  .actions,
  button:not(.print-include) {
    display: none !important;
  }

  /* 打印区域全屏 */
  .print-container {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
  }

  /* A4 横向页面设置 */
  @page {
    size: A4 landscape;
    margin: 10mm;
  }

  /* 表格跨页处理 */
  table {
    page-break-inside: auto;
  }

  tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }

  thead {
    display: table-header-group;
  }

  tfoot {
    display: table-footer-group;
  }

  /* 强制背景色打印 */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* 避免元素被截断 */
  .avoid-break {
    page-break-inside: avoid;
  }
}
```

### 3.4 打印预览对话框

```typescript
// components/print/PrintPreviewDialog.tsx
interface PrintPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: 'sales-order' | 'purchase-order' | 'factory-shipment';
  data: any;
  onPrint: () => void;
  onExportPDF: () => void;
}

// 功能：
// - 字段选择器（勾选要打印的字段）
// - 实时预览
// - 打印按钮
// - 导出 PDF 按钮
```

---

## 4. 实施计划

### 4.1 Phase 1: 基础设施 (3天)

| 任务                  | 文件                                     | 工作量 |
| --------------------- | ---------------------------------------- | ------ |
| 创建 PrintLayout 组件 | `components/print/PrintLayout.tsx`       | 0.5天  |
| 添加 @media print CSS | `app/globals.css`                        | 0.25天 |
| 创建 PrintService     | `lib/services/print-service.ts`          | 0.5天  |
| 创建字段配置类型      | `lib/types/print-config.ts`              | 0.25天 |
| **创建样式配置类型**  | `lib/types/print-style.ts`               | 0.5天  |
| **创建样式存储服务**  | `lib/services/print-template-service.ts` | 0.5天  |
| 安装 jsPDF 依赖       | `package.json`                           | 0.1天  |
| 删除重复 Hook         | 删除 `use-export-to-image.ts`            | 0.25天 |

### 4.2 Phase 2: DIY 样式编辑器 (2.5天)

| 任务                 | 文件                                                  | 工作量 |
| -------------------- | ----------------------------------------------------- | ------ |
| 创建样式编辑器主组件 | `components/print/StyleEditor.tsx`                    | 1天    |
| 页面设置面板         | `components/print/style-panels/PageSettings.tsx`      | 0.25天 |
| 表头设置面板         | `components/print/style-panels/HeaderSettings.tsx`    | 0.25天 |
| 表格设置面板         | `components/print/style-panels/TableSettings.tsx`     | 0.25天 |
| 签名区设置面板       | `components/print/style-panels/SignatureSettings.tsx` | 0.25天 |
| 预设模板切换         | `components/print/PresetSelector.tsx`                 | 0.25天 |
| 模板管理对话框       | `components/print/TemplateManager.tsx`                | 0.25天 |

### 4.3 Phase 3: 销售订单打印 (2天)

| 任务               | 文件                                      | 工作量 |
| ------------------ | ----------------------------------------- | ------ |
| 重构现有打印模板   | `SalesOrderPrintTemplate.tsx`             | 0.5天  |
| 创建字段配置       | `lib/config/print/sales-order-fields.ts`  | 0.25天 |
| 创建打印预览对话框 | `components/print/PrintPreviewDialog.tsx` | 0.75天 |
| 创建字段选择器     | `components/print/FieldSelector.tsx`      | 0.5天  |

### 4.4 Phase 4: 采购订单打印 (1.5天)

| 任务                 | 文件                                              | 工作量 |
| -------------------- | ------------------------------------------------- | ------ |
| 创建采购订单字段配置 | `lib/config/print/purchase-order-fields.ts`       | 0.25天 |
| 创建采购订单打印模板 | `components/print/PurchaseOrderPrintTemplate.tsx` | 0.75天 |
| 集成到采购订单详情页 | `app/(dashboard)/purchase-orders/[id]/page.tsx`   | 0.5天  |

### 4.5 Phase 5: 厂家发货打印 (1.5天)

| 任务                 | 文件                                                | 工作量 |
| -------------------- | --------------------------------------------------- | ------ |
| 创建厂家发货字段配置 | `lib/config/print/factory-shipment-fields.ts`       | 0.25天 |
| 创建厂家发货打印模板 | `components/print/FactoryShipmentPrintTemplate.tsx` | 0.75天 |
| 集成到厂家发货详情页 | `app/(dashboard)/factory-shipments/[id]/page.tsx`   | 0.5天  |

### 4.6 Phase 6: 测试与文档 (1.5天)

| 任务                    | 工作量 |
| ----------------------- | ------ |
| 单元测试（≥80% 覆盖率） | 0.5天  |
| E2E 测试（Playwright）  | 0.5天  |
| 使用文档                | 0.5天  |

**总工期**: 12 天（含 DIY 样式编辑器）

---

## 5. MCP 最佳实践对照

### 5.1 Context7 - 文档查阅

| 库/框架     | 查阅内容               | 状态      |
| ----------- | ---------------------- | --------- |
| jsPDF       | API 使用、中文字体支持 | ⏳ 待查   |
| html2canvas | 高级配置、性能优化     | ✅ 已了解 |
| React       | Portal 用于打印预览    | ✅ 已了解 |

### 5.2 Magic - UI 组件

| 组件     | 用途           | 状态    |
| -------- | -------------- | ------- |
| Dialog   | 打印预览对话框 | ✅ 已有 |
| Checkbox | 字段选择器     | ✅ 已有 |
| Button   | 打印/导出按钮  | ✅ 已有 |

### 5.3 Playwright - E2E 测试

```typescript
// 测试场景
test('销售订单打印预览', async ({ page }) => {
  await page.goto('/sales-orders/xxx');
  await page.click('[data-testid="print-button"]');
  await expect(page.locator('.print-preview')).toBeVisible();
  // 验证字段选择器
  // 验证打印内容
});
```

---

## 6. 风险与回滚

### 6.1 技术风险

| 风险               | 影响 | 缓解措施                               |
| ------------------ | ---- | -------------------------------------- |
| 浏览器打印差异     | 中   | 测试主流浏览器（Chrome、Edge、Safari） |
| PDF 中文乱码       | 中   | 使用 html2canvas 渲染而非直接 PDF 字体 |
| 大订单分页问题     | 低   | CSS page-break 规则处理                |
| html2canvas 渲染慢 | 低   | 添加加载状态，限制渲染范围             |

### 6.2 回滚策略

1. **代码回滚**: Git 分支策略，每个 Phase 一个 commit
2. **功能开关**: 通过环境变量控制新功能启用
3. **兼容旧版**: 保留现有 SalesOrderPrintTemplate 直到新版稳定

```typescript
// lib/env.ts
export const featureFlags = {
  enableNewPrintSystem: process.env.ENABLE_NEW_PRINT === 'true',
};
```

---

## 7. 文件清单

### 7.1 新增文件

```
components/print/
├── PrintLayout.tsx                # 打印布局容器
├── PrintPreviewDialog.tsx         # 打印预览对话框
├── FieldSelector.tsx              # 字段选择器
├── PrintButton.tsx                # 打印按钮组件
├── StyleEditor.tsx                # DIY 样式编辑器主组件
├── PresetSelector.tsx             # 预设模板选择器
├── TemplateManager.tsx            # 模板管理对话框
├── style-panels/                  # 样式设置面板目录
│   ├── PageSettings.tsx           # 页面设置
│   ├── HeaderSettings.tsx         # 表头设置
│   ├── InfoSectionSettings.tsx    # 信息区设置
│   ├── TableSettings.tsx          # 表格设置
│   ├── SummarySettings.tsx        # 汇总区设置
│   ├── FooterSettings.tsx         # 页脚设置
│   └── SignatureSettings.tsx      # 签名区设置
├── templates/                     # 打印模板目录
│   ├── SalesOrderPrintTemplate.tsx    # 销售订单模板（重构）
│   ├── PurchaseOrderPrintTemplate.tsx # 采购订单模板（新建）
│   └── FactoryShipmentPrintTemplate.tsx # 厂家发货模板（新建）
└── index.ts                       # 统一导出

lib/config/print/
├── index.ts                  # 配置导出
├── default-style.ts          # 默认样式配置
├── preset-styles.ts          # 预设样式模板
├── sales-order-fields.ts     # 销售订单字段配置
├── purchase-order-fields.ts  # 采购订单字段配置
└── factory-shipment-fields.ts # 厂家发货字段配置

lib/types/
├── print-config.ts           # 打印字段配置类型
└── print-style.ts            # DIY 样式配置类型

lib/services/
├── print-service.ts          # 打印服务（新建）
└── print-template-service.ts # 模板存储服务（新建）

hooks/
├── use-print.ts              # 打印 Hook
└── use-print-style.ts        # 样式管理 Hook
```

### 7.2 修改文件

```
app/globals.css               # 添加 @media print 规则
lib/services/export-service.ts # 添加 jsPDF 集成
package.json                  # 添加 jspdf 依赖
```

### 7.3 删除文件

```
hooks/use-export-to-image.ts  # 功能重复，合并到 export-service
```

---

## 8. 验收标准

### 8.1 功能验收

- [ ] 销售订单可打印/导出 PDF
- [ ] 采购订单可打印/导出 PDF
- [ ] 厂家发货可打印/导出 PDF
- [ ] 字段可自定义选择
- [ ] **DIY 样式编辑器可用**
- [ ] **预设模板（经典/现代/紧凑）可切换**
- [ ] **自定义模板可保存/加载**
- [ ] **表头样式可自定义（Logo、公司名、字体）**
- [ ] **表格样式可自定义（边框、颜色、斑马纹）**
- [ ] **签名区可配置**
- [ ] 打印预览正常显示
- [ ] A4/A5/Letter 布局正确
- [ ] 横向/纵向切换正常
- [ ] 表格跨页时表头重复
- [ ] 中文大写金额正确显示

### 8.2 质量验收

- [ ] ESLint 无错误
- [ ] TypeScript 无类型错误
- [ ] 测试覆盖率 ≥ 80%
- [ ] Chrome/Edge/Safari 兼容
- [ ] 构建成功

---

## 9. 总结

### 9.1 选型结论

| 维度     | 决策                                 |
| -------- | ------------------------------------ |
| 主方案   | HTML + @media print + window.print() |
| 备选方案 | html2canvas + jsPDF                  |
| UI 框架  | 复用现有 shadcn/ui 组件              |
| 状态管理 | React Hook + Context                 |

### 9.2 工作量估算

| 阶段                    | 工作量    |
| ----------------------- | --------- |
| Phase 1: 基础设施       | 3 天      |
| Phase 2: DIY 样式编辑器 | 2.5 天    |
| Phase 3: 销售订单打印   | 2 天      |
| Phase 4: 采购订单打印   | 1.5 天    |
| Phase 5: 厂家发货打印   | 1.5 天    |
| Phase 6: 测试文档       | 1.5 天    |
| **总计**                | **12 天** |

### 9.3 后续优化（可选）

- 批量打印支持
- 打印模板编辑器
- 自定义公司 Logo/抬头
- 多语言支持
- 打印日志记录

---

**调研执行人**: Claude Code Assistant
**最终状态**: ✅ **调研完成，方案可实施**
