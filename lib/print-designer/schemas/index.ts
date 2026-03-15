/**
 * 打印设计器 - Schema 导出入口
 *
 * 统一导出所有 Schema 和类型
 */

// Base types
export {
  BaseElementSchema,
  ElementTypeSchema,
  FontFamilySchema,
  FontStyleSchema,
  FontWeightSchema,
  HexColorSchema,
  PositionSchema,
  SizeSchema,
  TextAlignSchema,
  type BaseElement,
  type ElementType,
  type FontFamily,
  type FontStyle,
  type FontWeight,
  type Position,
  type Size,
  type TextAlign,
} from './base';

// Text element
export {
  TextElementSchema,
  TextStyleSchema,
  createDefaultTextElement,
  type TextElement,
  type TextStyle,
} from './text-element';

// Placeholder element
export {
  PlaceholderElementSchema,
  PlaceholderFormatSchema,
  createDefaultPlaceholderElement,
  type PlaceholderElement,
  type PlaceholderFormat,
} from './placeholder-element';

// Table element
export {
  ColumnFormatSchema,
  TableColumnSchema,
  TableElementSchema,
  TableStyleSchema,
  WidthUnitSchema,
  createTableColumn,
  createTableColumnId,
  createDefaultTableElement,
  ensureTableColumnIds,
  getTableColumnReactKey,
  type ColumnFormat,
  type TableColumn,
  type TableElement,
  type TableStyle,
  type WidthUnit,
} from './table-element';

// Visual elements
export {
  BarcodeElementSchema,
  BarcodeFormatSchema,
  ImageElementSchema,
  ImageFitSchema,
  createDefaultBarcodeElement,
  createDefaultImageElement,
  type BarcodeElement,
  type BarcodeFormat,
  type ImageElement,
  type ImageFit,
} from './visual-elements';

// Template
export {
  DesignElementSchema,
  OrientationSchema,
  PageSettingsSchema,
  PaperSizeSchema,
  PrintTemplateSchema,
  TemplateTypeSchema,
  createEmptyTemplate,
  getPaperDimensions,
  type DesignElement,
  type Orientation,
  type PageSettings,
  type PaperSize,
  type PrintTemplate,
  type TemplateType,
} from './template';
