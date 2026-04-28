'use client';

import { Calculator, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import React, { useCallback, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { FactoryShipmentItemCards } from '@/components/factory-shipments/form-sections/factory-shipment-item-cards';
import { SupplierSelector } from '@/components/suppliers/supplier-selector';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { getLatestPrice } from '@/hooks/use-price-history';
import type { BlurHandlerFactory } from '@/lib/hooks/useFormErrorHandling';
import type { ItemPricingResult } from '@/lib/services/factory-shipment-pricing-service';
import type { FactoryShipmentOrderItem } from '@/lib/types/factory-shipment';
import type { PriceHistoryData } from '@/lib/types/price-history';
import type { Product } from '@/lib/types/product';
import { toPieceOrSheetLabel } from '@/lib/utils/inventory-unit-conversion';
import {
  findFactoryShipmentDuplicateGroups,
  getFactoryShipmentDuplicateItemMessage,
  type FactoryShipmentOrderFormData,
} from '@/lib/validations/factory-shipment';

const PricingResultDialog = dynamic(
  () =>
    import('@/components/factory-shipments/pricing-result-dialog').then(
      mod => mod.PricingResultDialog
    ),
  { ssr: false, loading: () => null }
);

interface ItemsTableProps {
  form: UseFormReturn<FactoryShipmentOrderFormData, any, any>;
  products: Product[];
  selectedCustomerId: string;
  customerPriceHistoryData?: PriceHistoryData;
  fields: any[];
  onAddItem: (preferredSupplierId?: string) => void;
  onRemoveItem: (index: number) => void;
  getBlurHandler?: BlurHandlerFactory<FactoryShipmentOrderFormData>;
}

/**
 * 厂家发货订单产品明细
 * 使用分行录单卡片，避免“表格里塞表单”带来的压迫感
 */
export const ItemsTable = React.memo<ItemsTableProps>(
  ({
    form,
    products,
    selectedCustomerId,
    customerPriceHistoryData,
    fields,
    onAddItem,
    onRemoveItem,
    getBlurHandler,
  }) => {
    const { toast } = useToast();
    const [isCalculating, setIsCalculating] = useState(false);
    const [showPricingDialog, setShowPricingDialog] = useState(false);
    const [pricingResults, setPricingResults] = useState<ItemPricingResult[]>(
      []
    );
    const [totalExpenses, setTotalExpenses] = useState(0);
    const [defaultSupplierId, setDefaultSupplierId] = useState('');
    const watchedItems = form.watch('items') as
      | FactoryShipmentOrderFormData['items']
      | undefined;
    const duplicateGroups = React.useMemo(
      () => findFactoryShipmentDuplicateGroups(watchedItems ?? []),
      [watchedItems]
    );
    const duplicateRowIndexes = React.useMemo(() => {
      const indexes = new Set<number>();

      duplicateGroups.forEach(group => {
        group.forEach(index => indexes.add(index));
      });

      return indexes;
    }, [duplicateGroups]);
    const duplicateSignature = React.useMemo(
      () => duplicateGroups.map(group => group.join('-')).join('|'),
      [duplicateGroups]
    );
    const hasInitializedDuplicateValidation = React.useRef(false);

    React.useEffect(() => {
      if (!hasInitializedDuplicateValidation.current) {
        hasInitializedDuplicateValidation.current = true;
        return;
      }

      void form.trigger('items');
    }, [duplicateSignature, form]);

    // 计算单个明细的金额
    const calculateItemAmount = (index: number): number => {
      const rawQuantity = form.watch(`items.${index}.quantity`);
      const rawUnitPrice = form.watch(`items.${index}.unitPrice`);
      const quantity = Number(rawQuantity) || 0;
      const unitPrice = Number(rawUnitPrice) || 0;
      return quantity * unitPrice;
    };

    // 测算销售价
    const handleCalculatePricing = useCallback(async () => {
      setIsCalculating(true);

      try {
        // 获取当前的产品明细和费用项
        const items =
          (form.getValues('items') as FactoryShipmentOrderFormData['items']) ||
          [];
        const feeItems =
          (form.getValues(
            'feeItems'
          ) as FactoryShipmentOrderFormData['feeItems']) || [];

        // 验证：至少有一个产品
        if (items.length === 0) {
          toast({
            title: '无法计算',
            description: '请先添加产品明细',
            variant: 'destructive',
          });
          return;
        }

        // 验证：所有产品都有进货价
        const missingCostItems = items.filter(item => {
          const unitCost = Number((item as any).unitCost ?? 0);
          return unitCost <= 0;
        });
        if (missingCostItems.length > 0) {
          toast({
            title: '无法计算',
            description: '请先填写所有产品的进货价',
            variant: 'destructive',
          });
          return;
        }

        // 计算总运费（使用 feeAmount 字段）
        const totalExpenses = (feeItems as any[]).reduce(
          (sum, fee) => sum + (Number(fee.feeAmount ?? 0) || 0),
          0
        );

        // 转换为 FactoryShipmentOrderItem 格式
        const itemsForCalculation: FactoryShipmentOrderItem[] = items.map(
          (item, index) => {
            const quantity = Number((item as any).quantity ?? 0) || 0;
            const unitPrice = Number((item as any).unitPrice ?? 0) || 0;
            const unitCostRaw = (item as any).unitCost;
            const unitCost =
              unitCostRaw === null || unitCostRaw === undefined
                ? null
                : Number(unitCostRaw);

            return {
              id: `temp-${index}`, // 临时 ID
              factoryShipmentOrderId: '',
              productId: item.productId || null,
              supplierId: item.supplierId || '',
              productCode: item.productCode || '',
              batchNumber: item.batchNumber || null,
              quantity,
              unitPrice,
              totalPrice: unitPrice * quantity,
              ownership: item.ownership || 'customer',
              displayName: item.displayName || '',
              specification: item.specification || null,
              unit: item.unit || '片',
              piecesPerUnit: item.piecesPerUnit || null,
              weight: item.weight || null,
              remarks: item.remarks || null,
              createdAt: new Date(),
              updatedAt: new Date(),
              unitCost,
              allocatedExpense: null,
              profitAmount: null,
              profitMargin: null,
              supplier: {
                id: item.supplierId || '',
                name: '',
              },
            } as FactoryShipmentOrderItem;
          }
        );

        const { calculateOrderPricing } = await import(
          '@/lib/services/factory-shipment-pricing-service'
        );

        // 测算销售价
        const results = calculateOrderPricing(
          itemsForCalculation,
          totalExpenses,
          {
            targetProfitMargin: 20, // 默认 20% 利润率
            minProfitMargin: 10, // 最低 10% 利润率
            roundingRule: 'nearest', // 四舍五入
          }
        );

        // 保存结果并显示对话框
        setPricingResults(results);
        setTotalExpenses(totalExpenses);
        setShowPricingDialog(true);
      } catch (error) {
        toast({
          title: '计算失败',
          description: error instanceof Error ? error.message : '未知错误',
          variant: 'destructive',
        });
      } finally {
        setIsCalculating(false);
      }
    }, [form, toast]);

    // 应用测算价格
    const handleApplyPricing = useCallback(() => {
      let updatedCount = 0;
      pricingResults.forEach((result, index) => {
        const currentPrice = form.getValues(`items.${index}.unitPrice`);
        // 只更新未填写或为 0 的销售价
        if (!currentPrice || currentPrice === 0) {
          form.setValue(`items.${index}.unitPrice`, result.suggestedUnitPrice);
          updatedCount++;
        }
      });

      setShowPricingDialog(false);
      toast({
        title: '应用成功',
        description: `已更新 ${updatedCount} 行销售价`,
      });
    }, [form, pricingResults, toast]);

    const handleApplyDefaultSupplier = useCallback(
      (mode: 'blank' | 'all') => {
        if (!defaultSupplierId) {
          return;
        }

        const currentItems =
          (form.getValues('items') as FactoryShipmentOrderFormData['items']) ||
          [];
        let updatedCount = 0;

        currentItems.forEach((item, index) => {
          const currentSupplierId = item?.supplierId?.trim() || '';
          const shouldApply = mode === 'all' || currentSupplierId.length === 0;

          if (!shouldApply || currentSupplierId === defaultSupplierId) {
            return;
          }

          form.setValue(`items.${index}.supplierId`, defaultSupplierId, {
            shouldDirty: true,
            shouldValidate: true,
          });
          updatedCount += 1;
        });

        if (updatedCount > 0) {
          toast({
            title: '已批量带出供应商',
            description:
              mode === 'all'
                ? `已更新 ${updatedCount} 条明细。`
                : `已为 ${updatedCount} 条空白明细补上供应商。`,
            duration: 2000,
          });
        }
      },
      [defaultSupplierId, form, toast]
    );

    // 使用 useCallback 稳定回调函数
    const handleProductChange = useCallback(
      (index: number) => (product: Product | null) => {
        if (product) {
          // 自动填充产品编码
          form.setValue(`items.${index}.productCode`, product.code || '');

          // 自动填充产品名称
          form.setValue(`items.${index}.displayName`, product.name || '');

          // 自动填充规格
          if (product.specification) {
            form.setValue(
              `items.${index}.specification`,
              product.specification
            );
          }

          // 自动填充单位
          if (product.unit) {
            form.setValue(
              `items.${index}.unit`,
              toPieceOrSheetLabel(product.unit)
            );
          }

          // 自动填充每件片数
          if (product.piecesPerUnit) {
            form.setValue(
              `items.${index}.piecesPerUnit`,
              product.piecesPerUnit
            );
          }

          // 自动填充重量
          if (product.weight) {
            form.setValue(`items.${index}.weight`, product.weight);
          }

          // 自动填充客户历史价格
          const customerPrice =
            selectedCustomerId && product.code
              ? getLatestPrice(
                  customerPriceHistoryData?.data,
                  product.code,
                  'FACTORY'
                )
              : undefined;
          const currentItems =
            (form.getValues(
              'items'
            ) as FactoryShipmentOrderFormData['items']) || [];
          const duplicateGroup = findFactoryShipmentDuplicateGroups(
            currentItems
          ).find(group => group.includes(index));
          const duplicateMessage =
            duplicateGroup && currentItems[index]
              ? `第 ${index + 1} 行与${duplicateGroup
                  .filter(itemIndex => itemIndex !== index)
                  .map(itemIndex => `第 ${itemIndex + 1} 行`)
                  .join('、')}重复，${getFactoryShipmentDuplicateItemMessage(
                  currentItems[index]
                )}`
              : '';

          if (customerPrice !== undefined) {
            form.setValue(`items.${index}.unitPrice`, customerPrice);
            toast({
              title: duplicateMessage ? '发现重复明细' : '已带出产品信息',
              description: duplicateMessage || '已带出产品信息和历史参考价',
              duration: duplicateMessage ? 3200 : 2000,
              variant: duplicateMessage ? 'destructive' : 'default',
            });
          } else {
            toast({
              title: duplicateMessage ? '发现重复明细' : '已带出产品信息',
              description: duplicateMessage || '已带出产品信息',
              duration: duplicateMessage ? 3200 : 2000,
              variant: duplicateMessage ? 'destructive' : 'default',
            });
          }
        }
      },
      [form, selectedCustomerId, customerPriceHistoryData, toast]
    );

    const estimatedTotalAmount = fields
      .reduce((sum, _, index) => sum + calculateItemAmount(index), 0)
      .toFixed(2);

    return (
      <div className="space-y-3">
        <div className="rounded-md border border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]/25 px-4 py-3">
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[auto_minmax(260px,320px)_auto] lg:items-end">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="font-medium text-[hsl(var(--color-text-primary))]">
                共 {fields.length} 行明细
              </span>
              <span className="text-[hsl(var(--color-text-secondary))]">
                预计金额 ￥{estimatedTotalAmount}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,220px)_auto_auto] lg:items-end">
              <div className="min-w-0">
                <div className="mb-1 text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                  默认供应商
                </div>
                <SupplierSelector
                  value={defaultSupplierId}
                  onValueChange={setDefaultSupplierId}
                  placeholder="选择默认供应商"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-9 w-full text-[hsl(var(--color-text-secondary))] sm:w-auto"
                onClick={() => handleApplyDefaultSupplier('blank')}
                disabled={!defaultSupplierId || fields.length === 0}
              >
                带入空白行
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-9 w-full text-[hsl(var(--color-text-secondary))] sm:w-auto"
                onClick={() => handleApplyDefaultSupplier('all')}
                disabled={!defaultSupplierId || fields.length === 0}
              >
                覆盖全部行
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:justify-end">
              <Button
                type="button"
                onClick={handleCalculatePricing}
                size="sm"
                variant="outline"
                className="h-9 w-full lg:w-auto"
                disabled={isCalculating || fields.length === 0}
              >
                <Calculator className="mr-1 h-3 w-3" />
                {isCalculating ? '计算中...' : '测算售价'}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onAddItem(defaultSupplierId)}
                className="h-9 w-full lg:w-auto"
              >
                <Plus className="mr-1 h-3 w-3" />
                新增一行
              </Button>
            </div>
          </div>
        </div>

        <FactoryShipmentItemCards
          form={form}
          products={products}
          fields={fields}
          duplicateRowIndexes={duplicateRowIndexes}
          onRemoveItem={onRemoveItem}
          onProductChange={handleProductChange}
          calculateItemAmount={calculateItemAmount}
          getBlurHandler={getBlurHandler}
        />

        {/* 底部汇总栏 */}
        <div className="bg-muted/10 flex flex-col gap-3 rounded-md border px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-8 sm:px-5">
          <div className="text-sm">
            <span className="text-muted-foreground mr-2">总数量:</span>
            <span className="font-medium">
              {(() => {
                // 严格换算：先将所有行数量换算为总片数
                let totalPieces = 0;
                const ppuSet = new Set<number>();
                fields.forEach((_, index) => {
                  const qty = Number(
                    form.watch(`items.${index}.quantity`) || 0
                  );
                  const unit = form.watch(`items.${index}.unit`) || '片';
                  const ppu = Number(
                    form.watch(`items.${index}.piecesPerUnit`) || 0
                  );

                  if (unit === '件') {
                    if (ppu > 0) {
                      ppuSet.add(ppu);
                      totalPieces += Math.floor(qty) * ppu;
                    } else {
                      // 缺少每件片数时，无法将“件”精确换算为片，按0处理避免误导
                      totalPieces += 0;
                    }
                  } else {
                    totalPieces += Math.floor(qty);
                  }
                });

                if (!Number.isFinite(totalPieces) || totalPieces <= 0) {
                  return '0片';
                }

                // 当所有带“件”的行的每件片数完全一致时，使用该值做件/片精确表示
                const uniquePpu = [...ppuSet].filter(v => v > 0);
                if (uniquePpu.length === 1 && uniquePpu[0] > 1) {
                  const ppu = uniquePpu[0];
                  const fullUnits = Math.floor(totalPieces / ppu);
                  const remaining = totalPieces % ppu;
                  if (fullUnits === 0)
                    return `${remaining}片（共${totalPieces}片）`;
                  if (remaining === 0)
                    return `${fullUnits}件（共${totalPieces}片）`;
                  return `${fullUnits}件${remaining}片（共${totalPieces}片）`;
                }

                // 否则仅显示严格总片数
                return `${totalPieces}片`;
              })()}
            </span>
          </div>
          <div className="flex items-baseline text-sm sm:justify-end">
            <span className="text-muted-foreground mr-2">预计总金额:</span>
            <span className="font-mono text-xl font-bold text-orange-600">
              ￥{estimatedTotalAmount}
            </span>
          </div>
        </div>

        {/* 定价结果对话框 */}
        {showPricingDialog && (
          <PricingResultDialog
            open={showPricingDialog}
            onOpenChange={setShowPricingDialog}
            results={pricingResults}
            totalExpenses={totalExpenses}
            onConfirm={handleApplyPricing}
          />
        )}
      </div>
    );
  }
);

ItemsTable.displayName = 'ItemsTable';
