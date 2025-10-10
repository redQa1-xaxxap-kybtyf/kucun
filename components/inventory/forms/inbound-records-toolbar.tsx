'use client';

import { ArrowLeft, PackageCheck, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface InboundRecordsToolbarProps {
  onCreateNew: () => void;
}

export function InboundRecordsToolbar({
  onCreateNew,
}: InboundRecordsToolbarProps) {
  const router = useRouter();

  return (
    <Card
      className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
      style={{ boxShadow: 'var(--shadow-medium)' }}
    >
      <CardContent className="bg-[hsl(var(--color-bg-secondary))] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))]"
              style={{ boxShadow: 'var(--shadow-light)' }}
            >
              <PackageCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                入库记录
              </h1>
              <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                查看和管理产品入库记录，跟踪库存增加情况
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="lg"
              className="h-11 gap-2"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
              返回
            </Button>
            <Button
              size="lg"
              className="h-11 gap-2 transition-transform duration-150 hover:scale-[1.02]"
              onClick={onCreateNew}
              style={{ boxShadow: 'var(--shadow-light)' }}
            >
              <Plus className="h-4 w-4" />
              新增入库
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
