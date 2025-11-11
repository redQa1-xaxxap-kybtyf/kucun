'use client';

import {
  ArrowLeft,
  Calendar,
  Edit,
  Package,
  Trash2,
  User,
  Warehouse,
} from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PURCHASE_ORDER_STATUS,
  type PurchaseOrderStatus,
} from '@/lib/types/purchase-order';

import {
  EXPENSE_TYPE_LABELS,
  STATUS_ACTION_LABELS,
  STATUS_CONFIG,
  formatCurrency,
} from './purchase-order-detail-constants';
import type { PurchaseOrderDetailData } from './purchase-order-detail.types';

interface OrderSummaryCardProps {
  order: PurchaseOrderDetailData;
  currentStatus: PurchaseOrderStatus;
  isDraft: boolean;
  onEdit?: () => void;
  onBack?: () => void;
  onRequestDelete: () => void;
}

export function OrderSummaryCard({
  order,
  currentStatus,
  isDraft,
  onEdit,
  onBack,
  onRequestDelete,
}: OrderSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Warehouse className="text-primary h-8 w-8" />
            <div>
              <CardTitle className="text-2xl">采购订单详情</CardTitle>
              <p className="text-muted-foreground text-sm">
                订单号: {order.orderNumber}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {isDraft && (
              <>
                <Button variant="outline" onClick={onEdit}>
                  <Edit className="mr-2 h-4 w-4" />
                  编辑
                </Button>
                <Button variant="destructive" onClick={onRequestDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </Button>
              </>
            )}
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-sm">状态</p>
            <Badge variant={STATUS_CONFIG[currentStatus].variant}>
              {STATUS_CONFIG[currentStatus].label}
            </Badge>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">集装箱号</p>
            <p>{order.containerNumber || '-'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">船运公司</p>
            <p>
              {order.shippingCompany
                ? order.shippingCompany
                : currentStatus === PURCHASE_ORDER_STATUS.SHIPPED ||
                    currentStatus === PURCHASE_ORDER_STATUS.IN_TRANSIT
                  ? '待补充'
                  : '-'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">创建时间</p>
            <p>{new Date(order.createdAt).toLocaleString('zh-CN')}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">更新时间</p>
            <p>{new Date(order.updatedAt).toLocaleString('zh-CN')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface SupplierInfoCardProps {
  items: PurchaseOrderDetailData['items'];
}

export function SupplierInfoCard({ items }: SupplierInfoCardProps) {
  // 按供应商分组统计
  const supplierMap = new Map<
    string,
    { name: string; phone?: string; address?: string; amount: number; itemCount: number }
  >();

  for (const item of items) {
    if (item.supplierId && item.supplier) {
      const existing = supplierMap.get(item.supplierId);
      if (existing) {
        existing.amount += item.totalPrice;
        existing.itemCount += 1;
      } else {
        supplierMap.set(item.supplierId, {
          name: item.supplier.name,
          phone: item.supplier.phone,
          address: item.supplier.address,
          amount: item.totalPrice,
          itemCount: 1,
        });
      }
    }
  }

  const suppliers = Array.from(supplierMap.values()).sort(
    (a, b) => b.amount - a.amount
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <User className="h-5 w-5" />
          <CardTitle>供应商信息 ({suppliers.length}个)</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {suppliers.length > 0 ? (
          <div className="space-y-4">
            {suppliers.map((supplier, index) => (
              <div
                key={index}
                className={`grid gap-4 md:grid-cols-2 ${
                  index > 0 ? 'border-t pt-4' : ''
                }`}
              >
                <div>
                  <p className="text-muted-foreground text-sm">供应商名称</p>
                  <p className="font-medium">{supplier.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">联系电话</p>
                  <p>{supplier.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">地址</p>
                  <p>{supplier.address || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">采购金额</p>
                  <p className="font-medium">
                    ¥{supplier.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    <span className="text-muted-foreground text-sm ml-2">
                      ({supplier.itemCount}个产品)
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">供应商信息不可用</p>
        )}
      </CardContent>
    </Card>
  );
}

interface ProductDetailsCardProps {
  items: PurchaseOrderDetailData['items'];
  totalAmount: number;
}

export function ProductDetailsCard({
  items,
  totalAmount,
}: ProductDetailsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          <CardTitle>产品明细</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {items && items.length > 0 ? (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>序号</TableHead>
                    <TableHead>产品编码</TableHead>
                    <TableHead>供应商</TableHead>
                    <TableHead className="text-right">数量</TableHead>
                    <TableHead className="text-right">采购单价</TableHead>
                    <TableHead className="text-right">总价</TableHead>
                    <TableHead>备注</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{item.productCode}</TableCell>
                      <TableCell>{item.supplier?.name || '-'}</TableCell>
                      <TableCell className="text-right">
                        {item.quantity} {item.unit || '件'}
                      </TableCell>
                      <TableCell className="text-right">
                        ¥{item.unitPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ¥{item.totalPrice.toFixed(2)}
                      </TableCell>
                      <TableCell>{item.remarks || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end border-t pt-4">
              <div className="text-right">
                <p className="text-muted-foreground text-sm">产品总额</p>
                <p className="text-lg font-bold">¥{totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-center">暂无产品明细</p>
        )}
      </CardContent>
    </Card>
  );
}

interface ExpenseRecordsCardProps {
  expenses: NonNullable<PurchaseOrderDetailData['expenses']>;
}

export function ExpenseRecordsCard({ expenses }: ExpenseRecordsCardProps) {
  const hasExpenses = expenses.length > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          <CardTitle>费用明细</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {hasExpenses ? (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>序号</TableHead>
                    <TableHead>费用类型</TableHead>
                    <TableHead>费用名称</TableHead>
                    <TableHead className="text-right">费用金额</TableHead>
                    <TableHead>备注</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense, index) => (
                    <TableRow key={expense.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        {EXPENSE_TYPE_LABELS[expense.expenseType] ??
                          expense.expenseType}
                      </TableCell>
                      <TableCell>{expense.expenseName}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(expense.expenseAmount)}
                      </TableCell>
                      <TableCell>{expense.remarks || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end border-t pt-4">
              <div className="text-right">
                <p className="text-muted-foreground text-sm">费用总额</p>
                <p className="text-lg font-bold">
                  {formatCurrency(
                    expenses.reduce(
                      (sum, expense) => sum + expense.expenseAmount,
                      0
                    )
                  )}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-center">暂无费用记录</p>
        )}
      </CardContent>
    </Card>
  );
}

interface CostSummaryCardProps {
  totalAmount: number;
  expenseAmount?: number | null;
  costAmount?: number | null;
  hasAllocatedExpense: boolean;
}

export function CostSummaryCard({
  totalAmount,
  expenseAmount,
  costAmount,
  hasAllocatedExpense,
}: CostSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          <CardTitle>成本核算</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <p className="text-muted-foreground text-sm">产品总额</p>
            <p className="text-xl font-semibold">
              {formatCurrency(totalAmount)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">费用总额</p>
            <p className="text-xl font-semibold">
              {formatCurrency(expenseAmount ?? null)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">成本总额</p>
            <p className="text-primary text-2xl font-bold">
              {formatCurrency(costAmount ?? null)}
            </p>
          </div>
        </div>
        <div className="mt-4 border-t pt-4">
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground text-sm">费用分摊状态:</p>
            {hasAllocatedExpense ? (
              <Badge variant="default">已分摊费用</Badge>
            ) : (
              <Badge variant="secondary">未分摊费用</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface OrderActionsCardProps {
  availableStatuses: PurchaseOrderStatus[];
  isSubmitting: boolean;
  onStatusChange: (status: PurchaseOrderStatus) => void | Promise<void>;
  onRequestCancel: () => void;
}

export function OrderActionsCard({
  availableStatuses,
  isSubmitting,
  onStatusChange,
  onRequestCancel,
}: OrderActionsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>操作</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {availableStatuses.map(status => (
            <Button
              key={status}
              variant={
                status === PURCHASE_ORDER_STATUS.CANCELLED
                  ? 'destructive'
                  : 'default'
              }
              onClick={() => {
                if (status === PURCHASE_ORDER_STATUS.CANCELLED) {
                  onRequestCancel();
                } else {
                  void onStatusChange(status);
                }
              }}
              disabled={isSubmitting}
            >
              {STATUS_ACTION_LABELS[status]}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface DeleteOrderDialogProps {
  open: boolean;
  onOpenChange: Dispatch<SetStateAction<boolean>>;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export function DeleteOrderDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
}: DeleteOrderDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription>
            确定要删除此采购订单吗？此操作无法撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>取消</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isSubmitting}>
            确认删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface CancelOrderDialogProps {
  open: boolean;
  onOpenChange: Dispatch<SetStateAction<boolean>>;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export function CancelOrderDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
}: CancelOrderDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认取消订单</AlertDialogTitle>
          <AlertDialogDescription>
            确定要取消此采购订单吗？取消后无法恢复。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>返回</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isSubmitting}>
            确认取消
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
