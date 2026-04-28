'use client';

import { Check, TrendingUp } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ItemPricingResult } from '@/lib/services/factory-shipment-pricing-service';
import { formatCostPrice } from '@/lib/utils/cost-price';

interface PricingResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: ItemPricingResult[];
  totalExpenses: number;
  onConfirm: () => void;
}

/**
 * 定价结果预览对话框
 * 显示测算销售价和利润率
 */
export function PricingResultDialog({
  open,
  onOpenChange,
  results,
  totalExpenses,
  onConfirm,
}: PricingResultDialogProps) {
  // 计算汇总数据
  const summary = results.reduce(
    (acc, result) => ({
      totalCost: acc.totalCost + result.finalUnitCost,
      totalPrice: acc.totalPrice + result.suggestedUnitPrice,
      avgMargin: acc.avgMargin + result.profitMargin,
    }),
    { totalCost: 0, totalPrice: 0, avgMargin: 0 }
  );

  const avgProfitMargin =
    results.length > 0 ? summary.avgMargin / results.length : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="text-primary h-5 w-5" />
            销售价测算
          </DialogTitle>
          <DialogDescription>目标利润率 20%</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 汇总信息 */}
          <div className="bg-muted/50 grid grid-cols-3 gap-4 rounded-lg p-4">
            <div>
              <div className="text-muted-foreground text-sm">总运费</div>
              <div className="text-lg font-semibold">
                ¥{totalExpenses.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">产品数量</div>
              <div className="text-lg font-semibold">{results.length} 个</div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">平均利润率</div>
              <div className="text-lg font-semibold text-green-600">
                {avgProfitMargin.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* 明细表格 */}
          <div className="max-h-[400px] overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[60px]">序号</TableHead>
                  <TableHead>进货价</TableHead>
                  <TableHead>分摊运费</TableHead>
                  <TableHead>最终成本</TableHead>
                  <TableHead>测算售价</TableHead>
                  <TableHead className="text-right">利润率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result, index) => (
                  <TableRow key={result.itemId}>
                    <TableCell className="text-center font-medium">
                      {index + 1}
                    </TableCell>
                    <TableCell>{formatCostPrice(result.unitCost)}</TableCell>
                    <TableCell>¥{result.allocatedExpense.toFixed(2)}</TableCell>
                    <TableCell>
                      {formatCostPrice(result.finalUnitCost)}
                    </TableCell>
                    <TableCell className="font-semibold">
                      ¥{result.suggestedUnitPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          result.profitMargin >= 20
                            ? 'text-green-600'
                            : result.profitMargin >= 10
                              ? 'text-yellow-600'
                              : 'text-red-600'
                        }
                      >
                        {result.profitMargin.toFixed(1)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onConfirm}>
            <Check className="mr-2 h-4 w-4" />
            应用价格
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
