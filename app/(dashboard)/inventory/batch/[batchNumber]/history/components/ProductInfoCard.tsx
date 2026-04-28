import { ActivitySquare } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Product, ProductVariant } from '@/lib/types/product';

interface ProductInfoCardProps {
  product?: Product | null;
  variant?: ProductVariant | null;
  batchNumber: string;
}

export function ProductInfoCard({
  product,
  variant,
  batchNumber,
}: ProductInfoCardProps) {
  return (
    <Card className="overflow-hidden rounded-md border border-[hsl(var(--color-border-primary))] shadow-sm">
      <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] py-3">
        <CardTitle className="flex items-center text-base text-[hsl(var(--color-text-primary))]">
          <ActivitySquare className="mr-2 h-4 w-4 text-[hsl(var(--color-primary))]" />
          产品信息
        </CardTitle>
      </CardHeader>
      <CardContent className="bg-[hsl(var(--color-bg-card))] p-6">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
              产品编码
            </div>
            <div className="mt-2 font-medium text-[hsl(var(--color-text-primary))]">
              {product?.code || '—'}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
              产品名称
            </div>
            <div className="mt-2 font-medium text-[hsl(var(--color-text-primary))]">
              {product?.name || '—'}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
              批次号
            </div>
            <div className="mt-2 font-medium text-[hsl(var(--color-text-primary))]">
              {batchNumber || '—'}
            </div>
          </div>
          {variant && (
            <div>
              <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                色号/变体
              </div>
              <div className="mt-2 font-medium text-[hsl(var(--color-text-primary))]">
                {variant.colorCode
                  ? `${variant.colorCode}${
                      variant.colorName ? ` - ${variant.colorName}` : ''
                    }`
                  : '—'}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
