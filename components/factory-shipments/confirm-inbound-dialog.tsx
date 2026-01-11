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
import { useCreateInboundRecord } from '@/lib/api/inbound';
import { queryKeys } from '@/lib/queryKeys';
import { useUpdateFactoryShipmentItemInboundStatus } from '@/lib/services/factory-shipment-item-service';
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
  unitCost: number;
  remarks?: string;
};

type ShipmentItemWithProduct = FactoryShipmentOrder['items'][number] & {
  productId: string;
};

function createInitialFormState(
  items: ShipmentItemWithProduct[]
): Record<string, InboundFormState> {
  const initial: Record<string, InboundFormState> = {};
  for (const item of items) {
    initial[item.id] = {
      quantity: item.quantity,
      piecesPerUnit:
        item.piecesPerUnit && item.piecesPerUnit > 0 ? item.piecesPerUnit : 1,
      unitCost: (item as any).unitCost ?? 0,
      batchNumber: undefined,
      location: undefined,
      remarks: undefined,
    };
  }
  return initial;
}

function buildInboundPayload(
  item: ShipmentItemWithProduct,
  state: InboundFormState | undefined,
  orderNumber: string
): CreateInboundRequest {
  const quantity =
    state?.quantity && state.quantity > 0 ? state.quantity : item.quantity;
  const piecesPerUnit =
    state?.piecesPerUnit && state.piecesPerUnit > 0 ? state.piecesPerUnit : 1;
  const unitCost =
    state?.unitCost !== undefined && state.unitCost >= 0
      ? state.unitCost
      : (item as any).unitCost ?? 0;
  return {
    idempotencyKey: crypto.randomUUID(),
    productId: item.productId,
    inputQuantity: quantity,
    inputUnit: 'units',
    quantity,
    unitCost,
    reason: 'transfer',
    remarks:
      state?.remarks?.trim() ||
      `厂家发货补货 - ${orderNumber} - ${item.displayName}`,
    batchNumber: state?.batchNumber?.trim() || undefined,
    location: state?.location?.trim() || undefined,
    piecesPerUnit,
    weight: Number(item.weight ?? 0),
  };
}

/**
 * 手动处理项提示组件
 * 显示需要手动处理的自用明细（缺少库存产品信息）
 */
function ManualItemsNotice({
  manualItems,
}: {
  manualItems: FactoryShipmentOrder['items'];
}) {
  if (manualItems.length === 0) return null;
  return (
    <div className="rounded-lg border border-[hsl(var(--color-warning))] bg-[hsl(var(--color-warning-light))] p-4 shadow-[var(--shadow-light)]">
      <p className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--color-warning-dark))]">
        <AlertCircle className="h-4 w-4" />
        以下自用明细缺少库存产品信息，请在库存模块手动处理：
      </p>
      <ul className="mt-3 space-y-1.5 pl-6 text-sm text-[hsl(var(--color-warning-dark))]">
        {manualItems.map(item => (
          <li key={item.id} className="list-disc">
            {item.displayName}（数量：{item.quantity}，单位：{item.unit}）
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 表单字段组件 - 带标签和描述的输入框
 */
function FormFieldWithDescription({
  label,
  required,
  description,
  children,
}: {
  label: string;
  required?: boolean;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
        {label}
        {required && <span className="text-[hsl(var(--color-error))]"> *</span>}
      </Label>
      {children}
      <p className="text-xs text-[hsl(var(--color-text-secondary))]">
        {description}
      </p>
    </div>
  );
}

/**
 * 入库项卡片组件
 * 优化后的 UI 样式，与客户直发页面保持一致
 */
function InboundItemCard({
  item,
  state,
  onFieldChange,
}: {
  item: ShipmentItemWithProduct;
  state: InboundFormState | undefined;
  onFieldChange: (
    id: string,
    field: keyof InboundFormState,
    value: string
  ) => void;
}) {
  return (
    <div className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4 shadow-[var(--shadow-light)]">
      {/* 产品信息头部 */}
      <div className="mb-4 flex flex-col gap-2 border-b border-[hsl(var(--color-border-secondary))] pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
            {item.displayName}
          </p>
          <p className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
            订单数量：{item.quantity} {item.unit} · 销售单价：¥
            {item.unitPrice.toLocaleString('zh-CN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      {/* 表单字段 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormFieldWithDescription
          label="入库数量"
          required
          description="实际入库的数量，默认为订单数量"
        >
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="请输入入库数量"
            value={state?.quantity ?? item.quantity}
            onChange={e => onFieldChange(item.id, 'quantity', e.target.value)}
            className="h-10"
          />
        </FormFieldWithDescription>

        <FormFieldWithDescription
          label="每单位片数"
          required
          description="每个单位包含的片数，用于库存计算"
        >
          <Input
            type="number"
            min={1}
            step="1"
            placeholder="请输入每单位片数"
            value={state?.piecesPerUnit ?? 1}
            onChange={e =>
              onFieldChange(item.id, 'piecesPerUnit', e.target.value)
            }
            className="h-10"
          />
        </FormFieldWithDescription>

        <FormFieldWithDescription
          label="入库成本"
          required
          description="每单位的进货成本，用于库存成本核算"
        >
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="请输入入库成本"
            value={state?.unitCost ?? (item as any).unitCost ?? 0}
            onChange={e => onFieldChange(item.id, 'unitCost', e.target.value)}
            className="h-10"
          />
        </FormFieldWithDescription>

        <FormFieldWithDescription
          label="批次号"
          description="用于追溯和管理，建议填写"
        >
          <Input
            placeholder="填写批次号（可选）"
            value={state?.batchNumber ?? ''}
            onChange={e =>
              onFieldChange(item.id, 'batchNumber', e.target.value)
            }
            className="h-10"
          />
        </FormFieldWithDescription>

        <FormFieldWithDescription label="库位" description="货物存放的具体位置">
          <Input
            placeholder="填写库位信息（可选）"
            value={state?.location ?? ''}
            onChange={e => onFieldChange(item.id, 'location', e.target.value)}
            className="h-10"
          />
        </FormFieldWithDescription>

        <div className="md:col-span-2">
          <FormFieldWithDescription
            label="备注"
            description="记录质检情况、特殊处理要求等信息"
          >
            <Textarea
              placeholder="补充说明，例如质检情况、特殊处理要求等（可选）"
              rows={2}
              value={state?.remarks ?? ''}
              onChange={e => onFieldChange(item.id, 'remarks', e.target.value)}
              className="resize-none"
            />
          </FormFieldWithDescription>
        </div>
      </div>
    </div>
  );
}

/**
 * 入库项列表组件
 */
function ItemsList({
  items,
  formState,
  onFieldChange,
}: {
  items: ShipmentItemWithProduct[];
  formState: Record<string, InboundFormState>;
  onFieldChange: (
    id: string,
    field: keyof InboundFormState,
    value: string
  ) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]/40 p-8 text-center">
        <Boxes className="mb-3 h-8 w-8 text-[hsl(var(--color-text-secondary))] opacity-70" />
        <p className="text-sm text-[hsl(var(--color-text-secondary))]">
          当前没有需要入库的自用补货明细
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {items.map(item => (
        <InboundItemCard
          key={item.id}
          item={item}
          state={formState[item.id]}
          onFieldChange={onFieldChange}
        />
      ))}
    </div>
  );
}

function useInboundDialogState({
  items,
  open,
}: {
  items: FactoryShipmentOrder['items'];
  open: boolean;
}) {
  const actionableItems = useMemo(
    () =>
      items.filter(
        item =>
          item.ownership === FACTORY_SHIPMENT_ITEM_OWNERSHIP.SELF &&
          item.selfInboundStatus !== 'received'
      ),
    [items]
  );

  const itemsWithProduct: ShipmentItemWithProduct[] = useMemo(
    () =>
      actionableItems.filter(
        (item): item is ShipmentItemWithProduct =>
          typeof (item as ShipmentItemWithProduct).productId === 'string' &&
          (item as ShipmentItemWithProduct).productId.length > 0
      ),
    [actionableItems]
  );

  const manualItems = useMemo(
    () =>
      actionableItems.filter(
        item => !(item as ShipmentItemWithProduct).productId
      ),
    [actionableItems]
  );

  const [formState, setFormState] = useState<Record<string, InboundFormState>>(
    {}
  );

  useEffect(() => {
    if (open) {
      setFormState(createInitialFormState(itemsWithProduct));
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
          field === 'quantity' || field === 'piecesPerUnit' || field === 'unitCost'
            ? Number(value)
            : value,
      },
    }));
  };

  return {
    actionableItems,
    itemsWithProduct,
    manualItems,
    formState,
    handleFieldChange,
  };
}

/**
 * 对话框视图组件
 * 优化后的 UI 样式，与客户直发页面保持一致
 */
function ConfirmInboundDialogView({
  open,
  onOpenChange,
  manualItems,
  itemsWithProduct,
  formState,
  onFieldChange,
  onSubmit,
  isSubmitting,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manualItems: FactoryShipmentOrder['items'];
  itemsWithProduct: ShipmentItemWithProduct[];
  formState: Record<string, InboundFormState>;
  onFieldChange: (
    id: string,
    field: keyof InboundFormState,
    value: string
  ) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-[hsl(var(--color-primary))]" />
            确认自用货入库
          </DialogTitle>
          <DialogDescription>
            自动为自用补货创建入库记录，并更新厂家发货明细状态
          </DialogDescription>
        </DialogHeader>

        {/* 手动处理项提示 */}
        <ManualItemsNotice manualItems={manualItems} />

        {/* 表单 */}
        <form onSubmit={onSubmit} className="space-y-6">
          <ItemsList
            items={itemsWithProduct}
            formState={formState}
            onFieldChange={onFieldChange}
          />

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || isPending}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting || isPending || itemsWithProduct.length === 0
              }
            >
              {isSubmitting || isPending
                ? '处理中...'
                : `确认入库（${itemsWithProduct.length}）`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
  const updateItemInboundStatusMutation =
    useUpdateFactoryShipmentItemInboundStatus();

  const { itemsWithProduct, manualItems, formState, handleFieldChange } =
    useInboundDialogState({
      items,
      open,
    });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!itemsWithProduct.length) {
      toast({
        title: '没有可入库的自用货',
        description: '所有自用补货均无对应库存产品，请手动处理这些明细。',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const processedIds: string[] = [];
      for (const item of itemsWithProduct) {
        const payload = buildInboundPayload(
          item,
          formState[item.id],
          orderNumber
        );
        await createInboundMutation.mutateAsync(payload);
        processedIds.push(item.id);
      }

      if (processedIds.length > 0) {
        await updateItemInboundStatusMutation.mutateAsync({
          orderId,
          data: { itemIds: processedIds },
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.factoryShipments.detail(orderId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.factoryShipments.lists(),
        }),
      ]);

      toast({
        title: '自用货入库完成',
        description: `成功处理 ${processedIds.length} 条自用补货明细。`,
        variant: 'success',
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
    <ConfirmInboundDialogView
      open={open}
      onOpenChange={onOpenChange}
      manualItems={manualItems}
      itemsWithProduct={itemsWithProduct}
      formState={formState}
      onFieldChange={handleFieldChange}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      isPending={createInboundMutation.isPending}
    />
  );
}
