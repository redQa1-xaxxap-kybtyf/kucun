'use client';

import {
  ArrowLeft,
  Loader2,
  PackageCheck,
  RotateCcw,
  Save,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface InboundFormToolbarProps {
  isSubmitting: boolean;
  onReset: () => void;
  onSubmit?: () => void;
  onBack?: () => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  formId?: string;
  onSelectProduct?: () => void; // 新增：选择产品入口（F3）
}

/**
 * 产品入库表单工具栏组件
 * 产品入库表单工具栏。
 */
export function InboundFormToolbar({
  isSubmitting,
  onReset,
  onSubmit,
  onBack,
  title = '手工采购入库',
  description = '先填写供应商、产品、批次、数量和成本。',
  submitLabel = '确认提交入库',
  formId,
}: InboundFormToolbarProps) {
  const router = useRouter();

  return (
    <Card className="overflow-hidden rounded-md border-slate-200 bg-white shadow-sm">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-md bg-blue-600">
              <PackageCheck className="h-7 w-7 text-white" />
            </div>
            <div className="min-w-0 space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                {title}
              </h1>
              <p className="text-sm font-medium text-slate-500">
                {description}
              </p>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-start gap-2 xl:w-auto xl:justify-end">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11 border-slate-200 bg-white px-5 text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900"
              onClick={() => {
                if (onBack) {
                  onBack();
                  return;
                }

                router.back();
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回上一页
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onReset}
              disabled={isSubmitting}
              className="h-11 border-slate-200 bg-white px-5 text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-900"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              重新填写
            </Button>
            <Button
              type={formId ? 'submit' : 'button'}
              form={formId}
              size="lg"
              disabled={isSubmitting}
              onClick={formId ? undefined : onSubmit}
              className="h-11 bg-blue-600 px-6 text-white shadow-sm hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在处理...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {submitLabel}
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
