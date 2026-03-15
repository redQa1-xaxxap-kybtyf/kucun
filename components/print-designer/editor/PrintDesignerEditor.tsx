/**
 * 打印设计器 - 编辑器主页面
 */

'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  createEmptyTemplate,
  type PrintTemplate,
} from '@/lib/print-designer/schemas';

import {
  ComponentToolbar,
  DesignerCanvas,
  DesignerHeader,
  PreviewDialog,
  PropertiesPanel,
} from './components';
import { useKeyboardShortcuts } from './hooks';
import { useClearHistory, useDesignerStore } from './stores';

interface PrintDesignerEditorProps {
  /** 初始模板 (编辑模式) */
  template?: PrintTemplate;
  /** 保存回调 */
  onSave?: (template: PrintTemplate) => Promise<boolean>;
  /** 是否正在保存 */
  isSaving?: boolean;
  /** 最近一次保存时间 */
  lastSavedAt?: Date | null;
}

export function PrintDesignerEditor({
  template,
  onSave,
  isSaving = false,
  lastSavedAt = null,
}: PrintDesignerEditorProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('');

  const setTemplate = useDesignerStore(s => s.setTemplate);
  const currentTemplate = useDesignerStore(s => s.template);
  const clearHistory = useClearHistory();

  // 初始化模板
  useEffect(() => {
    let nextTemplate: PrintTemplate;

    if (template) {
      nextTemplate = template;
    } else {
      // 创建新模板
      nextTemplate = createEmptyTemplate(
        crypto.randomUUID(),
        '新建模板',
        'sales-order'
      );
    }

    setTemplate(nextTemplate);
    setLastSavedSnapshot(JSON.stringify(nextTemplate));

    // 初始化后清空撤销栈，避免 undo 回到 null/旧模板
    clearHistory();
  }, [template, setTemplate, clearHistory]);

  const currentSnapshot = useMemo(
    () => (currentTemplate ? JSON.stringify(currentTemplate) : ''),
    [currentTemplate]
  );

  const hasUnsavedChanges =
    Boolean(currentTemplate) && currentSnapshot !== lastSavedSnapshot;

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleSave = async () => {
    if (currentTemplate && onSave && !isSaving) {
      const snapshotBeforeSave = JSON.stringify(currentTemplate);
      const success = await onSave(currentTemplate);
      if (success) {
        setLastSavedSnapshot(snapshotBeforeSave);
      }
    }
  };

  const handlePreview = () => {
    setPreviewOpen(true);
  };

  // 注册键盘快捷键
  useKeyboardShortcuts({ onSave: () => void handleSave() });

  return (
    <div className="flex h-screen flex-col">
      <DesignerHeader
        onSave={() => void handleSave()}
        onPreview={handlePreview}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
        lastSavedAt={lastSavedAt}
      />

      <div className="flex flex-1 overflow-hidden">
        <ComponentToolbar />
        <DesignerCanvas />
        <PropertiesPanel />
      </div>

      {/* 预览对话框 */}
      {currentTemplate && (
        <PreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          template={currentTemplate}
        />
      )}
    </div>
  );
}
