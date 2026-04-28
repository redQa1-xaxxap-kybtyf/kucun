/**
 * 打印设计器 - 表格规则属性面板
 */

'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type {
  FooterNoteStyle,
  RowNumberMode,
  TableColumn,
  TextAlign,
  TitleBarStyle,
} from '@/lib/print-designer/schemas';
import {
  getDefaultSummaryColumnKeys,
  hasRowNumberColumn,
  isSummaryEligibleColumn,
} from '@/lib/print-designer/table-column-presets';
import {
  getTableFooterNoteQuickOptions,
  getTableMinRowsQuickOptions,
} from '@/lib/print-designer/table-quick-presets';
import { cn } from '@/lib/utils';

interface TableBehaviorSectionProps {
  templateType: string;
  columns: TableColumn[];
  title?: string;
  titleBarStyle?: TitleBarStyle;
  titleAlign?: TextAlign;
  footerNote?: string;
  footerNoteStyle?: FooterNoteStyle;
  rowNumberMode?: RowNumberMode;
  summaryLabel?: string;
  minRows?: number;
  showSummary: boolean;
  summaryColumns?: string[];
  onChange: (updates: {
    title?: string;
    titleBarStyle?: TitleBarStyle;
    titleAlign?: TextAlign;
    footerNote?: string;
    footerNoteStyle?: FooterNoteStyle;
    rowNumberMode?: RowNumberMode;
    summaryLabel?: string;
    minRows?: number;
    showSummary?: boolean;
    summaryColumns?: string[];
  }) => void;
}

const COMMON_TABLE_TITLES = [
  '货品明细',
  '对账明细',
  '费用明细',
  '装车明细',
] as const;

const TITLE_BAR_OPTIONS: Array<{ value: TitleBarStyle; label: string }> = [
  { value: 'plain', label: '简洁标题' },
  { value: 'filled', label: '灰底标题栏' },
  { value: 'outlined', label: '描边标题栏' },
];

const TITLE_ALIGN_OPTIONS: Array<{ value: TextAlign; label: string }> = [
  { value: 'left', label: '居左' },
  { value: 'center', label: '居中' },
  { value: 'right', label: '居右' },
];

const FOOTER_NOTE_STYLE_OPTIONS: Array<{
  value: FooterNoteStyle;
  label: string;
}> = [
  { value: 'plain', label: '普通备注' },
  { value: 'outlined', label: '描边备注' },
  { value: 'filled', label: '灰底备注' },
];

const SUMMARY_LABEL_OPTIONS = ['合计', '本页合计', '总计'] as const;

export function TableBehaviorSection({
  templateType,
  columns,
  title,
  titleBarStyle,
  titleAlign,
  footerNote,
  footerNoteStyle,
  rowNumberMode,
  summaryLabel,
  minRows,
  showSummary,
  summaryColumns,
  onChange,
}: TableBehaviorSectionProps) {
  const rowNumberEnabled = hasRowNumberColumn(columns);
  const summaryCandidates = columns.filter(isSummaryEligibleColumn);
  const selectedSummaryColumns = new Set(summaryColumns ?? []);
  const recommendedSummaryColumns = getDefaultSummaryColumnKeys(columns);
  const currentSummaryLabel = summaryLabel?.trim() || '合计';
  const minRowsQuickOptions = getTableMinRowsQuickOptions(templateType);
  const footerNoteQuickOptions = getTableFooterNoteQuickOptions(templateType);

  const handleSummaryToggle = (checked: boolean) => {
    if (!checked) {
      onChange({ showSummary: false });
      return;
    }

    onChange({
      showSummary: true,
      summaryColumns:
        summaryColumns && summaryColumns.length > 0
          ? summaryColumns
          : recommendedSummaryColumns,
    });
  };

  const toggleSummaryColumn = (key: string) => {
    const nextSelected = selectedSummaryColumns.has(key)
      ? (summaryColumns ?? []).filter(columnKey => columnKey !== key)
      : [...(summaryColumns ?? []), key];

    onChange({ summaryColumns: nextSelected });
  };

  return (
    <div className="space-y-4">
      <Label className="text-muted-foreground text-xs">表格规则</Label>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="space-y-1">
          <Label className="text-xs">表格标题</Label>
          <Input
            value={title ?? ''}
            onChange={event => onChange({ title: event.target.value })}
            placeholder="例如：货品明细"
            maxLength={60}
            className="h-8"
          />
          <div className="flex flex-wrap gap-2 pt-1">
            {COMMON_TABLE_TITLES.map(option => (
              <button
                key={option}
                type="button"
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs transition-colors',
                  (title ?? '') === option
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                )}
                onClick={() => onChange({ title: option })}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">标题栏样式</Label>
          <div className="flex flex-wrap gap-2">
            {TITLE_BAR_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs transition-colors',
                  (titleBarStyle ?? 'plain') === option.value
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                )}
                onClick={() => onChange({ titleBarStyle: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">标题位置</Label>
          <div className="flex flex-wrap gap-2">
            {TITLE_ALIGN_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs transition-colors',
                  (titleAlign ?? 'center') === option.value
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                )}
                onClick={() => onChange({ titleAlign: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">表尾备注</Label>
          <Textarea
            value={footerNote ?? ''}
            onChange={event => onChange({ footerNote: event.target.value })}
            placeholder="例如：以上数量以现场复核为准"
            maxLength={240}
            className="min-h-[72px] resize-none text-sm"
          />
          <div className="flex flex-wrap gap-2 pt-1">
            {FOOTER_NOTE_STYLE_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs transition-colors',
                  (footerNoteStyle ?? 'plain') === option.value
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                )}
                onClick={() => onChange({ footerNoteStyle: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {footerNoteQuickOptions.map(option => (
              <button
                key={option}
                type="button"
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs transition-colors',
                  (footerNote ?? '') === option
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                )}
                onClick={() => onChange({ footerNote: option })}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      {rowNumberEnabled ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <Label className="text-xs font-medium">序号格式</Label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'numeric' as const, label: '1, 2, 3' },
              { value: 'zero-pad-2' as const, label: '01, 02' },
            ].map(option => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs transition-colors',
                  (rowNumberMode ?? 'numeric') === option.value
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                )}
                onClick={() => onChange({ rowNumberMode: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">补空行</Label>
          <Input
            type="number"
            min={0}
            step={1}
            value={minRows ?? 0}
            onChange={event =>
              onChange({
                minRows: Math.max(0, parseInt(event.target.value, 10) || 0),
              })
            }
            className="h-8"
          />
          <div className="flex flex-wrap gap-2 pt-1">
            {minRowsQuickOptions.map(option => (
              <button
                key={option}
                type="button"
                className={cn(
                  'rounded-full border px-3 py-1 text-xs transition-colors',
                  (minRows ?? 0) === option
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                )}
                onClick={() => onChange({ minRows: option })}
              >
                {option} 行
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-900">显示合计行</p>
            <Switch
              checked={showSummary}
              onCheckedChange={handleSummaryToggle}
            />
          </div>
        </div>
      </div>

      {showSummary && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <Label className="text-xs font-medium">合计文案</Label>

          <Input
            value={summaryLabel ?? ''}
            onChange={event => onChange({ summaryLabel: event.target.value })}
            placeholder="默认：合计"
            maxLength={12}
            className="h-8"
          />

          <div className="flex flex-wrap gap-2">
            {SUMMARY_LABEL_OPTIONS.map(option => (
              <button
                key={option}
                type="button"
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs transition-colors',
                  currentSummaryLabel === option
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                )}
                onClick={() => onChange({ summaryLabel: option })}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs font-medium">合计字段</Label>
            {recommendedSummaryColumns.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() =>
                  onChange({ summaryColumns: recommendedSummaryColumns })
                }
              >
                推荐勾选
              </Button>
            )}
          </div>

          {summaryCandidates.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {summaryCandidates.map(column => {
                const isActive = selectedSummaryColumns.has(column.key);

                return (
                  <button
                    key={column.id ?? column.key}
                    type="button"
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs transition-colors',
                      isActive
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                    )}
                    onClick={() => toggleSummaryColumn(column.key)}
                  >
                    {column.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-slate-200 bg-white px-3 py-2 text-[11px] leading-5 text-slate-500">
              当前列里还没有数字或金额字段，先添加数量、金额之类的列后再勾选合计。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
