/**
 * 打印设计器编辑器页面
 */

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { PrintDesignerEditor } from '@/components/print-designer';
import { getTemplate, saveTemplate } from '@/lib/print-designer/actions';
import type { PrintTemplate } from '@/lib/print-designer/schemas';

function PrintDesignerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get('id');

  const [template, setTemplate] = useState<PrintTemplate | undefined>();
  const [isLoading, setIsLoading] = useState(!!templateId);
  const [isPending, startTransition] = useTransition();

  // 加载已存在的模板
  useEffect(() => {
    if (templateId) {
      setIsLoading(true);
      getTemplate(templateId)
        .then((result) => {
          if (result.success && result.data) {
            setTemplate(result.data);
          } else {
            toast.error(result.error ?? '加载模板失败');
            router.push('/settings/print-templates');
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [templateId, router]);

  const handleSave = (templateData: PrintTemplate) => {
    startTransition(async () => {
      const result = await saveTemplate(templateData);
      if (result.success) {
        toast.success('模板已保存');
        // 如果是新建，更新 URL
        if (!templateId && result.data) {
          router.replace(`/settings/print-designer?id=${result.data.id}`);
        }
      } else {
        toast.error(result.error ?? '保存失败');
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">加载模板中...</p>
      </div>
    );
  }

  return <PrintDesignerEditor template={template} onSave={handleSave} />;
}

export default function PrintDesignerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <p className="text-muted-foreground">加载中...</p>
        </div>
      }
    >
      <PrintDesignerContent />
    </Suspense>
  );
}
