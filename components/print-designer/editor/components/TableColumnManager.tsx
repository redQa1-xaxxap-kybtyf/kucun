/**
 * 打印设计器 - 表格列管理器
 */

'use client';

import { ChevronDown, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

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
import type { FieldDefinition } from '@/lib/print-designer/field-registry';
import type { TableColumn } from '@/lib/print-designer/schemas';

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

function isTableColumnFormat(value: unknown): value is TableColumn['format'] {
  return (
    typeof value === 'string' &&
    (COLUMN_FORMATS as readonly string[]).includes(value)
  );
}

export function TableColumnManager({
  templateType,
  columns,
  onChange,
}: TableColumnManagerProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

    handleUpdateColumn(index, updates);
  };

  const handleAddColumn = () => {
    const newColumn: TableColumn = {
      key: `col_${Date.now()}`,
      label: '新列',
      width: 15,
      widthUnit: '%',
      align: 'left',
      format: 'text',
    };
    onChange([...columns, newColumn]);
  };

  const handleAddColumnFromField = (field: FieldDefinition) => {
    const newColumn: TableColumn = {
      key: field.path,
      label: field.label,
      width: 15,
      widthUnit: '%',
      align: field.type === 'number' ? 'right' : 'left',
      format: isTableColumnFormat(field.suggestedFormat)
        ? field.suggestedFormat
        : 'text',
    };
    onChange([...columns, newColumn]);
  };

  const handleRemoveColumn = (index: number) => {
    if (columns.length <= 1) return; // 至少保留一列
    onChange(columns.filter((_, i) => i !== index));
  };

  const handleUpdateColumn = (index: number, updates: Partial<TableColumn>) => {
    onChange(
      columns.map((col, i) => (i === index ? { ...col, ...updates } : col))
    );
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

      onChange(moveItem(columns, fromIndex, index));
    };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground text-xs">列定义</Label>
        <div className="flex items-center gap-1">
          <FieldPicker
            templateType={templateType}
            scope="table"
            onSelect={handleAddColumnFromField}
          >
            <Button variant="ghost" size="sm" type="button">
              <Plus className="mr-1 h-3 w-3" />
              从字段添加
            </Button>
          </FieldPicker>

          <Button variant="ghost" size="sm" onClick={handleAddColumn}>
            <Plus className="mr-1 h-3 w-3" />
            添加空列
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {columns.map((col, index) => (
          <div
            key={col.key}
            className="relative flex items-center gap-1 rounded-md border bg-slate-50 p-2"
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
                  <Input
                    value={col.label}
                    onChange={e =>
                      handleUpdateColumn(index, { label: e.target.value })
                    }
                    placeholder="例如: 名称"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-[10px]">
                    绑定字段
                  </Label>
                  <div className="relative">
                    <Input
                      value={col.key}
                      onChange={e =>
                        handleUpdateColumn(index, { key: e.target.value })
                      }
                      placeholder="选择字段或手动输入"
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
                          title="选择字段"
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

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleRemoveColumn(index)}
              disabled={columns.length <= 1}
            >
              <Trash2 className="h-3 w-3 text-slate-400" />
            </Button>

            {draggingIndex !== null && dragOverIndex === index && (
              <div className="ring-primary/40 pointer-events-none absolute inset-0 rounded-md ring-2" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
