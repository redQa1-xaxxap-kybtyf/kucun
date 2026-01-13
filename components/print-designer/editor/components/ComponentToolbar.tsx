/**
 * 打印设计器 - 左侧组件工具栏
 */

'use client';

import {
    FileText,
    Hash,
    Image,
    QrCode,
    Table,
    Type,
} from 'lucide-react';

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

// 可绑定的数据字段
const fieldItems = [
  // 订单信息
  { field: 'order.orderNumber', label: '订单编号', icon: Hash, group: '订单' },
  { field: 'order.createdAt', label: '订单日期', icon: FileText, group: '订单' },
  // 客户信息
  { field: 'customer.name', label: '客户名称', icon: FileText, group: '客户' },
  { field: 'customer.phone', label: '客户电话', icon: FileText, group: '客户' },
  { field: 'customer.address', label: '客户地址', icon: FileText, group: '客户' },
  // 汇总信息
  { field: 'totalAmount', label: '总金额', icon: Hash, group: '汇总' },
  { field: 'totalAmountCap', label: '大写金额', icon: FileText, group: '汇总' },
  { field: 'totalQuantity', label: '总数量', icon: Hash, group: '汇总' },
  { field: 'totalBoxes', label: '总件数', icon: Hash, group: '汇总' },
  // 制单信息
  { field: 'operator.name', label: '制单人', icon: FileText, group: '制单' },
  { field: 'printDate', label: '打印日期', icon: FileText, group: '制单' },
];

interface DraggableItemProps {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onDragStart?: () => void;
}

function DraggableItem({ type, label, icon: Icon, onDragStart }: DraggableItemProps) {
  const setDragging = useDesignerStore((s) => s.setDragging);

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
        'transition-colors hover:border-primary hover:bg-primary/5',
        'active:cursor-grabbing'
      )}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

interface FieldItemProps {
  field: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

function FieldItem({ field, label, icon: Icon }: FieldItemProps) {
  const setDragging = useDesignerStore((s) => s.setDragging);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('elementType', 'placeholder');
    e.dataTransfer.setData('fieldPath', field);
    e.dataTransfer.setData('fieldLabel', label);
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
        'flex cursor-grab items-center gap-2 rounded-full border bg-blue-50 px-3 py-1',
        'text-xs text-blue-700 transition-colors hover:bg-blue-100',
        'active:cursor-grabbing'
      )}
    >
      <Icon className="h-3 w-3" />
      <span>{label}</span>
    </div>
  );
}

export function ComponentToolbar() {
  return (
    <aside className="flex w-60 flex-col border-r bg-slate-50">
      {/* 基础组件 */}
      <div className="border-b p-3">
        <h3 className="mb-2 text-xs font-medium text-muted-foreground">
          基础组件
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {componentItems.map((item) => (
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
        <h3 className="mb-2 text-xs font-medium text-muted-foreground">
          数据字段
        </h3>
        <div className="flex flex-wrap gap-2">
          {fieldItems.map((item) => (
            <FieldItem
              key={item.field}
              field={item.field}
              label={item.label}
              icon={item.icon}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
