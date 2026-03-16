'use client';

import { Calculator, Package, Plus, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import React, { useCallback, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { SupplierPriceSelector } from '@/components/factory-shipments/supplier-price-selector';
import { IntelligentProductInput } from '@/components/sales-orders/intelligent-product-input';
import { SupplierSelector } from '@/components/suppliers/supplier-selector';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { getLatestPrice } from '@/hooks/use-price-history';
import type { BlurHandlerFactory } from '@/lib/hooks/useFormErrorHandling';
import type { ItemPricingResult } from '@/lib/services/factory-shipment-pricing-service';
import type { FactoryShipmentOrderItem } from '@/lib/types/factory-shipment';
import type { PriceHistoryData } from '@/lib/types/price-history';
import type { Product } from '@/lib/types/product';
import type { FactoryShipmentOrderFormData } from '@/lib/validations/factory-shipment';

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
 * 厂家发货订单产品明细表格
 * 使用表格形式展示和编辑产品明细，提高数据录入效率
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

    // 计算单个明细的金额
    const calculateItemAmount = (index: number): number => {
      const rawQuantity = form.watch(`items.${index}.quantity`);
      const rawUnitPrice = form.watch(`items.${index}.unitPrice`);
      const quantity = Number(rawQuantity) || 0;
      const unitPrice = Number(rawUnitPrice) || 0;
      return quantity * unitPrice;
    };

    // 计算建议销售价
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

        // 计算建议销售价
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

    // 应用建议价格
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
        description: `已为 ${updatedCount} 个产品设置建议销售价`,
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
        if (product && selectedCustomerId && product.code) {
          // 自动填充产品编码
          form.setValue(`items.${index}.productCode`, product.code);

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
            form.setValue(`items.${index}.unit`, product.unit as '片' | '件');
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
          const customerPrice = getLatestPrice(
            customerPriceHistoryData?.data,
            product.code,
            'FACTORY'
          );
          if (customerPrice !== undefined) {
            form.setValue(`items.${index}.unitPrice`, customerPrice);
            toast({
              title: '已自动填充',
              description: `产品信息和历史价格已自动填充`,
              duration: 2000,
            });
          } else {
            toast({
              title: '已自动填充',
              description: `产品信息已自动填充`,
              duration: 2000,
            });
          }
        }
      },
      [form, selectedCustomerId, customerPriceHistoryData, toast]
    );

    return (
      <div className="space-y-6">
        {/* 表头 */}
        <div className="flex flex-col gap-3 rounded-lg border border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))]/50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Package className="h-4 w-4" />
            产品明细
          </div>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-1 flex-col gap-2 lg:flex-row lg:items-end">
              <div className="w-full max-w-sm space-y-1">
                <div className="text-sm font-medium">常用供应商</div>
                <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                  适合同一厂家连续录单，新增行会自动带出，也可一键填充。
                </div>
                <SupplierSelector
                  value={defaultSupplierId}
                  onValueChange={setDefaultSupplierId}
                  placeholder="选择常用供应商"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9"
                  onClick={() => handleApplyDefaultSupplier('blank')}
                  disabled={!defaultSupplierId || fields.length === 0}
                >
                  应用到空白行
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9"
                  onClick={() => handleApplyDefaultSupplier('all')}
                  disabled={!defaultSupplierId || fields.length === 0}
                >
                  应用到全部明细
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={handleCalculatePricing}
                size="sm"
                variant="outline"
                className="h-9"
                disabled={isCalculating || fields.length === 0}
              >
                <Calculator className="mr-1 h-3 w-3" />
                {isCalculating ? '计算中...' : '计算建议销售价'}
              </Button>
              <Button
                type="button"
                onClick={() => onAddItem(defaultSupplierId)}
                size="sm"
                variant="outline"
                className="h-9"
              >
                <Plus className="mr-1 h-3 w-3" />
                添加产品
              </Button>
            </div>
          </div>
        </div>

        {/* 表格 */}
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="text-foreground w-[50px] border-r px-2 py-3 text-center font-semibold">
                  序号
                </TableHead>
                <TableHead className="text-foreground w-[180px] border-r px-3 py-3 font-semibold">
                  产品信息 <span className="text-destructive">*</span>
                </TableHead>
                <TableHead className="text-foreground w-[160px] border-r px-3 py-3 font-semibold">
                  供应商 <span className="text-destructive">*</span>
                </TableHead>
                <TableHead className="text-foreground w-[180px] border-r px-3 py-3 font-semibold">
                  规格
                </TableHead>
                <TableHead className="text-foreground w-[100px] border-r px-3 py-3 font-semibold">
                  批次
                </TableHead>
                <TableHead className="text-foreground w-[90px] border-r px-3 py-3 text-right font-semibold">
                  装箱数
                </TableHead>
                <TableHead className="text-foreground w-[90px] border-r px-3 py-3 text-right font-semibold">
                  数量 <span className="text-destructive">*</span>
                </TableHead>
                <TableHead className="text-foreground w-[70px] border-r px-3 py-3 text-center font-semibold">
                  单位
                </TableHead>
                <TableHead className="text-foreground w-[100px] border-r px-3 py-3 text-right font-semibold">
                  进货价
                </TableHead>
                <TableHead className="text-foreground w-[100px] border-r px-3 py-3 text-right font-semibold">
                  销售价 <span className="text-destructive">*</span>
                </TableHead>
                <TableHead className="text-foreground w-[100px] border-r px-3 py-3 text-right font-semibold">
                  金额
                </TableHead>
                <TableHead className="text-foreground w-[150px] border-r px-3 py-3 font-semibold">
                  备注
                </TableHead>
                <TableHead className="text-foreground w-[60px] px-2 py-3 text-center font-semibold">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="h-32 text-center">
                    <div className="text-muted-foreground flex flex-col items-center gap-2">
                      <Package className="h-8 w-8" />
                      <p>暂无产品明细，请点击「添加产品」开始填写</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                fields.map((field, index) => (
                  <TableRow key={field.id} className="hover:bg-muted/30">
                    {/* 序号 */}
                    <TableCell className="border-r px-2 py-3 text-center font-medium">
                      {index + 1}
                    </TableCell>

                    {/* 产品信息（产品编码 + 名称） */}
                    <TableCell className="border-r px-3 py-3">
                      <div className="flex flex-col gap-2">
                        <IntelligentProductInput
                          form={form}
                          index={index}
                          products={products}
                          onProductChange={handleProductChange(index)}
                          placeholder="搜索产品或添加临时产品"
                          // 客户直发：允许直接添加临时产品
                          enableTemporaryProducts
                        />
                        {/* 产品编码 */}
                        <FormField
                          control={form.control}
                          name={`items.${index}.productCode`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ''}
                                  placeholder="产品编码"
                                  className="h-8 font-mono text-[11px] text-[hsl(var(--color-text-secondary))]"
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                        {/* 产品名称 */}
                        <FormField
                          control={form.control}
                          name={`items.${index}.displayName`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value || ''}
                                  placeholder="产品名称"
                                  className="text-muted-foreground h-8 text-xs"
                                />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </div>
                    </TableCell>

                    {/* 供应商 */}
                    <TableCell className="border-r px-3 py-3">
                      <FormField
                        control={form.control}
                        name={`items.${index}.supplierId`}
                        render={({ field }) => (
                          <SupplierPriceSelector
                            form={form}
                            index={index}
                            value={field.value}
                            onChange={field.onChange}
                            showLabel={false}
                            onBlur={
                              getBlurHandler
                                ? getBlurHandler(
                                    `items.${index}.supplierId`,
                                    field.onBlur
                                  )
                                : field.onBlur
                            }
                          />
                        )}
                      />
                    </TableCell>

                    {/* 规格 */}
                    <TableCell className="border-r px-3 py-3">
                      <FormField
                        control={form.control}
                        name={`items.${index}.specification`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ''}
                                placeholder="规格"
                                className="h-9 text-sm"
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </TableCell>

                    {/* 批次 */}
                    <TableCell className="border-r px-3 py-3">
                      <FormField
                        control={form.control}
                        name={`items.${index}.batchNumber`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ''}
                                placeholder="批次号"
                                className="h-9 text-sm"
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </TableCell>

                    {/* 每件片数 */}
                    <TableCell className="border-r px-3 py-3">
                      <FormField
                        control={form.control}
                        name={`items.${index}.piecesPerUnit`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                step="1"
                                {...field}
                                value={
                                  field.value === undefined ||
                                  field.value === null
                                    ? ''
                                    : field.value
                                }
                                onChange={e => {
                                  const value = e.target.value;
                                  if (value === '') {
                                    field.onChange(undefined);
                                    return;
                                  }
                                  const parsed = Number.parseInt(value, 10);
                                  field.onChange(
                                    Number.isNaN(parsed) ? undefined : parsed
                                  );
                                }}
                                placeholder="片/件"
                                className="h-9 text-right text-sm"
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </TableCell>

                    {/* 数量 */}
                    <TableCell className="border-r px-3 py-3">
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ''}
                                onChange={e =>
                                  field.onChange(
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                placeholder="数量"
                                className="h-9 text-right text-sm font-medium"
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </TableCell>

                    {/* 单位 */}
                    <TableCell className="border-r px-3 py-3">
                      <FormField
                        control={form.control}
                        name={`items.${index}.unit`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Select
                                value={field.value || '片'}
                                onValueChange={newUnit => {
                                  const oldUnit = field.value || '片';
                                  const piecesPerUnit =
                                    Number(
                                      form.getValues(
                                        `items.${index}.piecesPerUnit`
                                      ) || 0
                                    ) || 0;
                                  const currentSalePrice =
                                    Number(
                                      form.getValues(
                                        `items.${index}.unitPrice`
                                      ) || 0
                                    ) || 0;
                                  const currentCostPrice =
                                    Number(
                                      form.getValues(
                                        `items.${index}.unitCost`
                                      ) || 0
                                    ) || 0;

                                  // 只有在片/件之间切换且有每件片数时才做换算
                                  if (
                                    piecesPerUnit > 0 &&
                                    oldUnit !== newUnit &&
                                    (oldUnit === '片' || oldUnit === '件') &&
                                    (newUnit === '片' || newUnit === '件')
                                  ) {
                                    // 片 -> 件：价格 * 每件片数
                                    if (oldUnit === '片' && newUnit === '件') {
                                      if (currentSalePrice > 0) {
                                        form.setValue(
                                          `items.${index}.unitPrice`,
                                          Number(
                                            (
                                              currentSalePrice * piecesPerUnit
                                            ).toFixed(2)
                                          )
                                        );
                                      }
                                      if (currentCostPrice > 0) {
                                        form.setValue(
                                          `items.${index}.unitCost`,
                                          Number(
                                            (
                                              currentCostPrice * piecesPerUnit
                                            ).toFixed(2)
                                          )
                                        );
                                      }
                                    }

                                    // 件 -> 片：价格 / 每件片数
                                    if (oldUnit === '件' && newUnit === '片') {
                                      if (currentSalePrice > 0) {
                                        form.setValue(
                                          `items.${index}.unitPrice`,
                                          Number(
                                            (
                                              currentSalePrice / piecesPerUnit
                                            ).toFixed(4)
                                          )
                                        );
                                      }
                                      if (currentCostPrice > 0) {
                                        form.setValue(
                                          `items.${index}.unitCost`,
                                          Number(
                                            (
                                              currentCostPrice / piecesPerUnit
                                            ).toFixed(4)
                                          )
                                        );
                                      }
                                    }
                                  }

                                  field.onChange(newUnit);
                                }}
                              >
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="片">片</SelectItem>
                                  <SelectItem value="件">件</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </TableCell>

                    {/* 单价 */}
                    <TableCell className="border-r px-3 py-3">
                      <FormField
                        control={form.control}
                        name={`items.${index}.unitCost`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                {...field}
                                value={
                                  field.value === undefined ||
                                  Number.isNaN(field.value)
                                    ? ''
                                    : field.value
                                }
                                onChange={e => {
                                  const value = e.target.value;
                                  field.onChange(
                                    value === ''
                                      ? undefined
                                      : Number.parseFloat(value)
                                  );
                                }}
                                placeholder="进货价"
                                className="h-9 text-right text-sm"
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </TableCell>

                    {/* 销售价 */}
                    <TableCell className="border-r px-3 py-3">
                      <FormField
                        control={form.control}
                        name={`items.${index}.unitPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                type="text"
                                inputMode="decimal"
                                {...field}
                                value={
                                  field.value === undefined ||
                                  Number.isNaN(field.value as number)
                                    ? ''
                                    : field.value
                                }
                                placeholder="销售单价"
                                className="h-9 text-right text-sm"
                                onChange={event => {
                                  const value = event.target.value;
                                  // 允许输入数字、小数点、空字符串
                                  if (
                                    value === '' ||
                                    /^\d*\.?\d*$/.test(value)
                                  ) {
                                    // 允许空值，不立即转换为数字，避免打小数点时被截断
                                    field.onChange(value === '' ? '' : value);
                                  }
                                }}
                                onFocus={event => {
                                  // 聚焦时自动选中内容，方便覆盖输入
                                  event.target.select();
                                }}
                                onBlur={event => {
                                  const value = event.target.value;
                                  // 失焦时统一转换为数字
                                  if (!value || value === '.') {
                                    field.onChange(0);
                                  } else {
                                    const parsed = Number.parseFloat(value);
                                    field.onChange(
                                      Number.isNaN(parsed) ? 0 : parsed
                                    );
                                  }
                                  field.onBlur();
                                }}
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </TableCell>

                    {/* 金额（自动计算） */}
                    <TableCell className="border-r px-3 py-3 text-right font-medium">
                      <span className="text-xs">
                        ￥{calculateItemAmount(index).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="border-r px-3 py-3">
                      <FormField
                        control={form.control}
                        name={`items.${index}.remarks`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ''}
                                placeholder="备注"
                                className="h-9 text-sm"
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </TableCell>
                    <TableCell className="px-3 py-3 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => onRemoveItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 底部汇总栏 */}
        <div className="bg-muted/10 flex items-center justify-end gap-8 rounded-lg border px-6 py-4">
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
                if (uniquePpu.length === 1) {
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
          <div className="flex items-baseline text-sm">
            <span className="text-muted-foreground mr-2">预计总金额:</span>
            <span className="font-mono text-xl font-bold text-orange-600">
              ￥
              {fields
                .reduce((sum, _, index) => sum + calculateItemAmount(index), 0)
                .toFixed(2)}
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
