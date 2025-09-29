'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';

// UI Components
import { ProductSelector } from '@/components/inventory/product-selector';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useCreateInboundRecord } from '@/lib/api/inbound';
import {
  type InboundFormData,
  type InboundUnit,
  type ProductOption,
  INBOUND_REASON_OPTIONS,
  INBOUND_UNIT_OPTIONS,
} from '@/lib/types/inbound';
import { calculateTotalPieces } from '@/lib/utils/piece-calculation';
import { createInboundSchema } from '@/lib/validations/inbound';

interface ERPInboundFormProps {
  onSuccess?: () => void;
}

/**
 * ERP风格产品入库表单组件
 * 符合中国ERP系统的紧凑布局和操作习惯
 */
export function ERPInboundForm({ onSuccess }: ERPInboundFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 状态管理
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(
    null
  );

  // 表单配置
  const form = useForm<InboundFormData>({
    resolver: zodResolver(createInboundSchema),
    defaultValues: {
      productId: '',
      inputQuantity: 1,
      inputUnit: 'pieces' as InboundUnit,
      quantity: 1,
      reason: 'purchase',
      remarks: '',
      batchNumber: '',
      piecesPerUnit: 1,
      weight: 0.01, // 修复：设置为符合验证规则的最小值
    },
  });

  // API Hooks
  const createMutation = useCreateInboundRecord();

  // 监听表单变化
  const watchedInputQuantity = form.watch('inputQuantity');
  const watchedInputUnit = form.watch('inputUnit');
  const watchedPiecesPerUnit = form.watch('piecesPerUnit');

  // 处理产品选择
  const handleProductSelect = (product: ProductOption) => {
    setSelectedProduct(product);
    // 不在这里设置 productId，让 field.onChange 处理
    form.setValue('inputQuantity', 1);
    form.setValue('quantity', 1);

    // 自动填充产品默认规格参数，用户可根据实际批次情况调整
    form.setValue('piecesPerUnit', product.piecesPerUnit || 1);
    // TODO: weight 属性不存在于 ProductOption 中，需要从完整的产品信息获取
    form.setValue('weight', 0.01); // 设置默认重量

    form.clearErrors([
      'productId',
      'inputQuantity',
      'quantity',
      'piecesPerUnit',
      'weight',
    ]);
  };

  // 计算最终片数
  const calculateFinalQuantity = (
    inputQuantity: number,
    inputUnit: InboundUnit,
    piecesPerUnit: number
  ): number => {
    try {
      // 确保 piecesPerUnit 是有效的正整数
      const validPiecesPerUnit =
        Number.isInteger(piecesPerUnit) && piecesPerUnit > 0
          ? piecesPerUnit
          : 1;

      return calculateTotalPieces(
        { value: inputQuantity, unit: inputUnit },
        validPiecesPerUnit
      );
    } catch (error) {
      // TODO: 使用统一的错误处理机制替代console.error
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('计算片数失败:', error);
      }
      return inputQuantity;
    }
  };

  // 实时计算并更新最终片数
  React.useEffect(() => {
    if (watchedInputQuantity > 0 && watchedPiecesPerUnit > 0) {
      const finalQuantity = calculateFinalQuantity(
        watchedInputQuantity,
        watchedInputUnit,
        watchedPiecesPerUnit
      );
      form.setValue('quantity', finalQuantity);
    }
  }, [watchedInputQuantity, watchedInputUnit, watchedPiecesPerUnit, form]);

  // 表单提交处理
  const onSubmit = async (data: InboundFormData) => {
    try {
      setIsSubmitting(true);

      // 构造请求数据，确保必填字段有默认值，避免请求体缺失字段导致 Zod 校验失败
      const requestData = {
        productId: data.productId,
        inputQuantity: data.inputQuantity,
        inputUnit: data.inputUnit,
        quantity: data.quantity,
        reason: data.reason,
        // 确保规格参数字段始终有值，避免 "Required" 错误
        piecesPerUnit:
          data.piecesPerUnit || selectedProduct?.piecesPerUnit || 1,
        weight: data.weight || 0.01, // selectedProduct 没有 weight 属性
        ...(data.batchNumber?.trim() && {
          batchNumber: data.batchNumber.trim(),
        }),
        ...(data.remarks?.trim() && { remarks: data.remarks.trim() }),
      };

      await createMutation.mutateAsync(requestData);

      toast({
        title: '入库成功',
        description: '产品已成功入库，库存已更新',
      });

      if (onSuccess) {
        onSuccess();
      } else {
        setTimeout(() => {
          router.push('/inventory/inbound');
        }, 1500);
      }
    } catch (error) {
      // TODO: 使用统一的错误处理机制替代console.error
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('入库失败:', error);
      }
      toast({
        title: '入库失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 重置表单
  const handleReset = () => {
    form.reset({
      productId: '',
      inputQuantity: 1,
      inputUnit: 'pieces' as InboundUnit,
      quantity: 1,
      reason: 'purchase',
      remarks: '',
      batchNumber: '',
      piecesPerUnit: 1,
      weight: 0,
    });
    setSelectedProduct(null);
  };

  return (
    <div className="rounded border bg-card">
      {/* ERP标准工具栏 */}
      <div className="border-b bg-muted/30 px-3 py-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">产品入库</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => router.back()}
            >
              <ArrowLeft className="mr-1 h-3 w-3" />
              返回
            </Button>
          </div>
        </div>
      </div>

      {/* 表单内容区域 */}
      <div className="p-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* 第一行：产品选择和入库原因 */}
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">产品选择 *</FormLabel>
                    <FormControl>
                      <ProductSelector
                        value={field.value}
                        onChange={(value, product) => {
                          console.log('Form ProductSelector onChange:', {
                            value,
                            product,
                          });
                          console.log('field.onChange before:', field.value);

                          field.onChange(value);

                          console.log('field.onChange after:', value);

                          if (product) {
                            handleProductSelect(product);
                          }
                        }}
                        placeholder="搜索并选择产品..."
                      />
                    </FormControl>
                    {selectedProduct && (
                      <div className="text-xs text-muted-foreground">
                        已选择：{selectedProduct.label}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">入库原因 *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="请选择入库原因" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INBOUND_REASON_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 第二行：入库单位和数量 */}
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
              <FormField
                control={form.control}
                name="inputUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">入库单位 *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={!selectedProduct}
                    >
                      <FormControl>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="请选择入库单位" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INBOUND_UNIT_OPTIONS.map(option => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            disabled={
                              option.value === 'units' &&
                              (!selectedProduct ||
                                !(selectedProduct.piecesPerUnit || 1) ||
                                (selectedProduct.piecesPerUnit || 1) <= 1)
                            }
                          >
                            {option.label}
                            {option.value === 'units' &&
                              selectedProduct &&
                              (selectedProduct.piecesPerUnit || 1) > 1 &&
                              ` (每件${selectedProduct.piecesPerUnit || 1}片)`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="inputQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">
                      入库数量（
                      {watchedInputUnit === 'pieces' ? '片数' : '件数'}） *
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={e => {
                          const value = e.target.value;
                          field.onChange(value ? parseInt(value) : 0);
                        }}
                        min={1}
                        step={1}
                        className="h-8"
                        placeholder={`请输入${watchedInputUnit === 'pieces' ? '片数' : '件数'}`}
                        disabled={!selectedProduct}
                      />
                    </FormControl>
                    {selectedProduct &&
                      watchedInputQuantity > 0 &&
                      watchedInputUnit === 'units' && (
                        <div className="text-xs text-muted-foreground">
                          转换：{watchedInputQuantity}件 ={' '}
                          {calculateFinalQuantity(
                            watchedInputQuantity,
                            watchedInputUnit,
                            selectedProduct.piecesPerUnit
                          )}
                          片
                        </div>
                      )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 隐藏字段：最终片数 - 确保 quantity 字段被注册到表单中 */}
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem className="hidden">
                    <FormControl>
                      <Input type="hidden" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* 隐藏字段：产品ID - 确保 productId 字段被注册到表单中 */}
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem className="hidden">
                    <FormControl>
                      <Input type="hidden" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* 第三行：产品参数 */}
            <div className="space-y-3">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs">
                <div className="flex items-start space-x-2">
                  <div className="text-blue-600">📋</div>
                  <div className="space-y-2">
                    <div className="font-medium text-blue-900">
                      批次规格参数设置
                    </div>
                    <div className="text-blue-800">
                      系统将使用产品默认规格参数。如果当前批次的规格与默认值不同，请在下方调整：
                    </div>
                    {selectedProduct && (
                      <div className="rounded bg-blue-100 p-2 text-xs text-blue-700">
                        <div className="mb-1 font-medium">产品默认规格：</div>
                        <div>
                          • 每单位片数：{selectedProduct.piecesPerUnit || 1}片
                        </div>
                        <div>• 产品重量：0.01kg（默认值）</div>
                        <div className="mt-1 text-blue-600">
                          💡 如无特殊情况，建议保持默认值以确保库存计算准确
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="piecesPerUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">每单位片数 *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          className="h-8"
                          placeholder="如与默认值不同请调整"
                          {...field}
                          onChange={e => {
                            const value = e.target.value;
                            field.onChange(value ? parseInt(value) : 1);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">产品重量 (kg) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          className="h-8"
                          placeholder="如与默认值不同请调整"
                          {...field}
                          onChange={e => {
                            const value = e.target.value;
                            field.onChange(value ? parseFloat(value) : 0);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 第四行：批次号 */}
            <FormField
              control={form.control}
              name="batchNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">批次号</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="请输入批次号（可选）"
                      maxLength={50}
                      className="h-8"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 第五行：备注 */}
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">备注</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="请输入备注信息（可选）"
                      maxLength={500}
                      rows={3}
                      className="text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 操作按钮 */}
            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                size="sm"
                className="h-8"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    入库中...
                  </>
                ) : (
                  <>
                    <Save className="mr-1 h-3 w-3" />
                    确认入库
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={isSubmitting}
                size="sm"
                className="h-8"
              >
                重置
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
