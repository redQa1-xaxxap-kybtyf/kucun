import { ArrowLeft, PackageSearch } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface PageHeaderProps {
  batchNumber: string;
  filteredByInventoryId?: string;
}

export function PageHeader({
  batchNumber,
  filteredByInventoryId,
}: PageHeaderProps) {
  return (
    <Card
      className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
      style={{ boxShadow: 'var(--shadow-medium)' }}
    >
      <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-lg">
              <PackageSearch className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                批次库存变动历史
              </h1>
              <div className="mt-1 flex items-center gap-2 text-sm text-[hsl(var(--color-text-secondary))]">
                <span className="font-medium">
                  批次号：{batchNumber || '—'}
                </span>
                {filteredByInventoryId && (
                  <Badge variant="outline">
                    库存ID：{filteredByInventoryId}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="lg" asChild className="h-11">
              <Link href="/inventory">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
