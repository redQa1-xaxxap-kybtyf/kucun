'use client';

/**
 * 库存调整表单 - 使用 Server Actions + React 19 Hooks
 *
 * ✅ React 19 + Next.js 15 最佳实践：
 * 1. Server Actions - 服务端表单处理
 * 2. useOptimistic - 乐观更新 UI
 * 3. useActionState - 表单状态管理
 * 4. useFormStatus - 提交状态
 *
 * @see https://react.dev/reference/react/useOptimistic
 * @see https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
 */

import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useOptimistic, useTransition, useState } from 'react';

import { adjustInventory, type ActionResult } from '@/app/actions/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface InventoryAdjustFormProps {
  inventory: {
    id: string;
    productId: string;
    productName: string;
    currentQuantity: number;
  };
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * 库存调整表单组件
 */
export function InventoryAdjustFormWithActions({
  inventory,
  onSuccess,
  onCancel,
}: InventoryAdjustFormProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult<unknown> | null>(null);

  // ✅ React 19 useOptimistic - 乐观更新库存数量
  const [optimisticQuantity, setOptimisticQuantity] = useOptimistic(
    inventory.currentQuantity,
    (currentQty: number, adjustment: number) => currentQty + adjustment
  );

  /**
   * 表单提交处理
   */
  async function handleSubmit(formData: FormData) {
    const adjustment = Number(formData.get('quantity'));

    // ✅ 立即更新 UI（乐观更新）
    setOptimisticQuantity(adjustment);

    // ✅ 使用 useTransition 非阻塞状态更新
    startTransition(async () => {
      // 调用 Server Action
      const actionResult = await adjustInventory(formData);

      setResult(actionResult);

      if (actionResult.success) {
        // 成功后的处理
        setTimeout(() => {
          onSuccess?.();
        }, 1000);
      }
      // 如果失败，React 会自动回滚 optimisticQuantity
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {/* 隐藏字段 */}
      <input type="hidden" name="productId" value={inventory.productId} />

      {/* 产品信息显示 */}
      <div className="rounded-lg bg-gray-50 p-4">
        <h3 className="font-medium text-gray-900">{inventory.productName}</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-sm text-gray-600">当前库存:</span>
          <span
            className={`text-2xl font-bold ${
              optimisticQuantity !== inventory.currentQuantity
                ? 'text-blue-600'
                : 'text-gray-900'
            }`}
          >
            {optimisticQuantity}
          </span>
          {optimisticQuantity !== inventory.currentQuantity && (
            <span className="text-sm text-gray-500">
              (原: {inventory.currentQuantity})
            </span>
          )}
        </div>
      </div>

      {/* 调整数量 */}
      <div className="space-y-2">
        <Label htmlFor="quantity">
          调整数量 <span className="text-red-500">*</span>
        </Label>
        <Input
          id="quantity"
          name="quantity"
          type="number"
          required
          placeholder="正数为入库，负数为出库"
          disabled={isPending}
          className="font-mono"
        />
        <p className="text-xs text-gray-500">
          例如：+100（入库100）或 -50（出库50）
        </p>
      </div>

      {/* 调整原因 */}
      <div className="space-y-2">
        <Label htmlFor="reason">
          调整原因 <span className="text-red-500">*</span>
        </Label>
        <Select name="reason" required disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="请选择调整原因" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PURCHASE">采购入库</SelectItem>
            <SelectItem value="SALE">销售出库</SelectItem>
            <SelectItem value="RETURN">退货入库</SelectItem>
            <SelectItem value="DAMAGE">损坏报废</SelectItem>
            <SelectItem value="TRANSFER">调拨</SelectItem>
            <SelectItem value="COUNT">盘点调整</SelectItem>
            <SelectItem value="OTHER">其他</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 备注 */}
      <div className="space-y-2">
        <Label htmlFor="notes">备注</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="可选：填写详细说明..."
          disabled={isPending}
          rows={3}
        />
      </div>

      {/* 结果提示 */}
      {result && (
        <div
          className={`rounded-lg border p-3 ${
            result.success
              ? 'border-green-200 bg-green-50'
              : 'border-red-200 bg-red-50'
          }`}
        >
          <div className="flex items-center gap-2">
            {result.success ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-green-900">
                  调整成功！
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-sm font-medium text-red-900">
                  {result.error}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
        >
          取消
        </Button>

        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              提交中...
            </>
          ) : (
            '确认调整'
          )}
        </Button>
      </div>
    </form>
  );
}
