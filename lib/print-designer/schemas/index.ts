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
  FooterNoteStyleSchema,
  RowNumberModeSchema,
  TableColumnSchema,
  TableBorderModeSchema,
  TableElementSchema,
  TableStyleSchema,
  TitleBarStyleSchema,
  WidthUnitSchema,
  createTableColumn,
  createTableColumnId,
  createDefaultTableElement,
  ensureTableColumnIds,
  getTableColumnReactKey,
  type ColumnFormat,
  type FooterNoteStyle,
  type RowNumberMode,
  type TableBorderMode,
  type TableColumn,
  type TableElement,
  type TableStyle,
  type TitleBarStyle,
  type WidthUnit,
} from './table-element';

// Visual elements
export {
  BarcodeElementSchema,
  BarcodeFormatSchema,
  DashStyleSchema,
  ImageElementSchema,
  ImageFitSchema,
  LineElementSchema,
  LineStyleSchema,
  RectElementSchema,
  RectStyleSchema,
  createDefaultBarcodeElement,
  createDefaultImageElement,
  createDefaultLineElement,
  createDefaultRectElement,
  type BarcodeElement,
  type BarcodeFormat,
  type DashStyle,
  type ImageElement,
  type ImageFit,
  type LineElement,
  type LineStyle,
  type RectElement,
  type RectStyle,
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
