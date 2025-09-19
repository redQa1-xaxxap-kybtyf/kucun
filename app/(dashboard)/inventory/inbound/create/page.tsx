'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, Package, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

// UI Components
import { ProductSelector } from '@/components/inventory/product-selector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
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

// Icons

// API and Types
import { useCreateInboundRecord } from '@/lib/api/inbound';
import type { InboundFormData } from '@/lib/types/inbound';
import { INBOUND_REASON_OPTIONS } from '@/lib/types/inbound';
import { calculatePieceDisplay } from '@/lib/utils/piece-calculation';
import { createInboundSchema } from '@/lib/validations/inbound';

// Components

/**
 * 产品入库页面
 * 提供产品入库表单功能
 */
export default function CreateInboundPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 状态管理
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(
    null
  );
  const [quantityInput, setQuantityInput] = useState<string>('');
  const [calculatedPieces, setCalculatedPieces] = useState<number | null>(null);

  // 表单配置
  const form = useForm<InboundFormData>({
    resolver: zodResolver(createInboundSchema),
    defaultValues: {
      productId: '',
      quantity: undefined, // 修改为undefined，避免默认值0无法删除的问题
      reason: 'purchase',
      remarks: '',
    },
  });

  // API Hooks
  const createMutation = useCreateInboundRecord();

  // 处理产品选择
  const handleProductSelect = (product: ProductOption) => {
    setSelectedProduct(product);
    form.setValue('productId', product.value);

    // 重置数量相关状态
    setQuantityInput('');
    setCalculatedPieces(null);
    form.setValue('quantity', undefined);
  };

  // 处理数量输入变化
  const handleQuantityChange = (value: string) => {
    setQuantityInput(value);

    if (!selectedProduct || !value.trim()) {
      setCalculatedPieces(null);
      form.setValue('quantity', undefined);
      return;
    }

    try {
      // 解析输入的数量（支持多种格式）
      const totalPieces = parseInt(value, 10);

      if (isNaN(totalPieces) || totalPieces <= 0) {
        setCalculatedPieces(null);
        form.setValue('quantity', undefined);
        return;
      }

      setCalculatedPieces(totalPieces);
      form.setValue('quantity', totalPieces);
    } catch (error) {
      setCalculatedPieces(null);
      form.setValue('quantity', undefined);
    }
  };

  // 表单提交处理
  const onSubmit = async (data: InboundFormData) => {
    try {
      setIsSubmitting(true);

      await createMutation.mutateAsync({
        productId: data.productId,
        quantity: data.quantity,
        reason: data.reason,
        remarks: data.remarks?.trim() || undefined,
      });

      toast({
        title: '入库成功',
        description: '产品已成功入库，库存已更新',
      });

      // 延迟跳转，让用户看到成功提示
      setTimeout(() => {
        router.push('/inventory/inbound');
      }, 1500);
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
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">产品入库</h1>
          <p className="text-muted-foreground">添加新的产品入库记录</p>
        </div>
      </div>

      {/* 入库表单 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            入库信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* 产品选择 */}
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>产品选择 *</FormLabel>
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
                      <div className="mt-2 text-sm text-muted-foreground">
                        已选择：{selectedProduct.label} | 每件片数：
                        {selectedProduct.piecesPerUnit}片
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 数量输入 */}
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>入库数量（片数） *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        value={quantityInput}
                        onChange={e => handleQuantityChange(e.target.value)}
                        min={1}
                        step={1}
                        placeholder="请输入入库片数"
                        disabled={!selectedProduct}
                      />
                    </FormControl>
                    {selectedProduct && calculatedPieces && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {(() => {
                          const result = calculatePieceDisplay(
                            calculatedPieces,
                            selectedProduct.piecesPerUnit
                          );
                          return `换算结果：${result.displayText}`;
                        })()}
                      </div>
                    )}
                    <FormDescription>
                      {selectedProduct
                        ? `请输入总片数，系统将自动换算为件数显示（每件${selectedProduct.piecesPerUnit}片）`
                        : '请先选择产品'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 入库原因 */}
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>入库原因 *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
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

              {/* 备注 */}
              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>备注</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="请输入备注信息（可选，最多500字符）"
                        maxLength={500}
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 操作按钮 */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      入库中...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      确认入库
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={isSubmitting}
                >
                  重置
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* 操作提示 */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2 text-sm text-muted-foreground">
            <h4 className="font-medium text-foreground">操作说明：</h4>
            <ul className="list-inside list-disc space-y-1">
              <li>产品选择支持按名称、编码搜索</li>
              <li>数量支持小数点，最小值为0.01</li>
              <li>入库成功后会自动更新库存数量</li>
              <li>备注信息可选，最多支持500个字符</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
