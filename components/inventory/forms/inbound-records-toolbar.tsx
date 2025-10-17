'use client';

import { ArrowLeft, PackageCheck, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';

interface InboundRecordsToolbarProps {
  onCreateNew: () => void;
}

export function InboundRecordsToolbar({
  onCreateNew,
}: InboundRecordsToolbarProps) {
  const router = useRouter();

  return (
    <PageHeader
      title="入库记录"
      description="查看和管理产品入库记录，跟踪库存增加情况"
      icon={<PackageCheck className="h-6 w-6" />}
      iconBgColor="hsl(var(--color-primary))"
      variant="solid"
      actions={
        <>
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
        </>
      }
    />
  );
}
