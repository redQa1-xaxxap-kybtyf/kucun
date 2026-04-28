'use client';

/**
 * 方案三：带辅助计算器的单位成本字段
 *
 * 优点：
 * - 提供辅助计算功能，用户体验最好
 * - 自动计算每片成本，减少用户计算错误
 * - 适合新手用户
 *
 * 缺点：
 * - 代码复杂度较高
 * - 占用更多界面空间
 * - 需要额外的状态管理
 */

import { Calculator } from 'lucide-react';
import { useState } from 'react';
import { type UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { InboundFormData } from '@/lib/types/inbound';
import {
  COST_PRICE_STEP,
  formatCostPrice,
  roundCostPrice,
} from '@/lib/utils/cost-price';

interface InboundCostFieldWithCalculatorProps {
  form: UseFormReturn<InboundFormData, any, any>;
}

export function InboundCostFieldWithCalculator({
  form,
}: InboundCostFieldWithCalculatorProps) {
  const [showCalculator, setShowCalculator] = useState(false);
  const [unitCost, setUnitCost] = useState<string>('');
  const [piecesPerUnit, setPiecesPerUnit] = useState<string>('');
  const [calculatedCost, setCalculatedCost] = useState<number | null>(null);

  // 计算每片成本
  const handleCalculate = () => {
    const cost = parseFloat(unitCost);
    const pieces = parseFloat(piecesPerUnit);

    if (!isNaN(cost) && !isNaN(pieces) && pieces > 0) {
      const result = cost / pieces;
      const rounded = roundCostPrice(result);
      setCalculatedCost(rounded);
    } else {
      setCalculatedCost(null);
    }
  };

  // 应用计算结果
  const handleApply = () => {
    if (calculatedCost !== null) {
      form.setValue('unitCost', calculatedCost);
      setShowCalculator(false);
      // 重置计算器
      setUnitCost('');
      setPiecesPerUnit('');
      setCalculatedCost(null);
    }
  };

  return (
    <FormField
      control={form.control}
      name="unitCost"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center justify-between text-sm font-semibold text-gray-900">
            <span>单位成本（元/片） *</span>
            <Popover open={showCalculator} onOpenChange={setShowCalculator}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-primary hover:text-primary/80 h-6 gap-1 px-2 text-xs"
                >
                  <Calculator className="h-3.5 w-3.5" />
                  辅助计算
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">单位成本计算器</h4>
                    <p className="text-xs text-gray-500">
                      输入每件成本和装箱数，自动计算每片成本
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-700">
                        每件成本（元）
                      </label>
                      <Input
                        type="number"
                        min="0.01"
                        step={COST_PRICE_STEP}
                        placeholder="例如：100"
                        value={unitCost}
                        onChange={e => {
                          setUnitCost(e.target.value);
                          setCalculatedCost(null);
                        }}
                        className="h-8"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-700">
                        装箱数
                      </label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="例如：10"
                        value={piecesPerUnit}
                        onChange={e => {
                          setPiecesPerUnit(e.target.value);
                          setCalculatedCost(null);
                        }}
                        className="h-8"
                      />
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCalculate}
                      className="w-full"
                    >
                      计算
                    </Button>

                    {calculatedCost !== null && (
                      <div className="space-y-2 rounded-md bg-[hsl(var(--color-primary-light))] p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-700">
                            每片成本：
                          </span>
                          <span className="text-lg font-bold text-[hsl(var(--color-primary))]">
                            {formatCostPrice(calculatedCost)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {unitCost} ÷ {piecesPerUnit} ={' '}
                          {formatCostPrice(calculatedCost, {
                            withSymbol: false,
                          })}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleApply}
                          className="w-full"
                        >
                          应用到表单
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              min="0.01"
              step={COST_PRICE_STEP}
              placeholder="请输入每片成本"
              className="h-9"
              {...field}
              value={field.value ?? ''}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
