/**
 * 打印设计器 - 左侧组件工具栏
 */

'use client';

import {
  CalendarDays,
  FileText,
  Hash,
  Image,
  QrCode,
  Table,
  Type,
} from 'lucide-react';
import { useMemo } from 'react';

import {
  getFieldsForTemplateType,
  groupFields,
  type FieldDefinition,
} from '@/lib/print-designer/field-registry';
import { getTemplateTypeMeta } from '@/lib/print-designer/template-meta';
import { cn } from '@/lib/utils';

import { useDesignerStore } from '../stores';

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

function FieldItem({ field }: FieldItemProps) {
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
      className={cn(
        'flex cursor-grab items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2',
        'text-xs text-amber-900 transition-colors hover:border-amber-300 hover:bg-amber-100',
        'active:cursor-grabbing'
      )}
      title={field.path}
    >
      <Icon className="h-3 w-3" />
      <span className="truncate">{field.label}</span>
    </div>
  );
}

export function ComponentToolbar() {
  const templateType = useDesignerStore(s => s.template?.type ?? 'sales-order');
  const templateMeta = getTemplateTypeMeta(templateType);

  const groupedFields = useMemo(
    () => groupFields(getFieldsForTemplateType(templateType)),
    [templateType]
  );

  return (
    <aside className="flex w-64 flex-col border-r bg-stone-50">
      <div className="border-b bg-gradient-to-b from-stone-100 to-stone-50 p-3">
        <div className="mb-2">
          <h3 className="text-sm font-semibold text-stone-900">组件与数据项</h3>
          <p className="mt-1 text-xs leading-5 text-stone-600">
            当前模板：{templateMeta?.label ?? '打印模板'}
            <br />
            直接拖到中间画布即可新增。
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-white/80 px-3 py-2 text-[11px] leading-5 text-stone-600">
          先拖基础组件，再拖数据项替换固定文字，更符合中国企业常见的单据制作习惯。
        </div>
      </div>

      {/* 基础组件 */}
      <div className="border-b p-3">
        <h3 className="mb-2 text-xs font-medium tracking-[0.12em] text-stone-500 uppercase">
          常用组件
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
            可选数据项
          </h3>
          <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] text-stone-700">
            {Object.values(groupedFields).flat().length} 项
          </span>
        </div>

        <div className="space-y-4">
          {Object.entries(groupedFields).map(([group, fields]) => (
            <section key={group}>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-medium text-stone-700">{group}</h4>
                <span className="text-[10px] text-stone-400">
                  {fields.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {fields.map(field => (
                  <FieldItem key={field.path} field={field} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </aside>
  );
}
