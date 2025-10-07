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
    <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
      <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
              <PackageCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                入库记录
              </h1>
              <p className="text-sm text-gray-600">
                查看和管理产品入库记录，跟踪库存增加情况
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="lg"
              className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
              onClick={() => router.back()}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
            <Button
              size="lg"
              className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
              onClick={onCreateNew}
            >
              <Plus className="mr-2 h-4 w-4" />
              新增入库
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
