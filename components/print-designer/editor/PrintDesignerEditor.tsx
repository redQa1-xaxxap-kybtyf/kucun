/**
 * 打印设计器 - 编辑器主页面
 */

'use client';

import { Eye, Loader2, Monitor, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useIsDesktop } from '@/hooks/use-media-query';
import type { PrintCompanyProfile } from '@/lib/print-designer/company-profile';
import { fetchPrintCompanyProfile } from '@/lib/print-designer/company-profile-client';
import {
  createEmptyTemplate,
  type PrintTemplate,
} from '@/lib/print-designer/schemas';
import { getTemplateTypeMeta } from '@/lib/print-designer/template-meta';

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

interface MobileDesignerFallbackProps {
  template: PrintTemplate | null;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSavedAt: Date | null;
  onPreview: () => void;
  onSave: () => void;
}

function MobileDesignerFallback({
  template,
  isSaving,
  hasUnsavedChanges,
  lastSavedAt,
  onPreview,
  onSave,
}: MobileDesignerFallbackProps) {
  const templateMeta = getTemplateTypeMeta(template?.type ?? 'sales-order');
  const saveStatus = isSaving
    ? '正在保存'
    : hasUnsavedChanges
      ? '有未保存修改'
      : lastSavedAt
        ? `已保存 ${lastSavedAt.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}`
        : '当前内容已同步';

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50">
      <div className="border-b bg-white px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-900">
              打印模板设计
            </h1>
            <p className="mt-1 truncate text-sm text-slate-500">
              {template?.name ?? '正在加载模板'}
            </p>
          </div>
          <Badge variant="secondary">
            {templateMeta?.shortLabel ?? '模板'}
          </Badge>
        </div>
      </div>

      <main className="space-y-3 p-4">
        <section className="rounded-lg border border-amber-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Monitor className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">
                请在电脑端编辑版式
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                手机端保留预览和保存，拖拽排版、列宽调整、字段定位在电脑端完成。
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b pb-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                {templateMeta?.label ?? '打印模板'}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {templateMeta?.description ?? '打印模板'}
              </div>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
              {template?.elements.length ?? 0} 项内容
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">纸张</div>
              <div className="mt-1 font-medium text-slate-900">
                {template?.pageSettings.size ?? 'A4'}
                {template?.pageSettings.orientation === 'landscape'
                  ? ' 横向'
                  : ' 纵向'}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">保存状态</div>
              <div className="mt-1 font-medium text-slate-900">
                {saveStatus}
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={onPreview}
            disabled={!template || isSaving}
          >
            <Eye className="mr-1.5 h-4 w-4" />
            预览
          </Button>
          <Button
            type="button"
            className="h-11"
            onClick={onSave}
            disabled={!template || isSaving}
          >
            {isSaving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            {isSaving ? '保存中' : '保存'}
          </Button>
        </div>
      </main>
    </div>
  );
}

export function PrintDesignerEditor({
  template,
  onSave,
  isSaving = false,
  lastSavedAt = null,
}: PrintDesignerEditorProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState('');
  const [companyProfile, setCompanyProfile] = useState<
    PrintCompanyProfile | null | undefined
  >(undefined);
  const isDesktop = useIsDesktop();

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

  useEffect(() => {
    let cancelled = false;

    void fetchPrintCompanyProfile()
      .then(profile => {
        if (!cancelled) {
          setCompanyProfile(profile);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCompanyProfile(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
    <>
      {isDesktop ? (
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
            <DesignerCanvas companyProfile={companyProfile} />
            <PropertiesPanel companyProfile={companyProfile} />
          </div>
        </div>
      ) : (
        <MobileDesignerFallback
          template={currentTemplate}
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
          lastSavedAt={lastSavedAt}
          onPreview={handlePreview}
          onSave={() => void handleSave()}
        />
      )}

      {/* 预览对话框 */}
      {currentTemplate && (
        <PreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          template={currentTemplate}
          companyProfile={companyProfile}
        />
      )}
    </>
  );
}
