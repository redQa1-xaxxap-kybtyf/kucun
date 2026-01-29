# 01 - 数据结构与 Schema 设计

> 本文档为 `print_designer_spec.md` 的细节补充，定义模板数据的完整类型系统。

---

## 1. 设计原则

- **单一数据源**: 模板 JSON 是唯一真理，UI 和打印渲染均驱动自此。
- **前后端共享**: 使用 `Zod` 定义 Schema，确保类型与运行时校验一致。
- **可扩展**: 采用 `discriminatedUnion` 设计元素类型，方便未来新增。

---

## 2. 完整 Schema 定义

### 2.1 基础类型

```typescript
// lib/print-designer/schemas/base.ts
import { z } from 'zod';

/** 位置 (单位: mm) */
export const PositionSchema = z.object({
  x: z.number().describe('水平位置 (mm)'),
  y: z.number().describe('垂直位置 (mm)'),
});

/** 尺寸 (单位: mm) */
export const SizeSchema = z.object({
  width: z.number().min(1).describe('宽度 (mm)'),
  height: z.number().min(1).describe('高度 (mm)'),
});

/** 通用样式 */
export const BaseStyleSchema = z.object({
  backgroundColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  borderWidth: z.number().min(0).optional(),
  borderColor: z.string().optional(),
  borderRadius: z.number().min(0).optional(),
});

/** 基础元素 */
export const BaseElementSchema = z.object({
  id: z.string().uuid(),
  type: z.string(), // 将在子类型中收窄
  position: PositionSchema,
  size: SizeSchema,
  rotation: z.number().min(0).max(360).default(0),
  zIndex: z.number().int().default(0),
  locked: z.boolean().default(false),
  visible: z.boolean().default(true),
});
```

### 2.2 文本元素

```typescript
// lib/print-designer/schemas/text-element.ts
import { z } from 'zod';
import { BaseElementSchema } from './base';

export const TextStyleSchema = z.object({
  fontFamily: z.enum([
    'SimSun',
    'SimHei',
    'Microsoft YaHei',
    'Arial',
    'Times New Roman',
  ]),
  fontSize: z.number().min(6).max(200).describe('字号 (pt)'),
  fontWeight: z.enum(['normal', 'bold']),
  fontStyle: z.enum(['normal', 'italic']).default('normal'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  textAlign: z.enum(['left', 'center', 'right']),
  lineHeight: z.number().min(1).max(3).default(1.2),
  letterSpacing: z.number().min(-2).max(10).default(0).describe('字间距 (pt)'),
});

export const TextElementSchema = BaseElementSchema.extend({
  type: z.literal('text'),
  content: z.string().max(5000),
  style: TextStyleSchema,
});

export type TextElement = z.infer<typeof TextElementSchema>;
```

### 2.3 占位符元素 (数据绑定)

```typescript
// lib/print-designer/schemas/placeholder-element.ts
import { z } from 'zod';
import { BaseElementSchema, BaseStyleSchema } from './base';
import { TextStyleSchema } from './text-element';

export const PlaceholderFormatSchema = z.enum([
  'text', // 原样输出
  'date_cn', // YYYY年MM月DD日
  'currency', // 1,234.56
  'currency_cap', // 壹仟贰佰叁拾肆元伍角陆分
  'number', // 数字保留小数
]);

export const PlaceholderElementSchema = BaseElementSchema.extend({
  type: z.literal('placeholder'),
  /** 数据路径, 如 'order.customer.name' */
  field: z.string().min(1),
  /** 显示标签 (编辑时显示) */
  label: z.string(),
  /** 格式化类型 */
  format: PlaceholderFormatSchema.default('text'),
  /** 空值时的默认显示 */
  fallback: z.string().default('-'),
  /** 文本样式 */
  style: TextStyleSchema,
});

export type PlaceholderElement = z.infer<typeof PlaceholderElementSchema>;
```

### 2.4 表格元素

```typescript
// lib/print-designer/schemas/table-element.ts
import { z } from 'zod';
import { BaseElementSchema } from './base';

export const TableColumnSchema = z.object({
  key: z.string().describe('数据字段名'),
  label: z.string().describe('列标题'),
  width: z.number().min(5).describe('列宽 (mm 或 %)'),
  widthUnit: z.enum(['mm', '%']).default('%'),
  align: z.enum(['left', 'center', 'right']).default('left'),
  format: z.enum(['text', 'number', 'currency', 'date_cn']).default('text'),
});

export const TableStyleSchema = z.object({
  headerBgColor: z.string().default('#f5f5f5'),
  headerTextColor: z.string().default('#333333'),
  headerFontSize: z.number().default(10),
  bodyFontSize: z.number().default(9),
  borderColor: z.string().default('#cccccc'),
  borderWidth: z.number().default(0.5),
  rowHeight: z.number().default(6).describe('行高 (mm)'),
  stripedRows: z.boolean().default(false),
  stripedColor: z.string().default('#fafafa'),
});

export const TableElementSchema = BaseElementSchema.extend({
  type: z.literal('table'),
  /** 数据源路径, 通常为 'items' */
  dataSource: z.string().default('items'),
  columns: z.array(TableColumnSchema).min(1),
  style: TableStyleSchema,
  /** 是否显示合计行 */
  showSummary: z.boolean().default(false),
  /** 合计行配置 (哪些列求和) */
  summaryColumns: z.array(z.string()).optional(),
  /** 自动填充空行到固定行数 (用于套打) */
  minRows: z.number().min(0).optional(),
});

export type TableElement = z.infer<typeof TableElementSchema>;
```

### 2.5 图片与条码元素

```typescript
// lib/print-designer/schemas/visual-elements.ts
import { z } from 'zod';
import { BaseElementSchema } from './base';

export const ImageElementSchema = BaseElementSchema.extend({
  type: z.literal('image'),
  /** 静态 URL 或数据路径 (如 'company.logo') */
  src: z.string(),
  /** 是否为数据绑定 */
  isDynamic: z.boolean().default(false),
  fit: z.enum(['contain', 'cover', 'fill']).default('contain'),
});

export const BarcodeElementSchema = BaseElementSchema.extend({
  type: z.literal('barcode'),
  /** 数据路径 */
  field: z.string(),
  format: z.enum(['CODE128', 'CODE39', 'QR']).default('CODE128'),
  showText: z.boolean().default(true),
});
```

### 2.6 聚合元素类型

```typescript
// lib/print-designer/schemas/index.ts
import { z } from 'zod';
import { TextElementSchema } from './text-element';
import { PlaceholderElementSchema } from './placeholder-element';
import { TableElementSchema } from './table-element';
import { ImageElementSchema, BarcodeElementSchema } from './visual-elements';

export const ElementSchema = z.discriminatedUnion('type', [
  TextElementSchema,
  PlaceholderElementSchema,
  TableElementSchema,
  ImageElementSchema,
  BarcodeElementSchema,
]);

export type DesignElement = z.infer<typeof ElementSchema>;
```

---

## 3. 模板顶层结构

```typescript
// lib/print-designer/schemas/template.ts
import { z } from 'zod';
import { ElementSchema } from './index';

export const PageSettingsSchema = z.object({
  size: z.enum(['A4', 'A5', 'Letter', 'Custom']).default('A4'),
  width: z.number().default(210).describe('mm'),
  height: z.number().default(297).describe('mm'),
  orientation: z.enum(['portrait', 'landscape']).default('portrait'),
  padding: z
    .tuple([
      z.number(), // top
      z.number(), // right
      z.number(), // bottom
      z.number(), // left
    ])
    .default([10, 10, 10, 10]),
});

export const PrintTemplateSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().default(1),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['sales-order', 'purchase-order', 'delivery-note', 'custom']),
  pageSettings: PageSettingsSchema,
  elements: z.array(ElementSchema),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type PrintTemplate = z.infer<typeof PrintTemplateSchema>;
```

---

## 4. 文件组织建议

```
lib/print-designer/
├── schemas/
│   ├── base.ts
│   ├── text-element.ts
│   ├── placeholder-element.ts
│   ├── table-element.ts
│   ├── visual-elements.ts
│   ├── template.ts
│   └── index.ts          # 导出所有
├── utils/
│   ├── format.ts         # 格式化函数 (大写金额等)
│   └── data-binder.ts    # 数据绑定解析
└── index.ts
```

---

## 5. 使用示例

### 5.1 创建新模板

```typescript
import {
  PrintTemplateSchema,
  type PrintTemplate,
} from '@/lib/print-designer/schemas';
import { v4 as uuid } from 'uuid';

const newTemplate: PrintTemplate = {
  id: uuid(),
  version: 1,
  name: '销售发货单',
  type: 'sales-order',
  pageSettings: {
    size: 'A4',
    width: 210,
    height: 297,
    orientation: 'portrait',
    padding: [15, 15, 15, 15],
  },
  elements: [],
};

// 校验
PrintTemplateSchema.parse(newTemplate);
```

### 5.2 后端存储前校验

```typescript
// actions/print-template.ts
import { PrintTemplateSchema } from '@/lib/print-designer/schemas';

export async function saveTemplate(rawData: unknown) {
  // 严格校验，剔除未知字段
  const template = PrintTemplateSchema.parse(rawData);

  await prisma.printTemplate.upsert({
    where: { id: template.id },
    update: { content: template, updatedAt: new Date() },
    create: { ...template, content: template },
  });
}
```
