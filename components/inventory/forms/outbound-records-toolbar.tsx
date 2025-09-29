'use client';

import { ArrowLeft, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';

import { Button } from '@/components/ui/button';

interface OutboundRecordsToolbarProps {
  onCreateNew: () => void;
}

export function OutboundRecordsToolbar({
  onCreateNew,
}: OutboundRecordsToolbarProps) {
  const router = useRouter();

  return (
    <div className="border-b bg-muted/30 px-3 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-1 h-3 w-3" />
            返回
          </Button>
          <h3 className="text-sm font-medium">出库记录</h3>
        </div>
        <Button size="sm" className="h-7" onClick={onCreateNew}>
          <Plus className="mr-1 h-3 w-3" />
          新增出库
        </Button>
      </div>
    </div>
  );
}
