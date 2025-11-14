'use client';

/**
 * 方案二：带 Tooltip 的单位成本字段
 * 
 * 优点：
 * - 提示信息不占用空间，界面更简洁
 * - 用户主动查看时才显示详细说明
 * - 适合有经验的用户
 * 
 * 缺点：
 * - 需要用户主动悬停才能看到提示
 * - 移动端体验不如方案一
 */

import { HelpCircle } from 'lucide-react';
import { type UseFormReturn } from 'react-hook-form';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { InboundFormData } from '@/lib/types/inbound';

interface InboundCostFieldWithTooltipProps {
  form: UseFormReturn<InboundFormData, any, any>;
}

export function InboundCostFieldWithTooltip({
  form,
}: InboundCostFieldWithTooltipProps) {
  return (
    <FormField
      control={form.control}
      name="unitCost"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            单位成本（元/片） *
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 cursor-help text-gray-400 hover:text-gray-600" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <div className="space-y-1.5">
                    <p className="font-medium">请填写每片的成本</p>
                    <p className="text-xs text-gray-300">
                      如果知道每件成本，请先除以每件片数
                    </p>
                    <div className="border-t border-gray-700 pt-1.5">
                      <p className="text-xs font-medium text-blue-300">
                        示例：
                      </p>
                      <p className="text-xs text-gray-300">
                        每件100元，每件10片
                        <br />→ 单位成本 = 100 ÷ 10 = 10元/片
                      </p>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </FormLabel>
          <FormControl>
            <Input
              type="number"
              min="0.01"
              step="0.01"
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

