/**
 * 打印设计器 - 顶部操作栏
 */

'use client';

import { AlertCircle, Eye, Loader2, Redo2, Save, Undo2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
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
  getTemplateTypeLabel,
  getTemplateTypeMeta,
  TEMPLATE_TYPE_META,
} from '@/lib/print-designer/template-meta';

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
  isSaving?: boolean;
  hasUnsavedChanges?: boolean;
  lastSavedAt?: Date | null;
}

export function DesignerHeader({
  onSave,
  onPreview,
  isSaving = false,
  hasUnsavedChanges = false,
  lastSavedAt = null,
}: DesignerHeaderProps) {
  const template = useDesignerStore(s => s.template);
  const updateTemplate = useDesignerStore(s => s.updateTemplate);
  const undo = useUndo();
  const redo = useRedo();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const elementCount = useDesignerStore(s => s.template?.elements.length ?? 0);

  const templateType = template?.type ?? 'sales-order';
  const templateMeta = getTemplateTypeMeta(templateType);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateTemplate({ name: e.target.value });
  };

  const handleTypeChange = (value: string) => {
    const nextType = value as TemplateType;
    const currentType = template?.type;

    if (currentType === nextType) return;

    if (
      currentType &&
      elementCount > 0 &&
      // eslint-disable-next-line no-alert
      !window.confirm(
        `确定切换为“${getTemplateTypeLabel(nextType)}”吗？\n\n已放置的字段和表格列不会自动替换，切换后建议检查字段绑定是否仍然正确。`
      )
    ) {
      return;
    }

    updateTemplate({ type: nextType });
  };

  const saveStatus = isSaving
    ? '正在保存...'
    : hasUnsavedChanges
      ? '有未保存修改'
      : lastSavedAt
        ? `已保存 ${lastSavedAt.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}`
        : '当前内容已同步';

  return (
    <header className="border-b bg-white">
      <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-2.5">
      {/* 左侧: 模板名称 */}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-3">
          <Input
            value={template?.name ?? '未命名模板'}
            onChange={handleNameChange}
            className="hover:border-input focus:border-input h-9 w-64 min-w-0 border-transparent bg-transparent px-0 text-lg font-semibold"
          />

          <Select value={templateType} onValueChange={handleTypeChange}>
            <SelectTrigger className="h-9 w-52 bg-stone-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.entries(TEMPLATE_TYPE_META) as [
                  TemplateType,
                  (typeof TEMPLATE_TYPE_META)[TemplateType],
                ][]
              ).map(([value, meta]) => (
                <SelectItem key={value} value={value}>
                  {meta.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Badge variant="secondary" className="hidden md:inline-flex">
            {templateMeta?.shortLabel ?? '模板'}
          </Badge>
        </div>

        <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
          <span>{templateMeta?.description ?? '打印模板编辑器'}</span>
          <span>元素 {elementCount} 个</span>
          <span className="inline-flex items-center gap-1">
            {hasUnsavedChanges && !isSaving ? (
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            ) : null}
            {saveStatus}
          </span>
        </div>
      </div>

      {/* 中间: 撤销/重做 */}
      <div className="flex items-center gap-1 rounded-full border bg-stone-50 px-1 py-1">
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
        <Button variant="outline" size="sm" onClick={onPreview} disabled={isSaving}>
          <Eye className="mr-1.5 h-4 w-4" />
          预览
        </Button>
        <Button size="sm" onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-4 w-4" />
          )}
          {isSaving ? '保存中' : '保存'}
        </Button>
      </div>
      </div>
    </header>
  );
}
