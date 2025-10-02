/**
 * 库存调整记录详情对话框组件
 * 显示调整记录的详细信息
 */

import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  ADJUSTMENT_REASON_LABELS,
  ADJUSTMENT_STATUS_VARIANTS,
  type InventoryAdjustment,
} from '@/lib/types/inventory';
import { formatDateTimeCN } from '@/lib/utils/datetime';

interface AdjustmentDetailDialogProps {
  adjustment: InventoryAdjustment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdjustmentDetailDialog({
  adjustment,
  open,
  onOpenChange,
}: AdjustmentDetailDialogProps) {
  if (!adjustment) {return null;}

  // 格式化调整数量显示
  const formatAdjustQuantity = (quantity: number) => {
    if (quantity > 0) {
      return (
        <span className="text-lg font-medium text-green-600">+{quantity}</span>
      );
    } else {
      return (
        <span className="text-lg font-medium text-red-600">{quantity}</span>
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <span>调整记录详情</span>
            <Badge
              variant={ADJUSTMENT_STATUS_VARIANTS[adjustment.status]}
              className="text-xs"
            >
              {adjustment.status === 'approved'
                ? '已审批'
                : adjustment.status === 'pending'
                  ? '待审批'
                  : adjustment.status === 'rejected'
                    ? '已拒绝'
                    : '草稿'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 基本信息 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">基本信息</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  调整单号
                </Label>
                <p className="mt-1 font-mono text-sm">
                  {adjustment.adjustmentNumber}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  调整时间
                </Label>
                <p className="mt-1 text-sm">
                  {formatDateTimeCN(adjustment.createdAt)}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* 产品信息 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">产品信息</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  产品名称
                </Label>
                <p className="mt-1 font-medium">
                  {adjustment.product?.name || '未知产品'}
                </p>
              </div>
              {adjustment.product?.code && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    产品编码
                  </Label>
                  <p className="mt-1 font-mono text-sm">
                    {adjustment.product.code}
                  </p>
                </div>
              )}
              {adjustment.product?.specification && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    产品规格
                  </Label>
                  <p className="mt-1 text-sm">
                    {(() => {
                      const spec = adjustment.product.specification;
                      // 如果是JSON字符串，尝试解析并提取关键信息
                      if (spec.startsWith('{') && spec.endsWith('}')) {
                        try {
                          const parsed = JSON.parse(spec);
                          // 提取尺寸信息作为主要显示内容
                          if (parsed.size) {
                            return parsed.size;
                          }
                          // 如果没有尺寸，显示简化的规格信息
                          return '规格详情...';
                        } catch {
                          // JSON解析失败，显示原始字符串
                          return spec;
                        }
                      }
                      // 普通字符串，直接显示
                      return spec;
                    })()}
                  </p>
                </div>
              )}
              {adjustment.variant?.sku && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    产品SKU
                  </Label>
                  <p className="mt-1 font-mono text-sm">
                    {adjustment.variant.sku}
                  </p>
                </div>
              )}
              {adjustment.batchNumber && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    批次号
                  </Label>
                  <p className="mt-1 font-mono text-sm">
                    {adjustment.batchNumber}
                  </p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* 调整信息 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">调整信息</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  调整前数量
                </Label>
                <p className="mt-1 text-lg font-medium">
                  {adjustment.beforeQuantity}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  调整数量
                </Label>
                <p className="mt-1">
                  {formatAdjustQuantity(adjustment.adjustQuantity)}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  调整后数量
                </Label>
                <p className="mt-1 text-lg font-medium">
                  {adjustment.afterQuantity}
                </p>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">
                调整原因
              </Label>
              <p className="mt-1">
                <Badge variant="outline">
                  {ADJUSTMENT_REASON_LABELS[
                    adjustment.reason as keyof typeof ADJUSTMENT_REASON_LABELS
                  ] || adjustment.reason}
                </Badge>
              </p>
            </div>
            {adjustment.notes && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  备注信息
                </Label>
                <p className="mt-1 rounded-md bg-muted p-3 text-sm">
                  {adjustment.notes}
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* 操作信息 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">操作信息</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">
                  操作人员
                </Label>
                <p className="mt-1">
                  {adjustment.operator?.name || '未知操作员'}
                  {adjustment.operator?.email && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      ({adjustment.operator.email})
                    </span>
                  )}
                </p>
              </div>
              {adjustment.approver && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    审批人员
                  </Label>
                  <p className="mt-1">
                    {adjustment.approver.name}
                    {adjustment.approver.email && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        ({adjustment.approver.email})
                      </span>
                    )}
                  </p>
                </div>
              )}
              {adjustment.approvedAt && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    审批时间
                  </Label>
                  <p className="mt-1 text-sm">
                    {formatDateTimeCN(adjustment.approvedAt)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
