import { ArrowLeft, PackageSearch } from 'lucide-react';
import Link from 'next/link';

import { PageHeader as CommonPageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PageHeaderProps {
  batchNumber: string;
  filteredByInventoryId?: string;
}

export function PageHeader({
  batchNumber,
  filteredByInventoryId,
}: PageHeaderProps) {
  // 构建描述内容，包含批次号和库存ID
  const description = (
    <div className="flex items-center gap-2">
      <span className="font-medium">批次号：{batchNumber || '—'}</span>
      {filteredByInventoryId && (
        <Badge variant="outline">库存ID：{filteredByInventoryId}</Badge>
      )}
    </div>
  );

  return (
    <CommonPageHeader
      title="批次库存变动历史"
      description={description}
      icon={<PackageSearch className="h-6 w-6 text-white" />}
      iconBgColor="hsl(var(--color-primary))"
      variant="gradient"
      actions={
        <Button
          variant="outline"
          size="lg"
          asChild
          className="h-11 shadow-sm"
        >
          <Link href="/inventory">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Link>
        </Button>
      }
    />
  );
}
