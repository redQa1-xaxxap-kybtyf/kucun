'use client';

import { ArrowLeft, Edit, ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getCommonStatusBadgeVariant } from '@/lib/utils/badge-helpers';

interface CustomerDetailHeaderProps {
  customerId: string;
  name: string;
  status: string;
  phone?: string;
}

const STATUS_LABEL_MAP: Record<string, string> = {
  active: '活跃',
  inactive: '非活跃',
  blacklisted: '黑名单',
};

function getStatusLabel(status: string) {
  return STATUS_LABEL_MAP[status] ?? status;
}

export function CustomerDetailHeader({
  customerId,
  name,
  status,
  phone,
}: CustomerDetailHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[hsl(var(--color-text-primary))]">
              {name}
            </h1>
            <Badge variant={getCommonStatusBadgeVariant(status)}>
              {getStatusLabel(status)}
            </Badge>
          </div>
          {phone && (
            <p className="text-muted-foreground mt-0.5 text-sm">{phone}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/customers/${customerId}/edit`)}
          className="h-9"
        >
          <Edit className="mr-2 h-4 w-4" />
          编辑
        </Button>
        <Button size="sm" className="h-9">
          <ShoppingCart className="mr-2 h-4 w-4" />
          创建订单
        </Button>
      </div>
    </div>
  );
}
