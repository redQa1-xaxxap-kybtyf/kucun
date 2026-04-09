import { Card, CardContent } from '@/components/ui/card';
import { formatNumber } from '@/lib/utils/format';

interface StatisticsCardsProps {
  openingBalance: number | undefined;
  currentQuantity: number | undefined;
  netChange: number | undefined;
  totalInbound: number;
  totalOutbound: number;
  totalAdjustment: number;
}

const formatChange = (value: number) =>
  `${value > 0 ? '+' : ''}${formatNumber(value)}`;

export function StatisticsCards({
  openingBalance,
  currentQuantity,
  netChange,
  totalInbound,
  totalOutbound,
  totalAdjustment,
}: StatisticsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card className="card-shadow-light border border-[hsl(var(--color-border-primary))]">
        <CardContent className="p-4">
          <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
            期初库存
          </div>
          <div className="mt-2 text-2xl font-bold text-[hsl(var(--color-primary))]">
            {openingBalance !== undefined ? formatNumber(openingBalance) : '—'}
          </div>
          <div className="mt-1 text-xs text-[hsl(var(--color-text-tertiary))]">
            片
          </div>
        </CardContent>
      </Card>

      <Card className="card-shadow-light border border-green-200 bg-green-50/50">
        <CardContent className="p-4">
          <div className="text-xs font-medium text-gray-600">当前库存</div>
          <div className="mt-2 text-2xl font-bold text-green-600">
            {currentQuantity !== undefined
              ? formatNumber(currentQuantity)
              : '—'}
          </div>
          <div className="mt-1 text-xs text-gray-500">片</div>
        </CardContent>
      </Card>

      <Card className="card-shadow-light border border-blue-200 bg-blue-50/50">
        <CardContent className="p-4">
          <div className="text-xs font-medium text-gray-600">净变动</div>
          <div className="mt-2 text-2xl font-bold text-blue-600">
            {netChange !== undefined ? formatChange(netChange) : '—'}
          </div>
          <div className="mt-1 text-xs text-gray-500">片</div>
        </CardContent>
      </Card>

      <Card className="card-shadow-light border border-[hsl(var(--color-border-primary))]">
        <CardContent className="p-4">
          <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
            变动汇总
          </div>
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[hsl(var(--color-text-secondary))]">
                入库
              </span>
              <span className="font-semibold text-green-600">
                +{formatNumber(totalInbound)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[hsl(var(--color-text-secondary))]">
                出库
              </span>
              <span className="font-semibold text-red-600">
                -{formatNumber(totalOutbound)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[hsl(var(--color-text-secondary))]">
                调整
              </span>
              <span className="font-semibold text-orange-600">
                {formatChange(totalAdjustment)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
