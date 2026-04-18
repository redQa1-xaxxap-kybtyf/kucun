/**
 * 打印设计器 - 表格列管理器
 */

'use client';

import { ChevronDown, Copy, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  filterFieldsByQuickFilter,
  getFieldQuickFilterOptions,
  type FieldQuickFilterOption,
} from '@/lib/print-designer/field-quick-filters';
import {
  type FieldDefinition,
  getTableFieldsForTemplateType,
} from '@/lib/print-designer/field-registry';
import {
  createTableColumn,
  ensureTableColumnIds,
  getTableColumnReactKey,
  type TableColumn,
} from '@/lib/print-designer/schemas';
import {
  applyTableDocumentLabelPreset,
  applyTableColumnLabelMode,
  appendRecommendedTableColumns,
  appendTableFieldsAsColumns,
  getTableDocumentLabelPresets,
  getTableColumnPresets,
  getTableColumnQuickInsertPresets,
  getTableColumnLabelQuickOptions,
  hasRowNumberColumn,
  insertTableFieldAsColumn,
  rebalanceTableColumnWidths,
  type TableDocumentLabelPreset,
  type TableColumnLabelMode,
  type TableColumnQuickInsertPreset,
  toggleRowNumberColumn,
} from '@/lib/print-designer/table-column-presets';

import { FieldPicker } from './FieldPicker';

interface TableColumnManagerProps {
  templateType: string;
  columns: TableColumn[];
  onChange: (columns: TableColumn[]) => void;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  if (item === undefined) return items;
  next.splice(toIndex, 0, item);
  return next;
}

const COLUMN_FORMATS = ['text', 'number', 'currency', 'date_cn'] as const;
const QUICK_FILTER_APPEND_LIMITS: Record<string, number> = {
  product: 5,
  quantity: 6,
  amount: 4,
  stock: 4,
  remark: 2,
};

function isTableColumnFormat(value: unknown): value is TableColumn['format'] {
  return (
    typeof value === 'string' &&
    (COLUMN_FORMATS as readonly string[]).includes(value)
  );
}

function createNextDuplicateLabel(
  columns: TableColumn[],
  label: string
): string {
  let counter = 2;
  let nextLabel = `${label}（${counter}）`;

  while (columns.some(column => column.label === nextLabel)) {
    counter += 1;
    nextLabel = `${label}（${counter}）`;
  }

  return nextLabel;
}

function toSingleLineLabel(label: string): string {
  return label.replace(/\s*\n\s*/g, '').trim();
}

function createTwoLineLabel(label: string): string {
  const normalized = toSingleLineLabel(label);
  if (normalized.length <= 2) {
    return normalized;
  }

  const separatorMatches = ['（', '(', '/', '／', '-', ' '];
  for (const separator of separatorMatches) {
    const separatorIndex = normalized.indexOf(separator);
    if (separatorIndex > 1 && separatorIndex < normalized.length - 1) {
      return `${normalized.slice(0, separatorIndex)}\n${normalized.slice(separatorIndex)}`;
    }
  }

  const splitIndex = Math.ceil(normalized.length / 2);
  return `${normalized.slice(0, splitIndex)}\n${normalized.slice(splitIndex)}`;
}

function summarizeFieldLabels(fields: FieldDefinition[]): string {
  const labels = Array.from(new Set(fields.map(field => field.label)));
  const preview = labels.slice(0, 4).join('、');

  if (labels.length <= 4) {
    return preview;
  }

  return `${preview}等${labels.length}列`;
}

export function TableColumnManager({
  templateType,
  columns,
  onChange,
}: TableColumnManagerProps) {
  const tableFields = useMemo(
    () => getTableFieldsForTemplateType(templateType),
    [templateType]
  );
  const quickPresets = useMemo(
    () => getTableColumnPresets(templateType),
    [templateType]
  );
  const quickInsertPresets = useMemo(
    () => getTableColumnQuickInsertPresets(templateType),
    [templateType]
  );
  const documentLabelPresets = useMemo(
    () => getTableDocumentLabelPresets(),
    []
  );
  const quickAddFilterOptions = useMemo(
    () =>
      getFieldQuickFilterOptions(tableFields, 'table').filter(
        option => option.key !== 'all' && option.key !== 'common'
      ),
    [tableFields]
  );
  const rowNumberEnabled = useMemo(
    () => hasRowNumberColumn(columns),
    [columns]
  );
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [message, setMessage] = useState<string>('');
  const [highlightedColumnKey, setHighlightedColumnKey] = useState<
    string | null
  >(null);

  const updateColumns = (nextColumns: TableColumn[]) => {
    onChange(ensureTableColumnIds(nextColumns));
  };

  const focusColumnByKey = (
    nextColumns: TableColumn[],
    columnKey: string | null
  ) => {
    if (!columnKey) {
      setHighlightedColumnKey(null);
      return;
    }

    const columnIndex = nextColumns.findIndex(column => column.key === columnKey);
    const targetColumn = columnIndex >= 0 ? nextColumns[columnIndex] : null;

    setHighlightedColumnKey(
      targetColumn ? getTableColumnReactKey(targetColumn, columnIndex) : null
    );
  };

  const getFirstAddedColumnKey = (nextColumns: TableColumn[]): string | null => {
    const existingKeys = new Set(columns.map(column => column.key));
    return (
      nextColumns.find(column => !existingKeys.has(column.key))?.key ?? null
    );
  };

  const handlePickField = (index: number, field: FieldDefinition) => {
    const current = columns[index];
    if (!current) return;

    const updates: Partial<TableColumn> = { key: field.path };

    if (current.label === '新列' || current.label === current.key) {
      updates.label = field.label;
    }

    if (
      current.format === 'text' &&
      isTableColumnFormat(field.suggestedFormat)
    ) {
      updates.format = field.suggestedFormat;
    }

    const otherMatchedColumn = columns.find(
      (column, currentIndex) =>
        currentIndex !== index && column.key === field.path
    );
    if (otherMatchedColumn) {
      setMessage(
        `数据项“${field.label}”已在其他列使用。当前列仍可继续保存，若只是想复用展示，建议直接复制已有列。`
      );
    } else {
      setMessage('');
    }

    handleUpdateColumn(index, updates);
  };

  const handleAddColumn = () => {
    const newColumn = createTableColumn({
      key: `col_${Date.now()}`,
      label: '新列',
    });
    setMessage('已添加空列，可手动输入内容，或从数据项中选择。');
    setHighlightedColumnKey(newColumn.id ?? null);
    updateColumns([...columns, newColumn]);
  };

  const handleAddColumnFromField = (field: FieldDefinition) => {
    const existingIndex = columns.findIndex(
      column => column.key === field.path
    );

    if (existingIndex >= 0) {
      const existingColumn = columns[existingIndex];
      setHighlightedColumnKey(
        getTableColumnReactKey(existingColumn, existingIndex)
      );
      setMessage(
        `数据项“${field.label}”已存在，已为你定位到对应列。若需同一内容显示两次，请使用该列右侧的“复制列”。`
      );
      return;
    }

    const nextColumns = insertTableFieldAsColumn(columns, field);
    setMessage(`已添加数据项“${field.label}”。`);
    focusColumnByKey(nextColumns, field.path);
    updateColumns(nextColumns);
  };

  const handleApplyPreset = (
    preset: ReturnType<typeof getTableColumnPresets>[number]
  ) => {
    setMessage(`已套用“${preset.label}”，当前列顺序和宽度已一起排好。`);
    setHighlightedColumnKey(preset.columns[0]?.id ?? null);
    updateColumns(preset.columns);
  };

  const handleAppendRecommendedColumns = () => {
    const nextColumns = appendRecommendedTableColumns(templateType, columns);
    if (nextColumns.length === columns.length) {
      setMessage('当前表格已经包含常用列，无需再补齐。');
      return;
    }

    setMessage('已补齐常用列，并顺手整理了当前表格的列宽。');
    focusColumnByKey(nextColumns, getFirstAddedColumnKey(nextColumns));
    updateColumns(nextColumns);
  };

  const handleAppendQuickFilterColumns = (option: FieldQuickFilterOption) => {
    const missingFields = filterFieldsByQuickFilter(
      tableFields,
      templateType,
      'table',
      option.key
    )
      .filter(field => !columns.some(column => column.key === field.path))
      .slice(0, QUICK_FILTER_APPEND_LIMITS[option.key] ?? 4);

    if (missingFields.length === 0) {
      setMessage(`当前表格已经有“${option.label}”常用列了。`);
      return;
    }

    const nextColumns = appendTableFieldsAsColumns(columns, missingFields);
    setMessage(
      `已补上“${option.label}”常用列：${summarizeFieldLabels(missingFields)}。`
    );
    focusColumnByKey(nextColumns, getFirstAddedColumnKey(nextColumns));
    updateColumns(nextColumns);
  };

  const handleAppendQuickInsertPreset = (
    preset: TableColumnQuickInsertPreset
  ) => {
    const missingFields = preset.fields.filter(
      field => !columns.some(column => column.key === field.path)
    );

    if (missingFields.length === 0) {
      setMessage(`当前表格已经包含“${preset.label}”这组列了。`);
      return;
    }

    const nextColumns = appendTableFieldsAsColumns(columns, missingFields);
    setMessage(
      `已补上“${preset.label}”：${summarizeFieldLabels(missingFields)}。`
    );
    focusColumnByKey(nextColumns, getFirstAddedColumnKey(nextColumns));
    updateColumns(nextColumns);
  };

  const handleRebalanceWidths = () => {
    setMessage('已按常见中文单据习惯重新整理列宽，后面还可以继续拖拽微调。');
    setHighlightedColumnKey(null);
    updateColumns(rebalanceTableColumnWidths(columns));
  };

  const handleApplyQuickLabel = (index: number, label: string) => {
    const current = columns[index];
    if (!current) return;

    handleUpdateColumn(index, { label });
    setMessage(`已将当前列标题改为“${label.replace(/\n/g, ' ')}”。`);
    setHighlightedColumnKey(getTableColumnReactKey(current, index));
  };

  const handleApplyLabelMode = (mode: TableColumnLabelMode) => {
    const nextColumns = applyTableColumnLabelMode(columns, mode);
    const modeMessage =
      mode === 'piece'
        ? '已按“片”套用常用中文列头。'
        : mode === 'item'
          ? '已按“件”套用常用中文列头。'
          : '已套用常用中文列头。';

    setMessage(`${modeMessage} 数量、单价、金额等常见列已一起整理。`);
    setHighlightedColumnKey(nextColumns[0]?.id ?? null);
    updateColumns(nextColumns);
  };

  const handleApplyDocumentLabelPreset = (preset: TableDocumentLabelPreset) => {
    const nextColumns = applyTableDocumentLabelPreset(columns, preset.key);
    setMessage(`已按“${preset.label}”整理当前整表列头。`);
    setHighlightedColumnKey(nextColumns[0]?.id ?? null);
    updateColumns(nextColumns);
  };

  const handleToggleTwoLineLabel = (index: number) => {
    const current = columns[index];
    if (!current) return;

    const nextLabel = current.label.includes('\n')
      ? toSingleLineLabel(current.label)
      : createTwoLineLabel(current.label);

    handleUpdateColumn(index, { label: nextLabel });
    setMessage(
      current.label.includes('\n')
        ? `已将“${toSingleLineLabel(current.label)}”恢复为单行标题。`
        : `已将“${current.label}”拆成两行标题，打印时会按两行显示。`
    );
    setHighlightedColumnKey(getTableColumnReactKey(current, index));
  };

  const handleToggleRowNumberColumn = () => {
    const nextColumns = toggleRowNumberColumn(columns);
    setMessage(
      rowNumberEnabled
        ? '已去掉序号列，列宽也一起重新整理好了。'
        : '已加上序号列，并顺手整理了当前表格的列宽。'
    );
    setHighlightedColumnKey(nextColumns[0]?.id ?? null);
    updateColumns(nextColumns);
  };

  const handleRemoveColumn = (index: number) => {
    if (columns.length <= 1) return; // 至少保留一列
    setMessage('');
    setHighlightedColumnKey(null);
    updateColumns(columns.filter((_, i) => i !== index));
  };

  const handleUpdateColumn = (index: number, updates: Partial<TableColumn>) => {
    updateColumns(
      columns.map((col, i) => (i === index ? { ...col, ...updates } : col))
    );
  };

  const handleDuplicateColumn = (index: number) => {
    const current = columns[index];
    if (!current) return;

    const duplicate = createTableColumn({
      ...current,
      id: undefined,
      label: createNextDuplicateLabel(columns, current.label),
    });

    const nextColumns = [...columns];
    nextColumns.splice(index + 1, 0, duplicate);
    setMessage(
      `已复制列“${current.label}”。现在可以保留同一数据项的两个展示版本。`
    );
    setHighlightedColumnKey(duplicate.id ?? null);
    updateColumns(nextColumns);
  };

  const handleDragStart =
    (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData('application/x-table-column-index', String(index));
      e.dataTransfer.effectAllowed = 'move';
      setDraggingIndex(index);
    };

  const handleDragEnd = () => {
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver =
    (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
      if (draggingIndex === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverIndex(index);
    };

  const handleDrop =
    (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const rawFrom = e.dataTransfer.getData(
        'application/x-table-column-index'
      );
      const fromIndex = Number.parseInt(rawFrom, 10);
      setDraggingIndex(null);
      setDragOverIndex(null);

      if (!Number.isFinite(fromIndex)) return;
      if (fromIndex === index) return;
      if (fromIndex < 0 || fromIndex >= columns.length) return;

      updateColumns(moveItem(columns, fromIndex, index));
    };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
        <p className="text-xs font-medium text-stone-800">列设置建议</p>
        <p className="mt-1 text-[11px] leading-5 text-stone-600">
          从数据项添加会自动跳过已存在内容，避免误添加重复列。若要同一数据项显示两次，请先添加一次，再使用“复制列”。
        </p>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
        <div>
          <p className="text-xs font-medium text-slate-900">列头快捷</p>
          <p className="text-muted-foreground mt-1 text-[11px] leading-5">
            更适合中文单据。可以一键整理成常用列头，也可以按“片”或“件”带上单位副标题。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => handleApplyLabelMode('canonical')}
          >
            中文常用
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => handleApplyLabelMode('piece')}
          >
            按片列头
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => handleApplyLabelMode('item')}
          >
            按件列头
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {documentLabelPresets.map(preset => (
            <Button
              key={preset.key}
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => handleApplyDocumentLabelPreset(preset)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {quickPresets.length > 0 && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-slate-900">常用列方案</p>
              <p className="text-muted-foreground mt-1 text-[11px] leading-5">
                直接替换当前列，可撤销，适合先快速成型再微调。
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={handleAppendRecommendedColumns}
            >
              补齐常用列
            </Button>
          </div>

          <div className="grid gap-2">
            {quickPresets.map(preset => (
              <button
                key={preset.key}
                type="button"
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-100"
                onClick={() => handleApplyPreset(preset)}
              >
                <div className="text-sm font-medium text-slate-900">
                  {preset.label}
                </div>
                <div className="mt-1 text-[11px] leading-5 text-slate-500">
                  {preset.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {(quickAddFilterOptions.length > 0 || quickInsertPresets.length > 0) && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
          <div>
            <p className="text-xs font-medium text-slate-900">快速补列</p>
            <p className="text-muted-foreground mt-1 text-[11px] leading-5">
              不用每次打开数据项列表，直接补一组常用列，再微调就行。
            </p>
          </div>

          {quickAddFilterOptions.length > 0 && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-[10px]">按分类补列</p>
              <div className="flex flex-wrap gap-2">
                {quickAddFilterOptions.map(option => (
                  <Button
                    key={option.key}
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => handleAppendQuickFilterColumns(option)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {quickInsertPresets.length > 0 && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-[10px]">常用组合</p>
              <div className="grid gap-2">
                {quickInsertPresets.map(preset => (
                  <button
                    key={preset.key}
                    type="button"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-100"
                    onClick={() => handleAppendQuickInsertPreset(preset)}
                  >
                    <div className="text-sm font-medium text-slate-900">
                      {preset.label}
                    </div>
                    <div className="mt-1 text-[11px] leading-5 text-slate-500">
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground text-xs">列定义</Label>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={handleToggleRowNumberColumn}
          >
            {rowNumberEnabled ? '去掉序号列' : '加序号列'}
          </Button>

          <Button variant="ghost" size="sm" onClick={handleRebalanceWidths}>
            整理列宽
          </Button>

          <FieldPicker
            templateType={templateType}
            scope="table"
            onSelect={handleAddColumnFromField}
          >
            <Button variant="ghost" size="sm" type="button">
              <Plus className="mr-1 h-3 w-3" />
              从数据项添加
            </Button>
          </FieldPicker>

          <Button variant="ghost" size="sm" onClick={handleAddColumn}>
            <Plus className="mr-1 h-3 w-3" />
            添加空列
          </Button>
        </div>
      </div>

      {message ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
          {message}
        </div>
      ) : null}

      <div className="space-y-2">
        {columns.map((col, index) => {
          const columnRenderKey = getTableColumnReactKey(col, index);
          const isHighlighted = highlightedColumnKey === columnRenderKey;
          const labelQuickOptions = getTableColumnLabelQuickOptions(col);

          return (
            <div
              key={columnRenderKey}
              className={`relative flex items-center gap-1 rounded-md border bg-slate-50 p-2 ${
                isHighlighted ? 'ring-2 ring-amber-400 ring-offset-1' : ''
              }`}
              onDragOver={handleDragOver(index)}
              onDrop={handleDrop(index)}
            >
              <div
                draggable={columns.length > 1}
                onDragStart={handleDragStart(index)}
                onDragEnd={handleDragEnd}
                className="flex h-7 w-5 items-center justify-center"
                title="拖拽排序"
              >
                <GripVertical className="h-4 w-4 cursor-move text-slate-400" />
              </div>

              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-[10px]">
                      标题
                    </Label>
                    <Textarea
                      value={col.label}
                      onChange={e =>
                        handleUpdateColumn(index, { label: e.target.value })
                      }
                      placeholder="例如: 名称"
                      rows={2}
                      className="min-h-[52px] resize-none py-2 text-xs leading-4"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-muted-foreground text-[10px] leading-4">
                        支持打印为两行列头
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => handleToggleTwoLineLabel(index)}
                      >
                        {col.label.includes('\n') ? '恢复单行' : '拆成两行'}
                      </Button>
                    </div>
                    {labelQuickOptions.length > 1 ? (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {labelQuickOptions.map(option => (
                          <button
                            key={`${columnRenderKey}-${option}`}
                            type="button"
                            className={`rounded-full border px-2 py-1 text-[10px] leading-4 whitespace-pre-line transition-colors ${
                              col.label.trim() === option
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                            }`}
                            onClick={() => handleApplyQuickLabel(index, option)}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-[10px]">
                      对应数据项
                    </Label>
                    <div className="relative">
                      <Input
                        value={col.key}
                        onChange={e =>
                          handleUpdateColumn(index, { key: e.target.value })
                        }
                        placeholder="选择数据项或手动输入"
                        className="h-8 pr-8 font-mono text-xs"
                      />
                      <div className="absolute top-0 right-0">
                        <FieldPicker
                          templateType={templateType}
                          scope="table"
                          currentField={col.key}
                          onSelect={field => handlePickField(index, field)}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="选择数据项"
                          >
                            <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
                          </Button>
                        </FieldPicker>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1">
                  <div className="col-span-2 flex items-end gap-1">
                    <div className="flex-1 space-y-1">
                      <Label className="text-muted-foreground text-[10px]">
                        宽度
                      </Label>
                      <Input
                        type="number"
                        value={col.width}
                        onChange={e =>
                          handleUpdateColumn(index, {
                            width: parseInt(e.target.value) || 10,
                          })
                        }
                        className="h-7 px-1 text-xs"
                      />
                    </div>
                    <Select
                      value={col.widthUnit}
                      onValueChange={v =>
                        handleUpdateColumn(index, {
                          widthUnit: v as '%' | 'mm',
                        })
                      }
                    >
                      <SelectTrigger className="h-7 w-12 px-1 text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="%">%</SelectItem>
                        <SelectItem value="mm">mm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-[10px]">
                      对齐
                    </Label>
                    <Select
                      value={col.align}
                      onValueChange={v =>
                        handleUpdateColumn(index, {
                          align: v as 'left' | 'center' | 'right',
                        })
                      }
                    >
                      <SelectTrigger className="h-7 w-full px-1 text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">左</SelectItem>
                        <SelectItem value="center">中</SelectItem>
                        <SelectItem value="right">右</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-[10px]">
                      格式
                    </Label>
                    <Select
                      value={col.format}
                      onValueChange={v =>
                        handleUpdateColumn(index, {
                          format: v as TableColumn['format'],
                        })
                      }
                    >
                      <SelectTrigger className="h-7 w-full px-1 text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">文本</SelectItem>
                        <SelectItem value="number">数字</SelectItem>
                        <SelectItem value="currency">货币</SelectItem>
                        <SelectItem value="date_cn">日期</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDuplicateColumn(index)}
                  aria-label={`复制列-${col.label}`}
                  title="复制列"
                >
                  <Copy className="h-3 w-3 text-slate-400" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleRemoveColumn(index)}
                  disabled={columns.length <= 1}
                  aria-label={`删除列-${col.label}`}
                  title="删除列"
                >
                  <Trash2 className="h-3 w-3 text-slate-400" />
                </Button>
              </div>

              {draggingIndex !== null && dragOverIndex === index && (
                <div className="ring-primary/40 pointer-events-none absolute inset-0 rounded-md ring-2" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
