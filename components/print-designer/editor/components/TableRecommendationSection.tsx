/**
 * 打印设计器 - 表格整表推荐
 */

'use client';

import type {
  FooterNoteStyle,
  RowNumberMode,
  TableColumn,
  TableStyle,
  TextAlign,
  TitleBarStyle,
} from '@/lib/print-designer/schemas';
import {
  applyTableColumnLabelMode,
  applyTableDocumentLabelPreset,
  createRowNumberTableColumn,
  getDefaultSummaryColumnKeys,
  hasRowNumberColumn,
  rebalanceTableColumnWidths,
  type TableColumnLabelMode,
  type TableDocumentLabelPresetKey,
} from '@/lib/print-designer/table-column-presets';
import { TABLE_STYLE_PRESETS } from '@/lib/print-designer/table-style-presets';

interface TableRecommendationSectionProps {
  columns: TableColumn[];
  onApply: (updates: {
    columns: TableColumn[];
    title: string;
    titleBarStyle: TitleBarStyle;
    titleAlign: TextAlign;
    footerNote: string;
    footerNoteStyle: FooterNoteStyle;
    rowNumberMode: RowNumberMode;
    summaryLabel: string;
    showSummary: boolean;
    summaryColumns: string[];
    minRows: number;
    style: Partial<TableStyle>;
  }) => void;
}

interface TableRecommendationPreset {
  key: 'delivery-piece' | 'statement-piece' | 'loading-item';
  label: string;
  title: string;
  titleBarStyle: TitleBarStyle;
  titleAlign: TextAlign;
  footerNote: string;
  footerNoteStyle: FooterNoteStyle;
  rowNumberMode: RowNumberMode;
  summaryLabel: string;
  minRows: number;
  labelMode: TableColumnLabelMode;
  documentLabelPreset: TableDocumentLabelPresetKey;
  stylePresetKey: 'standard-document' | 'clear-list' | 'thin-grid';
}

const TABLE_RECOMMENDATION_PRESETS: TableRecommendationPreset[] = [
  {
    key: 'delivery-piece',
    label: '送货单常用',
    title: '货品明细',
    titleBarStyle: 'filled',
    titleAlign: 'center',
    footerNote: '请核对品名、规格、数量无误后签收。',
    footerNoteStyle: 'outlined',
    rowNumberMode: 'numeric',
    summaryLabel: '合计',
    minRows: 8,
    labelMode: 'piece',
    documentLabelPreset: 'delivery-note',
    stylePresetKey: 'standard-document',
  },
  {
    key: 'statement-piece',
    label: '对账单常用',
    title: '对账明细',
    titleBarStyle: 'outlined',
    titleAlign: 'center',
    footerNote: '请核对无误后签字盖章回传。',
    footerNoteStyle: 'plain',
    rowNumberMode: 'numeric',
    summaryLabel: '合计',
    minRows: 10,
    labelMode: 'piece',
    documentLabelPreset: 'statement',
    stylePresetKey: 'clear-list',
  },
  {
    key: 'loading-item',
    label: '装车单常用',
    title: '装车明细',
    titleBarStyle: 'filled',
    titleAlign: 'center',
    footerNote: '请按装车顺序核对品名和数量。',
    footerNoteStyle: 'outlined',
    rowNumberMode: 'numeric',
    summaryLabel: '合计',
    minRows: 10,
    labelMode: 'item',
    documentLabelPreset: 'loading-list',
    stylePresetKey: 'thin-grid',
  },
];

function ensureRowNumberColumn(columns: TableColumn[]): TableColumn[] {
  if (hasRowNumberColumn(columns)) {
    return columns;
  }

  return [createRowNumberTableColumn(), ...columns];
}

function resolveStylePreset(
  key: TableRecommendationPreset['stylePresetKey']
): Partial<TableStyle> {
  return TABLE_STYLE_PRESETS.find(preset => preset.key === key)?.style ?? {};
}

export function TableRecommendationSection({
  columns,
  onApply,
}: TableRecommendationSectionProps) {
  const handleApply = (preset: TableRecommendationPreset) => {
    let nextColumns = ensureRowNumberColumn(columns);
    nextColumns = rebalanceTableColumnWidths(nextColumns);
    nextColumns = applyTableColumnLabelMode(nextColumns, preset.labelMode);
    nextColumns = applyTableDocumentLabelPreset(
      nextColumns,
      preset.documentLabelPreset
    );

    onApply({
      columns: nextColumns,
      title: preset.title,
      titleBarStyle: preset.titleBarStyle,
      titleAlign: preset.titleAlign,
      footerNote: preset.footerNote,
      footerNoteStyle: preset.footerNoteStyle,
      rowNumberMode: preset.rowNumberMode,
      summaryLabel: preset.summaryLabel,
      showSummary: true,
      summaryColumns: getDefaultSummaryColumnKeys(nextColumns),
      minRows: preset.minRows,
      style: resolveStylePreset(preset.stylePresetKey),
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
      <div>
        <p className="text-xs font-medium text-slate-900">整表推荐</p>
      </div>

      <div className="grid gap-2">
        {TABLE_RECOMMENDATION_PRESETS.map(preset => (
          <button
            key={preset.key}
            type="button"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-100"
            onClick={() => handleApply(preset)}
          >
            <div className="text-sm font-medium text-slate-900">
              {preset.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
