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
      <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[var(--shadow-medium)]">
              <PackageCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                产品入库
              </h1>
              <p className="text-sm text-gray-600">
                填写产品入库信息，增加库存数量
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11 gap-2 shadow-sm transition-all hover:scale-105 hover:shadow-md"
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
              className="h-11 gap-2 shadow-sm transition-all hover:scale-105 hover:shadow-md"
            >
              <RotateCcw className="h-4 w-4" />
              重置
            </Button>
            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              onClick={onSubmit}
              className="h-11 gap-2 shadow-md transition-all hover:scale-105 hover:shadow-lg"
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
