'use client';

import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Boxes, PackageCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { factoryShipmentQueryKeys } from '@/lib/api/factory-shipments';
import { useCreateInboundRecord } from '@/lib/api/inbound';
import {
  FACTORY_SHIPMENT_ITEM_OWNERSHIP,
  type FactoryShipmentOrder,
} from '@/lib/types/factory-shipment';
import type { CreateInboundRequest } from '@/lib/types/inbound';

interface ConfirmInboundDialogProps {
  orderId: string;
  orderNumber: string;
  items: FactoryShipmentOrder['items'];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type InboundFormState = {
  quantity: number;
  batchNumber?: string;
  location?: string;
  piecesPerUnit: number;
  remarks?: string;
};

export function ConfirmInboundDialog({
  orderId,
  orderNumber,
  items,
  open,
  onOpenChange,
  onSuccess,
}: ConfirmInboundDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createInboundMutation = useCreateInboundRecord();

  const actionableItems = useMemo(
    () =>
      items.filter(
        item =>
          item.ownership === FACTORY_SHIPMENT_ITEM_OWNERSHIP.SELF &&
          item.selfInboundStatus !== 'received'
      ),
    [items]
  );

  const itemsWithProduct = useMemo(
    () =>
      actionableItems.filter(
        (
          item
        ): item is (typeof actionableItems)[number] & { productId: string } =>
          typeof item.productId === 'string' && item.productId.length > 0
      ),
    [actionableItems]
  );

  const manualItems = useMemo(
    () => actionableItems.filter(item => !item.productId),
    [actionableItems]
  );

  const [formState, setFormState] = useState<Record<string, InboundFormState>>(
    {}
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const initialState: Record<string, InboundFormState> = {};
      itemsWithProduct.forEach(item => {
        initialState[item.id] = {
          quantity: item.quantity,
          piecesPerUnit: 1,
          batchNumber: undefined,
          location: undefined,
          remarks: undefined,
        };
      });
      setFormState(initialState);
    }
  }, [open, itemsWithProduct]);

  const handleFieldChange = (
    itemId: string,
    field: keyof InboundFormState,
    value: string
  ) => {
    setFormState(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]:
          field === 'quantity' || field === 'piecesPerUnit'
            ? Number(value)
            : value,
      },
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!itemsWithProduct.length) {
      toast({
        title: '没有可入库的自用货',
        description: '所有自用补货均无对应库存商品，请手动处理这些明细。',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    const processedItemIds: string[] = [];

    try {
      for (const item of itemsWithProduct) {
        const currentState = formState[item.id];
        const quantity =
          currentState?.quantity && currentState.quantity > 0
            ? currentState.quantity
            : item.quantity;
        const piecesPerUnit =
          currentState?.piecesPerUnit && currentState.piecesPerUnit > 0
            ? currentState.piecesPerUnit
            : 1;

        const inboundPayload: CreateInboundRequest = {
          idempotencyKey: crypto.randomUUID(),
          productId: item.productId,
          inputQuantity: quantity,
          inputUnit: 'units',
          quantity,
          reason: 'transfer',
          remarks:
            currentState?.remarks?.trim() ||
            `厂家发货补货 - ${orderNumber} - ${item.displayName}`,
          batchNumber: currentState?.batchNumber?.trim() || undefined,
          location: currentState?.location?.trim() || undefined,
          piecesPerUnit,
          weight: Number(item.weight ?? 0),
        };

        await createInboundMutation.mutateAsync(inboundPayload);
        processedItemIds.push(item.id);
      }

      if (processedItemIds.length > 0) {
        const response = await fetch(
          `/api/factory-shipments/${orderId}/inbound`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ itemIds: processedItemIds }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || '更新自用入库状态失败');
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: factoryShipmentQueryKeys.detail(orderId),
        }),
        queryClient.invalidateQueries({
          queryKey: factoryShipmentQueryKeys.lists(),
        }),
      ]);

      toast({
        title: '自用货入库完成',
        description: `成功处理 ${processedItemIds.length} 条自用补货明细。`,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: '处理入库失败',
        description:
          error instanceof Error
            ? error.message
            : '创建入库记录或更新自用货状态失败，请稍后重试。',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5" />
            确认自用货入库
          </DialogTitle>
          <DialogDescription>
            自动为自用补货创建入库记录，并更新厂家发货明细状态。
          </DialogDescription>
        </DialogHeader>

        {manualItems.length > 0 && (
          <div className="rounded-md border border-dashed border-[hsl(var(--color-warning))] bg-[hsl(var(--color-warning-light))] p-3 text-sm text-[hsl(var(--color-warning-dark))]">
            <p className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              以下自用明细缺少库存商品信息，请在库存模块手动处理：
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              {manualItems.map(item => (
                <li key={item.id}>
                  {item.displayName}（数量：{item.quantity}，单位：{item.unit}）
                </li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {itemsWithProduct.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]/40 p-6 text-center text-sm text-[hsl(var(--color-text-secondary))]">
                <Boxes className="mb-2 h-6 w-6 opacity-70" />
                当前没有需要入库的自用补货明细。
              </div>
            ) : (
              itemsWithProduct.map(item => {
                const state = formState[item.id];
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                          {item.displayName}
                        </p>
                        <p className="text-xs text-[hsl(var(--color-text-secondary))]">
                          数量：{item.quantity} {item.unit} · 单价：
                          {item.unitPrice.toLocaleString('zh-CN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">入库数量</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={state?.quantity ?? item.quantity}
                          onChange={event =>
                            handleFieldChange(
                              item.id,
                              'quantity',
                              event.target.value
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          每单位片数
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          step="1"
                          value={state?.piecesPerUnit ?? 1}
                          onChange={event =>
                            handleFieldChange(
                              item.id,
                              'piecesPerUnit',
                              event.target.value
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          批次号（可选）
                        </Label>
                        <Input
                          placeholder="填写批次号"
                          value={state?.batchNumber ?? ''}
                          onChange={event =>
                            handleFieldChange(
                              item.id,
                              'batchNumber',
                              event.target.value
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          库位（可选）
                        </Label>
                        <Input
                          placeholder="填写库位信息"
                          value={state?.location ?? ''}
                          onChange={event =>
                            handleFieldChange(
                              item.id,
                              'location',
                              event.target.value
                            )
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-sm font-medium">
                          备注（可选）
                        </Label>
                        <Textarea
                          placeholder="补充说明，例如质检情况、特殊处理要求等"
                          rows={2}
                          value={state?.remarks ?? ''}
                          onChange={event =>
                            handleFieldChange(
                              item.id,
                              'remarks',
                              event.target.value
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter className="flex space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || createInboundMutation.isPending}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                createInboundMutation.isPending ||
                itemsWithProduct.length === 0
              }
            >
              {isSubmitting || createInboundMutation.isPending
                ? '处理中...'
                : `确认入库（${itemsWithProduct.length}）`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
