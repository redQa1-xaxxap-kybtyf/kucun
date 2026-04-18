import type { TableStyle } from './schemas';

export interface TableStylePreset {
  key: 'standard-document' | 'clear-list' | 'thin-grid';
  label: string;
  description: string;
  style: Partial<TableStyle>;
}

export const TABLE_STYLE_PRESETS: TableStylePreset[] = [
  {
    key: 'standard-document',
    label: '标准单据',
    description: '适合订单、送货单、对账单这类常规打印',
    style: {
      headerBgColor: '#f5f5f5',
      headerTextColor: '#1f2937',
      borderColor: '#94a3b8',
      borderWidth: 0.5,
      borderMode: 'full',
      rowHeight: 6.5,
      headerFontSize: 10,
      bodyFontSize: 9,
      stripedRows: false,
      stripedColor: '#fafafa',
    },
  },
  {
    key: 'clear-list',
    label: '清爽明细',
    description: '表头更醒目，适合客户清单和展示型单据',
    style: {
      headerBgColor: '#e8f1fb',
      headerTextColor: '#1d4f91',
      borderColor: '#bfdbfe',
      borderWidth: 0.4,
      borderMode: 'row',
      rowHeight: 7,
      headerFontSize: 10,
      bodyFontSize: 9,
      stripedRows: true,
      stripedColor: '#f8fbff',
    },
  },
  {
    key: 'thin-grid',
    label: '细框套打',
    description: '边框更细，适合纸质单据套打和留空填写',
    style: {
      headerBgColor: '#ffffff',
      headerTextColor: '#111827',
      borderColor: '#94a3b8',
      borderWidth: 0.3,
      borderMode: 'outer',
      rowHeight: 6,
      headerFontSize: 9,
      bodyFontSize: 9,
      stripedRows: false,
      stripedColor: '#ffffff',
    },
  },
];
