/**
 * 打印设计器 - 左侧组件工具栏
 */

'use client';

import {
  CalendarDays,
  FileText,
  Hash,
  Image,
  LayoutTemplate,
  Minus,
  QrCode,
  Search,
  Square,
  Table,
  Type,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createLabeledFieldPairElements,
  createQuickLayoutElements,
  getQuickLayoutPresets,
  type QuickLayoutPresetKey,
} from '@/lib/print-designer/editor-quick-layouts';
import {
  getFieldsForTemplateType,
  getRecommendedFieldsForTemplateType,
  groupFields,
  matchesFieldSearch,
  type FieldDefinition,
} from '@/lib/print-designer/field-registry';
import type { TemplateType } from '@/lib/print-designer/schemas';
import { getTemplateTypeMeta } from '@/lib/print-designer/template-meta';
import { cn } from '@/lib/utils';

import { useDesignerStore, useElements } from '../stores';

import { findNextFieldPairPlacement } from './editor-field-pair-layout';

// 可拖拽的组件类型
const componentItems = [
  {
    type: 'text',
    label: '文本',
    icon: Type,
    category: 'basic',
  },
  {
    type: 'image',
    label: '图片',
    icon: Image,
    category: 'basic',
  },
  {
    type: 'table',
    label: '表格',
    icon: Table,
    category: 'container',
  },
  {
    type: 'barcode',
    label: '条码',
    icon: QrCode,
    category: 'basic',
  },
  {
    type: 'line',
    label: '横线',
    icon: Minus,
    category: 'basic',
  },
  {
    type: 'rect',
    label: '边框框',
    icon: Square,
    category: 'basic',
  },
];

interface DraggableItemProps {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onDragStart?: () => void;
}

function DraggableItem({
  type,
  label,
  icon: Icon,
  onDragStart,
}: DraggableItemProps) {
  const setDragging = useDesignerStore(s => s.setDragging);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('elementType', type);
    e.dataTransfer.effectAllowed = 'copy';
    setDragging(true);
    onDragStart?.();
  };

  const handleDragEnd = () => {
    setDragging(false);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        'flex cursor-grab items-center gap-2 rounded-md border bg-white px-3 py-2',
        'hover:border-primary hover:bg-primary/5 transition-colors',
        'active:cursor-grabbing'
      )}
    >
      <Icon className="text-muted-foreground h-4 w-4" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

interface FieldItemProps {
  field: FieldDefinition;
  onInsert?: (field: FieldDefinition) => void;
}

function getFieldIcon(field: FieldDefinition) {
  switch (field.type) {
    case 'date':
      return CalendarDays;
    case 'number':
      return Hash;
    default:
      return FileText;
  }
}

function FieldItem({ field, onInsert }: FieldItemProps) {
  const setDragging = useDesignerStore(s => s.setDragging);
  const Icon = getFieldIcon(field);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('elementType', 'placeholder');
    e.dataTransfer.setData('fieldPath', field.path);
    e.dataTransfer.setData('fieldLabel', field.label);
    e.dataTransfer.effectAllowed = 'copy';
    setDragging(true);
  };

  const handleDragEnd = () => {
    setDragging(false);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onInsert?.(field)}
      className={cn(
        'flex cursor-grab items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2',
        'text-xs text-amber-900 transition-colors hover:border-amber-300 hover:bg-amber-100',
        'active:cursor-grabbing'
      )}
      title={`${field.label} (${field.path})`}
    >
      <Icon className="h-3 w-3" />
      <span className="truncate">{field.label}</span>
    </div>
  );
}

export function ComponentToolbar() {
  const templateType = useDesignerStore(s => s.template?.type ?? 'sales-order');
  const templateMeta = getTemplateTypeMeta(templateType);
  const addElements = useDesignerStore(s => s.addElements);
  const elements = useElements();
  const pageSettings = useDesignerStore(s => s.template?.pageSettings);
  const [fieldSearch, setFieldSearch] = useState('');

  const allFields = useMemo(
    () => getFieldsForTemplateType(templateType),
    [templateType]
  );
  const visibleFields = useMemo(() => {
    if (!fieldSearch.trim()) {
      return allFields;
    }

    return allFields.filter(field => matchesFieldSearch(field, fieldSearch));
  }, [allFields, fieldSearch]);
  const groupedFields = useMemo(
    () => groupFields(visibleFields),
    [visibleFields]
  );
  const quickFieldSuggestions = useMemo(
    () =>
      getRecommendedFieldsForTemplateType(templateType)
        .filter(
          field => !fieldSearch.trim() || matchesFieldSearch(field, fieldSearch)
        )
        .slice(0, 6),
    [fieldSearch, templateType]
  );
  const quickLayoutPresets = useMemo(
    () => getQuickLayoutPresets(templateType as TemplateType),
    [templateType]
  );
  const visibleFieldCount = visibleFields.length;
  const hasSearch = Boolean(fieldSearch.trim());

  const handleApplyQuickLayout = (presetKey: QuickLayoutPresetKey) => {
    addElements(
      createQuickLayoutElements(templateType as TemplateType, presetKey)
    );
  };

  const handleInsertFieldPair = (field: FieldDefinition) => {
    if (!pageSettings) {
      return;
    }

    const placement = findNextFieldPairPlacement(elements, pageSettings);
    addElements(
      createLabeledFieldPairElements(
        field,
        placement.x,
        placement.y,
        placement.width,
        placement.labelWidth
      )
    );
  };

  return (
    <aside className="flex w-64 flex-col border-r bg-stone-50">
      <div className="border-b bg-gradient-to-b from-stone-100 to-stone-50 p-3">
        <div className="mb-2">
          <h3 className="text-sm font-semibold text-stone-900">添加内容</h3>
          <p className="mt-1 text-xs leading-5 text-stone-600">
            当前模板：{templateMeta?.label ?? '打印模板'}
            <br />
            直接拖到中间画布即可新增。
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-white/80 px-3 py-2 text-[11px] leading-5 text-stone-600">
          单击数据项会直接插入“标签 +
          值”成对字段，更适合中文表单；拖拽到画布时则只插入字段值，适合自由排版。
        </div>
      </div>

      {quickLayoutPresets.length > 0 && (
        <div className="border-b p-3">
          <div className="mb-2 flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4 text-stone-600" />
            <h3 className="text-xs font-medium tracking-[0.12em] text-stone-500 uppercase">
              一键版式
            </h3>
          </div>
          <div className="space-y-2">
            {quickLayoutPresets.map(preset => (
              <button
                key={preset.key}
                type="button"
                onClick={() => handleApplyQuickLayout(preset.key)}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-left transition-colors hover:border-amber-300 hover:bg-amber-50"
              >
                <div className="text-sm font-medium text-stone-900">
                  {preset.label}
                </div>
                <div className="mt-1 text-[11px] leading-5 text-stone-500">
                  {preset.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 基础组件 */}
      <div className="border-b p-3">
        <h3 className="mb-2 text-xs font-medium tracking-[0.12em] text-stone-500 uppercase">
          补充组件
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {componentItems.map(item => (
            <DraggableItem
              key={item.type}
              type={item.type}
              label={item.label}
              icon={item.icon}
            />
          ))}
        </div>
      </div>

      {/* 数据字段 */}
      <div className="flex-1 overflow-auto p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-medium tracking-[0.12em] text-stone-500 uppercase">
            业务数据项
          </h3>
          <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] text-stone-700">
            {visibleFieldCount} 项
          </span>
        </div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
          <Input
            value={fieldSearch}
            onChange={event => setFieldSearch(event.target.value)}
            placeholder="搜客户、金额、批号或拼音"
            className="h-9 rounded-lg bg-white pr-8 pl-8 text-xs"
            aria-label="搜索业务数据项"
          />
          {hasSearch ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
              onClick={() => setFieldSearch('')}
              aria-label="清空数据项搜索"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>

        {quickFieldSuggestions.length > 0 && (
          <section className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-medium text-stone-700">
                {hasSearch ? '匹配的常用项' : '常用数据项'}
              </h4>
              <span className="text-[10px] text-stone-400">
                {hasSearch ? '可直接插入' : '先放这些更快'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickFieldSuggestions.map(field => (
                <FieldItem
                  key={`quick-${field.path}`}
                  field={field}
                  onInsert={handleInsertFieldPair}
                />
              ))}
            </div>
          </section>
        )}

        <div className="space-y-4">
          {visibleFieldCount === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-300 bg-white px-3 py-6 text-center text-xs leading-5 text-stone-500">
              没有匹配的数据项，换个中文关键词或拼音再试。
            </div>
          ) : (
            Object.entries(groupedFields).map(([group, fields]) => (
              <section key={group}>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-medium text-stone-700">
                    {group}
                  </h4>
                  <span className="text-[10px] text-stone-400">
                    {fields.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {fields.map(field => (
                    <FieldItem
                      key={field.path}
                      field={field}
                      onInsert={handleInsertFieldPair}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
