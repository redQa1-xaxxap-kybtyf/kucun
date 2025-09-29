'use client';

import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';

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
    <div className="flex items-center justify-between border-b bg-muted/30 px-6 py-3">
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="h-8 px-3"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
        <h1 className="text-lg font-semibold">产品入库</h1>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={isSubmitting}
          className="h-8 px-3"
        >
          重置
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isSubmitting}
          onClick={onSubmit}
          className="h-8 px-3"
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
  );
}
