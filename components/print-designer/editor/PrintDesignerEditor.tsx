/**
 * 打印设计器 - 编辑器主页面
 */

'use client';

import { useEffect, useState } from 'react';

import type { PrintTemplate } from '@/lib/print-designer/schemas';
import { createEmptyTemplate } from '@/lib/print-designer/schemas';

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
  onSave?: (template: PrintTemplate) => void;
}

export function PrintDesignerEditor({
  template,
  onSave,
}: PrintDesignerEditorProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const setTemplate = useDesignerStore((s) => s.setTemplate);
  const currentTemplate = useDesignerStore((s) => s.template);
  const clearHistory = useClearHistory();

  // 初始化模板
  useEffect(() => {
    if (template) {
      setTemplate(template);
    } else {
      // 创建新模板
      setTemplate(
        createEmptyTemplate(crypto.randomUUID(), '新建模板', 'sales-order')
      );
    }

    // 初始化后清空撤销栈，避免 undo 回到 null/旧模板
    clearHistory();
  }, [template, setTemplate, clearHistory]);

  const handleSave = () => {
    if (currentTemplate && onSave) {
      onSave(currentTemplate);
    }
  };

  const handlePreview = () => {
    setPreviewOpen(true);
  };

  // 注册键盘快捷键
  useKeyboardShortcuts({ onSave: handleSave });

  return (
    <div className="flex h-screen flex-col">
      <DesignerHeader onSave={handleSave} onPreview={handlePreview} />

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
