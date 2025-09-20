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

// API and Types
import { useCreateInboundRecord } from '@/lib/api/inbound';
import type {
  InboundFormData,
  InboundUnit,
  ProductOption,
} from '@/lib/types/inbound';
import {
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
    },
  });

  // API Hooks
  const createMutation = useCreateInboundRecord();

  // 监听表单变化
  const watchedInputQuantity = form.watch('inputQuantity');
  const watchedInputUnit = form.watch('inputUnit');

  // 处理产品选择
  const handleProductSelect = (product: ProductOption) => {
    setSelectedProduct(product);
    form.setValue('productId', product.value);
    form.setValue('inputQuantity', 1);
    form.setValue('quantity', 1);
    form.clearErrors(['inputQuantity', 'quantity']);
  };

  // 计算最终片数
  const calculateFinalQuantity = (
    inputQuantity: number,
    inputUnit: InboundUnit,
    piecesPerUnit: number
  ): number => {
    try {
      return calculateTotalPieces(
        { value: inputQuantity, unit: inputUnit },
        piecesPerUnit
      );
    } catch (error) {
      console.error('计算片数失败:', error);
      return inputQuantity;
    }
  };

  // 实时计算并更新最终片数
  React.useEffect(() => {
    if (selectedProduct && watchedInputQuantity > 0) {
      const finalQuantity = calculateFinalQuantity(
        watchedInputQuantity,
        watchedInputUnit,
        selectedProduct.piecesPerUnit
      );
      form.setValue('quantity', finalQuantity);
    }
  }, [watchedInputQuantity, watchedInputUnit, selectedProduct, form]);

  // 表单提交处理
  const onSubmit = async (data: InboundFormData) => {
    try {
      setIsSubmitting(true);

      if (!data.productId) {
        throw new Error('请选择产品');
      }

      if (!data.quantity || data.quantity < 1) {
        throw new Error('请输入有效的入库数量');
      }

      const requestData = {
        productId: data.productId,
        inputQuantity: data.inputQuantity,
        inputUnit: data.inputUnit,
        quantity: data.quantity,
        reason: data.reason,
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
      console.error('入库失败:', error);
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
    form.reset();
    setSelectedProduct(null);
  };

  return (
    <div className="rounded border bg-card">
      {/* ERP标准工具栏 */}
      <div className="border-b bg-muted/30 px-3 py-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">产品入库</h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7" onClick={() => router.back()}>
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
                          field.onChange(value);
                          if (product) {
                            handleProductSelect(product);
                          }
                        }}
                        placeholder="搜索并选择产品..."
                      />
                    </FormControl>
                    {selectedProduct && (
                      <div className="text-xs text-muted-foreground">
                        {selectedProduct.label} | 每件{selectedProduct.piecesPerUnit}片
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                !selectedProduct.piecesPerUnit ||
                                selectedProduct.piecesPerUnit <= 1)
                            }
                          >
                            {option.label}
                            {option.value === 'units' &&
                              selectedProduct &&
                              selectedProduct.piecesPerUnit > 1 &&
                              ` (每件${selectedProduct.piecesPerUnit}片)`}
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
                      入库数量（{watchedInputUnit === 'pieces' ? '片数' : '件数'}） *
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
                          转换：{watchedInputQuantity}件 = {calculateFinalQuantity(
                            watchedInputQuantity,
                            watchedInputUnit,
                            selectedProduct.piecesPerUnit
                          )}片
                        </div>
                      )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 第三行：备注 */}
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
