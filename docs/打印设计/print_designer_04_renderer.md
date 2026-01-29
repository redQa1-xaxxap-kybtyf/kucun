# 04 - 元素渲染器实现指南

> 本文档定义如何将模板 JSON 渲染为可打印的 DOM/PDF。

---

## 1. 渲染器架构

### 1.1 核心原则

- **纯净渲染**: `PrintCanvas` 组件只负责渲染，不包含任何交互逻辑。
- **复用**: 编辑器预览和实际打印都使用同一个渲染器。
- **数据驱动**: 渲染器接收 `template` + `data`，输出 DOM。

### 1.2 组件结构

```
components/print-designer/renderer/
├── PrintCanvas.tsx       # 画布容器
├── ElementRenderer.tsx   # 元素分发器
├── elements/
│   ├── TextRenderer.tsx
│   ├── PlaceholderRenderer.tsx
│   ├── TableRenderer.tsx
│   ├── ImageRenderer.tsx
│   └── BarcodeRenderer.tsx
├── utils/
│   ├── data-binder.ts    # 数据绑定解析
│   ├── formatters.ts     # 格式化函数
│   └── unit-converter.ts # mm <-> px 转换
└── index.ts
```

---

## 2. 核心实现

### 2.1 PrintCanvas (画布容器)

```typescript
// components/print-designer/renderer/PrintCanvas.tsx
import { type PrintTemplate, type DesignElement } from '@/lib/print-designer/schemas';
import { ElementRenderer } from './ElementRenderer';
import { mmToPx } from './utils/unit-converter';

interface PrintCanvasProps {
  template: PrintTemplate;
  data: Record<string, any>;
  scale?: number; // 预览时的缩放比例
}

export function PrintCanvas({ template, data, scale = 1 }: PrintCanvasProps) {
  const { pageSettings, elements } = template;

  const pageStyle: React.CSSProperties = {
    width: mmToPx(pageSettings.width) * scale,
    height: mmToPx(pageSettings.height) * scale,
    padding: pageSettings.padding.map(p => `${mmToPx(p) * scale}px`).join(' '),
    backgroundColor: '#ffffff',
    position: 'relative',
    boxSizing: 'border-box',
    // 打印时隐藏的辅助元素
    '@media print': {
      boxShadow: 'none',
    },
  };

  return (
    <div className="print-canvas" style={pageStyle}>
      {elements
        .filter(el => el.visible)
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((element) => (
          <ElementRenderer
            key={element.id}
            element={element}
            data={data}
            scale={scale}
          />
        ))}
    </div>
  );
}
```

### 2.2 ElementRenderer (元素分发器)

```typescript
// components/print-designer/renderer/ElementRenderer.tsx
import { type DesignElement } from '@/lib/print-designer/schemas';
import { TextRenderer } from './elements/TextRenderer';
import { PlaceholderRenderer } from './elements/PlaceholderRenderer';
import { TableRenderer } from './elements/TableRenderer';
import { ImageRenderer } from './elements/ImageRenderer';
import { BarcodeRenderer } from './elements/BarcodeRenderer';
import { mmToPx } from './utils/unit-converter';

interface ElementRendererProps {
  element: DesignElement;
  data: Record<string, any>;
  scale: number;
}

export function ElementRenderer({ element, data, scale }: ElementRendererProps) {
  const wrapperStyle: React.CSSProperties = {
    position: 'absolute',
    left: mmToPx(element.position.x) * scale,
    top: mmToPx(element.position.y) * scale,
    width: mmToPx(element.size.width) * scale,
    height: mmToPx(element.size.height) * scale,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
  };

  const renderElement = () => {
    switch (element.type) {
      case 'text':
        return <TextRenderer element={element} scale={scale} />;
      case 'placeholder':
        return <PlaceholderRenderer element={element} data={data} scale={scale} />;
      case 'table':
        return <TableRenderer element={element} data={data} scale={scale} />;
      case 'image':
        return <ImageRenderer element={element} data={data} scale={scale} />;
      case 'barcode':
        return <BarcodeRenderer element={element} data={data} scale={scale} />;
      default:
        return null;
    }
  };

  return <div style={wrapperStyle}>{renderElement()}</div>;
}
```

---

## 3. 各类型渲染器

### 3.1 文本渲染器

```typescript
// components/print-designer/renderer/elements/TextRenderer.tsx
import { type TextElement } from '@/lib/print-designer/schemas';

interface Props {
  element: TextElement;
  scale: number;
}

export function TextRenderer({ element, scale }: Props) {
  const style: React.CSSProperties = {
    fontFamily: element.style.fontFamily,
    fontSize: element.style.fontSize * scale,
    fontWeight: element.style.fontWeight,
    fontStyle: element.style.fontStyle,
    color: element.style.color,
    textAlign: element.style.textAlign,
    lineHeight: element.style.lineHeight,
    letterSpacing: element.style.letterSpacing * scale,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };

  return <div style={style}>{element.content}</div>;
}
```

### 3.2 占位符渲染器 (数据绑定)

```typescript
// components/print-designer/renderer/elements/PlaceholderRenderer.tsx
import { type PlaceholderElement } from '@/lib/print-designer/schemas';
import { getNestedValue } from '../utils/data-binder';
import { formatValue } from '../utils/formatters';

interface Props {
  element: PlaceholderElement;
  data: Record<string, any>;
  scale: number;
}

export function PlaceholderRenderer({ element, data, scale }: Props) {
  // 解析数据路径
  const rawValue = getNestedValue(data, element.field);

  // 格式化
  const displayValue = rawValue != null
    ? formatValue(rawValue, element.format)
    : element.fallback;

  const style: React.CSSProperties = {
    fontFamily: element.style.fontFamily,
    fontSize: element.style.fontSize * scale,
    fontWeight: element.style.fontWeight,
    color: element.style.color,
    textAlign: element.style.textAlign,
    width: '100%',
    height: '100%',
  };

  return <div style={style}>{displayValue}</div>;
}
```

### 3.3 表格渲染器

```typescript
// components/print-designer/renderer/elements/TableRenderer.tsx
import { type TableElement } from '@/lib/print-designer/schemas';
import { getNestedValue } from '../utils/data-binder';
import { formatValue } from '../utils/formatters';

interface Props {
  element: TableElement;
  data: Record<string, any>;
  scale: number;
}

export function TableRenderer({ element, data, scale }: Props) {
  const items = getNestedValue(data, element.dataSource) || [];
  const { columns, style: tableStyle, showSummary, summaryColumns, minRows } = element;

  // 计算需要填充的空行
  const emptyRowsCount = minRows ? Math.max(0, minRows - items.length) : 0;
  const displayItems = [...items, ...Array(emptyRowsCount).fill({})];

  // 计算合计
  const summaryData: Record<string, number> = {};
  if (showSummary && summaryColumns) {
    summaryColumns.forEach((colKey) => {
      summaryData[colKey] = items.reduce((sum, item) => {
        const val = getNestedValue(item, colKey);
        return sum + (typeof val === 'number' ? val : 0);
      }, 0);
    });
  }

  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: tableStyle.bodyFontSize * scale,
      }}
    >
      <thead>
        <tr style={{ backgroundColor: tableStyle.headerBgColor }}>
          {columns.map((col) => (
            <th
              key={col.key}
              style={{
                border: `${tableStyle.borderWidth}px solid ${tableStyle.borderColor}`,
                padding: `${2 * scale}px`,
                textAlign: col.align,
                fontSize: tableStyle.headerFontSize * scale,
                color: tableStyle.headerTextColor,
                width: col.widthUnit === '%' ? `${col.width}%` : `${col.width * scale}px`,
              }}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {displayItems.map((item, rowIndex) => (
          <tr
            key={rowIndex}
            style={{
              backgroundColor: tableStyle.stripedRows && rowIndex % 2 === 1
                ? tableStyle.stripedColor
                : undefined,
              height: tableStyle.rowHeight * scale,
            }}
          >
            {columns.map((col) => (
              <td
                key={col.key}
                style={{
                  border: `${tableStyle.borderWidth}px solid ${tableStyle.borderColor}`,
                  padding: `${2 * scale}px`,
                  textAlign: col.align,
                }}
              >
                {formatValue(getNestedValue(item, col.key), col.format)}
              </td>
            ))}
          </tr>
        ))}
        {showSummary && (
          <tr style={{ fontWeight: 'bold', backgroundColor: tableStyle.headerBgColor }}>
            {columns.map((col, idx) => (
              <td
                key={col.key}
                style={{
                  border: `${tableStyle.borderWidth}px solid ${tableStyle.borderColor}`,
                  padding: `${2 * scale}px`,
                  textAlign: col.align,
                }}
              >
                {idx === 0
                  ? '合计'
                  : summaryColumns?.includes(col.key)
                    ? formatValue(summaryData[col.key], col.format)
                    : ''}
              </td>
            ))}
          </tr>
        )}
      </tbody>
    </table>
  );
}
```

---

## 4. 工具函数

### 4.1 数据绑定

```typescript
// components/print-designer/renderer/utils/data-binder.ts

/**
 * 安全获取嵌套属性值
 * @example getNestedValue({ order: { no: '123' } }, 'order.no') => '123'
 */
export function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}
```

### 4.2 格式化函数

```typescript
// components/print-designer/renderer/utils/formatters.ts

/**
 * 格式化值
 */
export function formatValue(value: any, format: string): string {
  if (value == null) return '';

  switch (format) {
    case 'date_cn':
      return formatDateCn(value);
    case 'currency':
      return formatCurrency(value);
    case 'currency_cap':
      return numberToChineseCurrency(value);
    case 'number':
      return typeof value === 'number'
        ? value.toLocaleString('zh-CN')
        : String(value);
    default:
      return String(value);
  }
}

function formatDateCn(value: string | Date): string {
  const date = new Date(value);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatCurrency(value: number): string {
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
}

/**
 * 人民币大写转换
 */
export function numberToChineseCurrency(num: number): string {
  const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const units = ['', '拾', '佰', '仟'];
  const bigUnits = ['', '万', '亿'];
  const decimalUnits = ['角', '分'];

  if (num === 0) return '零元整';

  const [intPart, decPart] = Math.abs(num).toFixed(2).split('.');
  let result = '';

  // 整数部分
  const intStr = intPart.padStart(Math.ceil(intPart.length / 4) * 4, '0');
  for (let i = 0; i < intStr.length; i += 4) {
    const section = intStr.slice(i, i + 4);
    let sectionResult = '';
    for (let j = 0; j < 4; j++) {
      const digit = parseInt(section[j]);
      if (digit !== 0) {
        sectionResult += digits[digit] + units[3 - j];
      } else if (sectionResult && !sectionResult.endsWith('零')) {
        sectionResult += '零';
      }
    }
    if (sectionResult) {
      result += sectionResult + bigUnits[(intStr.length - i) / 4 - 1];
    }
  }
  result = result.replace(/零+$/, '') + '元';

  // 小数部分
  if (decPart === '00') {
    result += '整';
  } else {
    for (let i = 0; i < 2; i++) {
      const digit = parseInt(decPart[i]);
      if (digit !== 0) {
        result += digits[digit] + decimalUnits[i];
      }
    }
  }

  return (num < 0 ? '负' : '') + result;
}
```

### 4.3 单位转换

```typescript
// components/print-designer/renderer/utils/unit-converter.ts

const DPI = 96; // 标准屏幕 DPI
const MM_PER_INCH = 25.4;

/**
 * 毫米转像素
 */
export function mmToPx(mm: number): number {
  return (mm / MM_PER_INCH) * DPI;
}

/**
 * 像素转毫米
 */
export function pxToMm(px: number): number {
  return (px / DPI) * MM_PER_INCH;
}
```

---

## 5. 使用示例

```tsx
import { PrintCanvas } from '@/components/print-designer/renderer';

// 打印预览
<PrintCanvas
  template={savedTemplate}
  data={{
    order: { orderNumber: 'SO-2026-001', createdAt: '2026-01-13' },
    customer: { name: '张三', phone: '13800000000' },
    items: [
      { name: '瓷砖A', quantity: 100, unitPrice: 50, subtotal: 5000 },
      { name: '瓷砖B', quantity: 200, unitPrice: 30, subtotal: 6000 },
    ],
    totalAmount: 11000,
  }}
  scale={0.8} // 预览缩小
/>;
```
