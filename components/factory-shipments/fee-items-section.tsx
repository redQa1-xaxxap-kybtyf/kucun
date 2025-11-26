'use client';

import { DollarSign } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    FACTORY_SHIPMENT_FEE_TYPE_LABELS,
    type FactoryShipmentOrderFeeItem,
} from '@/lib/types/factory-shipment';
import { formatAmount } from '@/lib/utils/factory-shipment-helpers';

interface FeeItemsSectionProps {
  feeItems?: FactoryShipmentOrderFeeItem[];
}

/**
 * 厂家发货订单费用明细组件
 *
 * 功能：
 * - 显示费用明细表格
 * - 区分客户承担和公司承担的费用
 * - 显示费用汇总统计
 * 优化：紧凑布局
 */
export function FeeItemsSection({ feeItems }: FeeItemsSectionProps) {
  // 如果没有费用项，显示空状态
  if (!feeItems || feeItems.length === 0) {
    return (
      <Card
        className="border border-[hsl(var(--color-border-primary))]"
        style={{ boxShadow: 'var(--shadow-medium)' }}
      >
        <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <DollarSign className="h-4 w-4 text-[hsl(var(--color-primary))]" />
            费用明细
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-[hsl(var(--color-bg-card))] p-4">
          <div className="text-center text-sm text-[hsl(var(--color-text-tertiary))]">
            暂无费用
          </div>
        </CardContent>
      </Card>
    );
  }

  // 计算费用汇总
  const customerFees = feeItems
    .filter(fee => fee.paidBy === 'customer')
    .reduce((sum, fee) => sum + fee.feeAmount, 0);

  const companyFees = feeItems
    .filter(fee => fee.paidBy === 'company')
    .reduce((sum, fee) => sum + fee.feeAmount, 0);

  const totalFees = customerFees + companyFees;

  return (
    <Card
      className="border border-[hsl(var(--color-border-primary))]"
      style={{ boxShadow: 'var(--shadow-medium)' }}
    >
      <CardHeader className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <DollarSign className="h-4 w-4 text-[hsl(var(--color-primary))]" />
            费用明细
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            共 {feeItems.length} 项
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="bg-[hsl(var(--color-bg-card))] p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[hsl(var(--color-bg-table-header))]">
              <TableRow className="border-b border-[hsl(var(--color-border-primary))]">
                <TableHead className="w-[50px] py-2 text-xs font-semibold">
                  序号
                </TableHead>
                <TableHead className="min-w-[120px] py-2 text-xs font-semibold">
                  费用类型
                </TableHead>
                <TableHead className="min-w-[180px] py-2 text-xs font-semibold">
                  费用名称
                </TableHead>
                <TableHead className="w-[140px] py-2 text-right text-xs font-semibold">
                  费用金额
                </TableHead>
                <TableHead className="w-[120px] py-2 text-xs font-semibold">
                  承担方
                </TableHead>
                <TableHead className="min-w-[200px] py-2 text-xs font-semibold">
                  备注
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feeItems.map((fee, index) => (
                <TableRow
                  key={fee.id}
                  className="border-b border-[hsl(var(--color-border-primary))] hover:bg-[hsl(var(--color-bg-hover))]"
                >
                  <TableCell className="py-2 text-center text-sm text-[hsl(var(--color-text-secondary))]">
                    {index + 1}
                  </TableCell>
                  <TableCell className="py-2 text-sm text-[hsl(var(--color-text-primary))]">
                    {FACTORY_SHIPMENT_FEE_TYPE_LABELS[fee.feeType]}
                  </TableCell>
                  <TableCell className="py-2 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                    {fee.feeName}
                  </TableCell>
                  <TableCell className="py-2 text-right text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                    {formatAmount(fee.feeAmount)}
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge
                      variant={
                        fee.paidBy === 'customer' ? 'default' : 'secondary'
                      }
                      className="text-xs"
                    >
                      {fee.paidBy === 'customer' ? '客户承担' : '公司承担'}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-sm text-[hsl(var(--color-text-secondary))]">
                    {fee.remarks || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* 费用汇总 */}
        <Separator />
        <div className="bg-[hsl(var(--color-bg-secondary))] p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                客户承担费用
              </p>
              <p className="text-base font-bold text-blue-600">
                {formatAmount(customerFees)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                公司承担费用
              </p>
              <p className="text-base font-bold text-gray-600">
                {formatAmount(companyFees)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                费用总计
              </p>
              <p className="text-base font-bold text-[hsl(var(--color-primary))]">
                {formatAmount(totalFees)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
