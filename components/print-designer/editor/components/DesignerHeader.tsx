/**
 * 打印设计器 - 顶部操作栏
 */

'use client';

import { Eye, Redo2, Save, Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TemplateType } from '@/lib/print-designer/schemas';

import {
  useCanRedo,
  useCanUndo,
  useDesignerStore,
  useRedo,
  useUndo,
} from '../stores';

interface DesignerHeaderProps {
  onSave?: () => void;
  onPreview?: () => void;
}

const typeLabels: Record<TemplateType, string> = {
  'sales-order': '销售订单',
  'purchase-order': '采购订单',
  'factory-shipment': '厂家发货',
  'delivery-note': '发货单',
  'inbound-record': '仓库进货（入库记录）',
  'return-order': '退货订单',
  custom: '自定义',
};

export function DesignerHeader({ onSave, onPreview }: DesignerHeaderProps) {
  const template = useDesignerStore(s => s.template);
  const updateTemplate = useDesignerStore(s => s.updateTemplate);
  const undo = useUndo();
  const redo = useRedo();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateTemplate({ name: e.target.value });
  };

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-4">
      {/* 左侧: 模板名称 */}
      <div className="flex items-center gap-3">
        <Input
          value={template?.name ?? '未命名模板'}
          onChange={handleNameChange}
          className="hover:border-input focus:border-input h-8 w-48 border-transparent bg-transparent text-base font-medium"
        />

        <Select
          value={template?.type ?? 'sales-order'}
          onValueChange={v => updateTemplate({ type: v as TemplateType })}
        >
          <SelectTrigger className="h-8 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(typeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 中间: 撤销/重做 */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          disabled={!canUndo}
          title="撤销 (Ctrl+Z)"
          onClick={() => undo()}
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={!canRedo}
          title="重做 (Ctrl+Shift+Z)"
          onClick={() => redo()}
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      {/* 右侧: 保存/预览 */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPreview}>
          <Eye className="mr-1.5 h-4 w-4" />
          预览
        </Button>
        <Button size="sm" onClick={onSave}>
          <Save className="mr-1.5 h-4 w-4" />
          保存
        </Button>
      </div>
    </header>
  );
}
