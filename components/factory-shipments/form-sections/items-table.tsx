'use client';

import { Calculator, Package, Plus, Trash2 } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { PricingResultDialog } from '@/components/factory-shipments/pricing-result-dialog';
import { SupplierPriceSelector } from '@/components/factory-shipments/supplier-price-selector';
import { IntelligentProductInput } from '@/components/sales-orders/intelligent-product-input';
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
import {
  calculateOrderPricing,
  type ItemPricingResult,
} from '@/lib/services/factory-shipment-pricing-service';
import type { FactoryShipmentOrderItem } from '@/lib/types/factory-shipment';
import type { PriceHistoryData } from '@/lib/types/price-history';
import type { Product } from '@/lib/types/product';
import type { FactoryShipmentOrderFormData } from '@/lib/validations/factory-shipment';

interface ItemsTableProps {
  form: UseFormReturn<FactoryShipmentOrderFormData, any, any>;
  products: Product[];
  selectedCustomerId: string;
  customerPriceHistoryData?: PriceHistoryData;
  fields: any[];
  onAddItem: () => void;
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

    // 计算单个明细的金额
    const calculateItemAmount = (index: number): number => {
      const quantity = form.watch(`items.${index}.quantity`) || 0;
      const unitPrice = form.watch(`items.${index}.unitPrice`) || 0;
      return quantity * unitPrice;
    };

    // 计算建议销售价
    const handleCalculatePricing = useCallback(() => {
      setIsCalculating(true);

      try {
        // 获取当前的产品明细和费用项
        const items = form.getValues('items');
        const feeItems = form.getValues('feeItems') || [];

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
        const missingCostItems = items.filter(
          item => !item.unitCost || item.unitCost <= 0
        );
        if (missingCostItems.length > 0) {
          toast({
            title: '无法计算',
            description: '请先填写所有产品的进货价',
            variant: 'destructive',
          });
          return;
        }

        // 计算总运费（使用 feeAmount 字段）
        const totalExpenses = feeItems.reduce(
          (sum, fee) => sum + (fee.feeAmount || 0),
          0
        );

        // 转换为 FactoryShipmentOrderItem 格式
        const itemsForCalculation: FactoryShipmentOrderItem[] = items.map(
          (item, index) => ({
            id: `temp-${index}`, // 临时 ID
            factoryShipmentOrderId: '',
            productId: item.productId || null,
            supplierId: item.supplierId || '',
            productCode: item.productCode || '',
            batchNumber: item.batchNumber || null,
            quantity: item.quantity || 0,
            unitPrice: item.unitPrice || 0,
            totalPrice: (item.unitPrice || 0) * (item.quantity || 0),
            ownership: item.ownership || 'customer',
            displayName: item.displayName || '',
            specification: item.specification || null,
            unit: item.unit || '片',
            piecesPerUnit: item.piecesPerUnit || null,
            weight: item.weight || null,
            remarks: item.remarks || null,
            createdAt: new Date(),
            updatedAt: new Date(),
            unitCost: item.unitCost || null,
            allocatedExpense: null,
            profitAmount: null,
            profitMargin: null,
            supplier: {
              id: item.supplierId || '',
              name: '',
            },
          })
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Package className="h-4 w-4" />
            产品明细
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handleCalculatePricing}
              size="sm"
              variant="outline"
              className="h-8"
              disabled={isCalculating || fields.length === 0}
            >
              <Calculator className="mr-1 h-3 w-3" />
              {isCalculating ? '计算中...' : '计算建议销售价'}
            </Button>
            <Button
              type="button"
              onClick={onAddItem}
              size="sm"
              variant="outline"
              className="h-8"
            >
              <Plus className="mr-1 h-3 w-3" />
              添加产品
            </Button>
          </div>
        </div>

        {/* 表格 */}
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[60px] border-r px-3 py-3 text-center">
                  序号
                </TableHead>
                <TableHead className="w-[180px] border-r px-3 py-3">
                  产品编码 *
                </TableHead>
                <TableHead className="w-[200px] border-r px-3 py-3">
                  产品名称 *
                </TableHead>
                <TableHead className="w-[180px] border-r px-3 py-3">
                  供应商 *
                </TableHead>
                <TableHead className="w-[140px] border-r px-3 py-3">
                  规格
                </TableHead>
                <TableHead className="w-[120px] border-r px-3 py-3">
                  批次
                </TableHead>
                <TableHead className="w-[100px] border-r px-3 py-3 text-right">
                  每件片数
                </TableHead>
                <TableHead className="w-[100px] border-r px-3 py-3 text-right">
                  数量 *
                </TableHead>
                <TableHead className="w-[80px] border-r px-3 py-3 text-center">
                  单位
                </TableHead>
                <TableHead className="w-[110px] border-r px-3 py-3 text-right">
                  进货价
                </TableHead>
                <TableHead className="w-[110px] border-r px-3 py-3 text-right">
                  销售价 *
                </TableHead>
                <TableHead className="w-[110px] border-r px-3 py-3 text-right">
                  金额
                </TableHead>
                <TableHead className="w-[100px] border-r px-3 py-3">
                  归属 *
                </TableHead>
                <TableHead className="w-[180px] border-r px-3 py-3">
                  备注
                </TableHead>
                <TableHead className="w-[80px] px-3 py-3 text-center">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={14} className="h-32 text-center">
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
                    <TableCell className="border-r px-3 py-3 text-center font-medium">
                      {index + 1}
                    </TableCell>

                    {/* 产品编码（智能选择器） */}
                    <TableCell className="border-r px-3 py-3">
                      <IntelligentProductInput
                        form={form}
                        index={index}
                        products={products}
                        onProductChange={handleProductChange(index)}
                        placeholder="搜索产品或添加临时产品"
                      />
                    </TableCell>

                    {/* 产品名称 */}
                    <TableCell className="border-r px-3 py-3">
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
                                className="h-8 text-xs"
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
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
                                className="h-8 text-xs"
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
                                className="h-8 text-xs"
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
                                className="h-8 text-right text-xs"
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
                                className="h-8 text-right text-xs"
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
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger className="h-8 text-xs">
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
                                className="h-8 text-right text-xs"
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
                                {...field}
                                value={field.value || ''}
                                onChange={e =>
                                  field.onChange(
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                placeholder="销售单价"
                                className="h-8 text-right text-xs"
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

                    {/* 归属 */}
                    <TableCell className="border-r px-3 py-3">
                      <FormField
                        control={form.control}
                        name={`items.${index}.ownership`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Select
                                value={field.value || 'customer'}
                                onValueChange={field.onChange}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="customer">客户</SelectItem>
                                  <SelectItem value="self">自有</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </TableCell>

                    {/* 备注 */}
                    <TableCell className="border-r px-3 py-3">
                      <FormField
                        control={form.control}
                        name={`items.${index}.ownershipRemarks`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                {...field}
                                value={field.value || ''}
                                placeholder="备注"
                                className="h-8 text-xs"
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </TableCell>

                    {/* 操作 */}
                    <TableCell className="px-3 py-3 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveItem(index)}
                        disabled={fields.length === 1}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8 p-0"
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

        {/* 定价结果对话框 */}
        <PricingResultDialog
          open={showPricingDialog}
          onOpenChange={setShowPricingDialog}
          results={pricingResults}
          totalExpenses={totalExpenses}
          onConfirm={handleApplyPricing}
        />
      </div>
    );
  }
);

ItemsTable.displayName = 'ItemsTable';
