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

interface InboundFormToolbarProps {
  isSubmitting: boolean;
  onReset: () => void;
  onSubmit: () => void;
}

export function InboundFormToolbar({
  isSubmitting,
  onReset,
  onSubmit,
}: InboundFormToolbarProps) {
  const router = useRouter();

  return (
    <div className="overflow-hidden rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-6 shadow-lg shadow-gray-200/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
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
            className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onReset}
            disabled={isSubmitting}
            className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            重置
          </Button>
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            onClick={onSubmit}
            className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                提交中...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                提交入库
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
