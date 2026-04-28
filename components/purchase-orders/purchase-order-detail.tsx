'use client';

import { AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import {
  deletePurchaseOrder,
  getPurchaseOrderById,
  updatePurchaseOrderStatus,
} from '@/app/actions/purchase-orders';
import { ContentLoading } from '@/components/common/loading';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import {
  PURCHASE_ORDER_STATUS,
  type PurchaseOrderStatus,
} from '@/lib/types/purchase-order';

import { STATUS_CONFIG, STATUS_FLOW } from './purchase-order-detail-constants';
import {
  CancelOrderDialog,
  CostSummaryCard,
  DeleteOrderDialog,
  ExpenseRecordsCard,
  OrderActionsCard,
  OrderSummaryCard,
  ProductDetailsCard,
  SupplierInfoCard,
} from './purchase-order-detail-sections';
import type { PurchaseOrderDetailData } from './purchase-order-detail.types';
import type { PurchaseOrderShippingFormValues } from './purchase-order-shipping-dialog';

const PurchaseOrderShippingDialog = dynamic(
  () =>
    import('./purchase-order-shipping-dialog').then(
      mod => mod.PurchaseOrderShippingDialog
    ),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-sm rounded-md bg-[hsl(var(--color-bg-card))] p-6 shadow-md">
          <div className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
            正在加载...
          </div>
        </div>
      </div>
    ),
  }
);

interface PurchaseOrderDetailProps {
  orderId: string;
  onEdit?: () => void;
  onBack?: () => void;
}

export function PurchaseOrderDetail({
  orderId,
  onEdit,
  onBack,
}: PurchaseOrderDetailProps) {
  const router = useRouter();
  const { toast } = useToast();

  const { order, isLoading, reloadOrder } = usePurchaseOrderDetailData(
    orderId,
    toast
  );
  const {
    deleteDialogOpen,
    cancelDialogOpen,
    openDeleteDialog,
    openCancelDialog,
    setDeleteDialogOpen,
    setCancelDialogOpen,
    closeDeleteDialog,
    closeCancelDialog,
  } = usePurchaseOrderDetailDialogs();
  const {
    isSubmitting,
    handleStatusChange,
    handleDelete,
    confirmCancelStatus,
  } = usePurchaseOrderDetailActions({
    order,
    orderId,
    router,
    toast,
    reloadOrder,
    closeDeleteDialog,
    closeCancelDialog,
  });

  // 所有 Hooks 必须在 early return 之前调用
  const [shippingDialogState, setShippingDialogState] = useState<{
    open: boolean;
    mode: 'confirm_shipment' | 'supplement';
    targetStatus: PurchaseOrderStatus | null;
    defaultValues?: PurchaseOrderShippingFormValues;
  }>({
    open: false,
    mode: 'confirm_shipment',
    targetStatus: null,
    defaultValues: undefined,
  });

  const closeShippingDialog = useCallback(() => {
    setShippingDialogState(prev => ({
      ...prev,
      open: false,
      targetStatus: null,
    }));
  }, []);

  const handleShippingDialogSubmit = useCallback(
    async (values: PurchaseOrderShippingFormValues) => {
      if (!shippingDialogState.targetStatus) {
        return;
      }
      await handleStatusChange(shippingDialogState.targetStatus, values);
      closeShippingDialog();
    },
    [closeShippingDialog, handleStatusChange, shippingDialogState.targetStatus]
  );

  const handleStatusAction = useCallback(
    (nextStatus: PurchaseOrderStatus) => {
      if (!order) {
        return;
      }

      if (nextStatus === PURCHASE_ORDER_STATUS.SHIPPED) {
        setShippingDialogState({
          open: true,
          mode: 'confirm_shipment',
          targetStatus: nextStatus,
          defaultValues: {
            containerNumber: order.containerNumber || '',
            shippingCompany: order.shippingCompany || '',
            estimatedArrival: order.estimatedArrival
              ? new Date(order.estimatedArrival)
              : undefined,
            shipmentDate: new Date(),
          },
        });
        return;
      }

      if (
        nextStatus === PURCHASE_ORDER_STATUS.IN_TRANSIT &&
        !order.shippingCompany
      ) {
        setShippingDialogState({
          open: true,
          mode: 'supplement',
          targetStatus: nextStatus,
          defaultValues: {
            containerNumber: order.containerNumber || '',
            shippingCompany: '',
            estimatedArrival: order.estimatedArrival
              ? new Date(order.estimatedArrival)
              : undefined,
          },
        });
        return;
      }

      void handleStatusChange(nextStatus);
    },
    [handleStatusChange, order]
  );

  // Early return 必须在所有 Hooks 之后
  if (isLoading) {
    return <ContentLoading text="加载订单详情中..." />;
  }

  if (!order) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>错误</AlertTitle>
            <AlertDescription>订单不存在或已被删除</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const currentStatus = order.status as PurchaseOrderStatus;
  const availableStatuses = STATUS_FLOW[currentStatus] || [];
  const isDraft = currentStatus === PURCHASE_ORDER_STATUS.DRAFT;

  return (
    <div className="space-y-6 p-6">
      <OrderSummaryCard
        order={order}
        currentStatus={currentStatus}
        isDraft={isDraft}
        onEdit={onEdit}
        onBack={onBack}
        onRequestDelete={openDeleteDialog}
      />
      <SupplierInfoCard items={order.items} />
      <ProductDetailsCard items={order.items} totalAmount={order.totalAmount} />
      <ExpenseRecordsCard expenses={order.expenses ?? []} />
      <CostSummaryCard
        totalAmount={order.totalAmount}
        expenseAmount={order.expenseAmount}
        costAmount={order.costAmount}
        hasAllocatedExpense={order.items?.some(
          item => (item.allocatedExpense || 0) > 0
        )}
      />
      <OrderActionsCard
        availableStatuses={availableStatuses}
        isSubmitting={isSubmitting}
        onStatusChange={handleStatusAction}
        onRequestCancel={openCancelDialog}
      />
      {shippingDialogState.open && (
        <PurchaseOrderShippingDialog
          open={shippingDialogState.open}
          mode={shippingDialogState.mode}
          orderNumber={order.orderNumber}
          defaultValues={shippingDialogState.defaultValues}
          isSubmitting={isSubmitting}
          onOpenChange={open =>
            setShippingDialogState(prev => ({
              ...prev,
              open,
              ...(open ? {} : { targetStatus: null }),
            }))
          }
          onSubmit={handleShippingDialogSubmit}
        />
      )}
      <DeleteOrderDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        isSubmitting={isSubmitting}
      />
      <CancelOrderDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onConfirm={confirmCancelStatus}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}

type ToastFn = ReturnType<typeof useToast>['toast'];

function usePurchaseOrderDetailData(orderId: string, toast: ToastFn) {
  const [order, setOrder] = useState<PurchaseOrderDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reloadOrder = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getPurchaseOrderById(orderId);
      if (result.data) {
        setOrder(result.data);
      } else {
        setOrder(null);
        toast({
          title: '加载失败',
          description: result.error ?? '订单不存在',
          variant: 'destructive',
        });
      }
    } catch (error) {
      setOrder(null);
      toast({
        title: '加载失败',
        description:
          error instanceof Error ? error.message : '无法加载采购订单详情',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [orderId, toast]);

  useEffect(() => {
    void reloadOrder();
  }, [reloadOrder]);

  return { order, isLoading, reloadOrder };
}

function usePurchaseOrderDetailDialogs() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  const openDeleteDialog = useCallback(() => setDeleteDialogOpen(true), []);
  const closeDeleteDialog = useCallback(() => setDeleteDialogOpen(false), []);
  const openCancelDialog = useCallback(() => setCancelDialogOpen(true), []);
  const closeCancelDialog = useCallback(() => setCancelDialogOpen(false), []);

  return {
    deleteDialogOpen,
    cancelDialogOpen,
    openDeleteDialog,
    closeDeleteDialog,
    openCancelDialog,
    closeCancelDialog,
    setDeleteDialogOpen,
    setCancelDialogOpen,
  };
}

interface UsePurchaseOrderDetailActionsParams {
  order: PurchaseOrderDetailData | null;
  orderId: string;
  router: ReturnType<typeof useRouter>;
  toast: ToastFn;
  reloadOrder: () => Promise<void>;
  closeDeleteDialog: () => void;
  closeCancelDialog: () => void;
}

type StatusExtraPayload = PurchaseOrderShippingFormValues;

function usePurchaseOrderDetailActions({
  order,
  orderId,
  router,
  toast,
  reloadOrder,
  closeDeleteDialog,
  closeCancelDialog,
}: UsePurchaseOrderDetailActionsParams) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStatusChange = useCallback(
    async (newStatus: PurchaseOrderStatus, extra?: StatusExtraPayload) => {
      if (!order) return;

      setIsSubmitting(true);
      try {
        const formData = new FormData();
        const payload: Record<string, unknown> = {
          orderId,
          status: newStatus,
        };

        if (extra?.containerNumber !== undefined) {
          payload.containerNumber = extra.containerNumber;
        }
        if (extra?.shippingCompany !== undefined) {
          payload.shippingCompany = extra.shippingCompany;
        }
        if (extra?.estimatedArrival) {
          payload.estimatedArrival = extra.estimatedArrival.toISOString();
        }
        if (extra?.shipmentDate) {
          payload.shipmentDate = extra.shipmentDate.toISOString();
        }

        formData.append('data', JSON.stringify(payload));

        const result = await updatePurchaseOrderStatus(formData);

        if (result.success) {
          toast({
            title: '状态更新成功',
            description: `订单状态已更新为 ${STATUS_CONFIG[newStatus].label}`,
          });
          await reloadOrder();
        } else {
          toast({
            title: '状态更新失败',
            description: result.error,
            variant: 'destructive',
          });
        }
      } catch (error) {
        toast({
          title: '状态更新失败',
          description:
            error instanceof Error ? error.message : '无法更新采购订单状态',
          variant: 'destructive',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [order, orderId, reloadOrder, toast]
  );

  const handleDelete = useCallback(async () => {
    setIsSubmitting(true);
    const result = await deletePurchaseOrder(orderId);

    if (result.success) {
      toast({
        title: '删除成功',
        description: '采购订单已删除',
      });
      router.push('/purchase-orders');
    } else {
      toast({
        title: '删除失败',
        description: result.error,
        variant: 'destructive',
      });
    }
    setIsSubmitting(false);
    closeDeleteDialog();
  }, [closeDeleteDialog, orderId, router, toast]);

  const confirmCancelStatus = useCallback(async () => {
    closeCancelDialog();
    await handleStatusChange(PURCHASE_ORDER_STATUS.CANCELLED);
  }, [closeCancelDialog, handleStatusChange]);

  return {
    isSubmitting,
    handleStatusChange,
    handleDelete,
    confirmCancelStatus,
  };
}
