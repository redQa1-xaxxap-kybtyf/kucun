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
  onSubmit: () => void;
  onSelectProduct?: () => void; // 新增：选择产品入口（F3）
}

/**
 * 产品入库表单工具栏组件
 * ✅ 符合产品模块UI风格规范
 */
export function InboundFormToolbar({
  isSubmitting,
  onReset,
  onSubmit,
}: InboundFormToolbarProps) {
  const router = useRouter();

  return (
    <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
      <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[var(--shadow-medium)] sm:h-12 sm:w-12">
              <PackageCheck className="h-5 w-5 text-white sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
                产品入库
              </h1>
              <p className="mt-1 text-xs text-gray-600 sm:text-sm">
                填写产品入库信息，增加库存数量
              </p>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-10 gap-2 shadow-sm transition-all hover:scale-105 hover:shadow-md sm:h-11"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onReset}
              disabled={isSubmitting}
              className="h-10 gap-2 shadow-sm transition-all hover:scale-105 hover:shadow-md sm:h-11"
            >
              <RotateCcw className="h-4 w-4" />
              重置
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              onClick={onSubmit}
              className="h-10 gap-2 shadow-md transition-all hover:scale-105 hover:shadow-lg sm:h-11"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  提交入库
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
