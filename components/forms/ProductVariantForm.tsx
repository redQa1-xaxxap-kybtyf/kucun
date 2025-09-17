'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Check, Hash, Loader2, Palette, Tag, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ColorCodeDisplay } from '@/components/ui/color-code-display';
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
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

import {
    checkSKUAvailability,
    createProductVariant,
    generateSKU,
    updateProductVariant,
} from '@/lib/api/product-variants';
import type { ProductVariant } from '@/lib/types/product';

// 表单验证Schema
const productVariantSchema = z.object({
  colorCode: z.string().min(1, '色号不能为空').max(20, '色号不能超过20个字符'),
  colorName: z.string().max(50, '色号名称不能超过50个字符').optional(),
  colorValue: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '颜色值格式不正确').optional(),
  sku: z.string().max(50, 'SKU不能超过50个字符').optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

type ProductVariantFormData = z.infer<typeof productVariantSchema>;

interface ProductVariantFormProps {
  productId: string;
  productCode: string;
  variant?: ProductVariant;
  onSuccess: () => void;
  onCancel: () => void;
}

// 预定义的常用颜色
const COMMON_COLORS = [
  { code: 'WHT', name: '白色', value: '#FFFFFF' },
  { code: 'BLK', name: '黑色', value: '#000000' },
  { code: 'GRY', name: '灰色', value: '#808080' },
  { code: 'RED', name: '红色', value: '#FF0000' },
  { code: 'BLU', name: '蓝色', value: '#0000FF' },
  { code: 'GRN', name: '绿色', value: '#008000' },
  { code: 'YLW', name: '黄色', value: '#FFFF00' },
  { code: 'ORG', name: '橙色', value: '#FFA500' },
];

export function ProductVariantForm({
  productId,
  productCode,
  variant,
  onSuccess,
  onCancel,
}: ProductVariantFormProps) {
  const [isGeneratingSku, setIsGeneratingSku] = useState(false);
  const [skuAvailable, setSkuAvailable] = useState<boolean | null>(null);
  const [skuSuggestions, setSkuSuggestions] = useState<string[]>([]);

  const { toast } = useToast();
  const isEditing = !!variant;

  const form = useForm<ProductVariantFormData>({
    resolver: zodResolver(productVariantSchema),
    defaultValues: {
      colorCode: variant?.colorCode || '',
      colorName: variant?.colorName || '',
      colorValue: variant?.colorValue || '',
      sku: variant?.sku || '',
      status: variant?.status || 'active',
    },
  });

  const { watch, setValue, getValues } = form;
  const watchedColorCode = watch('colorCode');
  const watchedSku = watch('sku');

  // 创建/更新变体
  const createMutation = useMutation({
    mutationFn: (data: ProductVariantFormData) =>
      createProductVariant(productId, data),
    onSuccess: () => {
      toast({
        title: '创建成功',
        description: '产品变体已成功创建',
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: '创建失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ProductVariantFormData) =>
      updateProductVariant({ id: variant!.id, ...data }),
    onSuccess: () => {
      toast({
        title: '更新成功',
        description: '产品变体已成功更新',
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: '更新失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 自动生成SKU
  const handleGenerateSku = async () => {
    const colorCode = getValues('colorCode');
    if (!colorCode) {
      toast({
        title: '请先输入色号',
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingSku(true);
    try {
      const result = await generateSKU(productCode, colorCode);
      setValue('sku', result);
      setSkuAvailable(true);
      setSkuSuggestions([]);
    } catch (error) {
      toast({
        title: '生成SKU失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingSku(false);
    }
  };

  // 检查SKU可用性
  const checkSku = async (sku: string) => {
    if (!sku) {
      setSkuAvailable(null);
      setSkuSuggestions([]);
      return;
    }

    try {
      const result = await checkSKUAvailability(sku, variant?.id);
      setSkuAvailable(result);
      if (!result) {
        // 如果SKU不可用，获取建议
        // 这里可以调用API获取建议，暂时使用简单逻辑
        const suggestions = [
          `${sku}-01`,
          `${sku}-02`,
          `${sku}-A`,
        ];
        setSkuSuggestions(suggestions);
      } else {
        setSkuSuggestions([]);
      }
    } catch (error) {
      console.error('检查SKU可用性失败:', error);
      setSkuAvailable(null);
      setSkuSuggestions([]);
    }
  };

  // 监听SKU变化
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (watchedSku) {
        checkSku(watchedSku);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [watchedSku, variant?.id]);

  // 自动生成SKU（当色号变化时）
  useEffect(() => {
    if (watchedColorCode && !isEditing && !getValues('sku')) {
      const autoSku = `${productCode}-${watchedColorCode}`;
      setValue('sku', autoSku);
    }
  }, [watchedColorCode, productCode, isEditing, setValue, getValues]);

  const onSubmit = (data: ProductVariantFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleQuickColorSelect = (color: typeof COMMON_COLORS[0]) => {
    setValue('colorCode', color.code);
    setValue('colorName', color.name);
    setValue('colorValue', color.value);
  };

  const handleSkuSuggestionSelect = (suggestion: string) => {
    setValue('sku', suggestion);
    setSkuSuggestions([]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          {isEditing ? '编辑产品变体' : '创建产品变体'}
        </CardTitle>
        <CardDescription>
          为产品 {productCode} 管理色号变体信息
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* 快速颜色选择 */}
            {!isEditing && (
              <div className="space-y-3">
                <Label>快速选择常用颜色</Label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_COLORS.map((color) => (
                    <Button
                      key={color.code}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickColorSelect(color)}
                      className="flex items-center gap-2"
                    >
                      <div
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: color.value }}
                      />
                      {color.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 色号 */}
              <FormField
                control={form.control}
                name="colorCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      色号 *
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="输入色号，如 WHT、BLK"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e.target.value.toUpperCase());
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      建议使用3-5位字母或数字组合
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 色号名称 */}
              <FormField
                control={form.control}
                name="colorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>色号名称</FormLabel>
                    <FormControl>
                      <Input placeholder="如：白色、黑色" {...field} />
                    </FormControl>
                    <FormDescription>
                      便于识别的中文名称
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 颜色值 */}
              <FormField
                control={form.control}
                name="colorValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>颜色值</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Input
                          placeholder="#FFFFFF"
                          {...field}
                          className="flex-1"
                        />
                        <input
                          type="color"
                          value={field.value || '#FFFFFF'}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="w-12 h-10 border rounded cursor-pointer"
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      十六进制颜色代码
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* SKU */}
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      SKU
                    </FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Input placeholder="自动生成或手动输入" {...field} />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleGenerateSku}
                          disabled={isGeneratingSku || !watchedColorCode}
                        >
                          {isGeneratingSku ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            '生成'
                          )}
                        </Button>
                      </div>
                    </FormControl>

                    {/* SKU可用性状态 */}
                    {watchedSku && (
                      <div className="flex items-center gap-2 mt-2">
                        {skuAvailable === true && (
                          <Badge variant="default" className="bg-green-500">
                            <Check className="h-3 w-3 mr-1" />
                            SKU可用
                          </Badge>
                        )}
                        {skuAvailable === false && (
                          <Badge variant="destructive">
                            <X className="h-3 w-3 mr-1" />
                            SKU已存在
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* SKU建议 */}
                    {skuSuggestions.length > 0 && (
                      <div className="mt-2">
                        <Label className="text-sm text-muted-foreground">建议的SKU:</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {skuSuggestions.map((suggestion) => (
                            <Button
                              key={suggestion}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleSkuSuggestionSelect(suggestion)}
                            >
                              {suggestion}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    <FormDescription>
                      产品的唯一标识码
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 状态 */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>状态</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择状态" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">启用</SelectItem>
                      <SelectItem value="inactive">停用</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    停用的变体不会在销售中显示
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 预览 */}
            {(watchedColorCode || watchedSku) && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <Label className="text-sm font-medium">预览</Label>
                <div className="mt-2 flex items-center gap-4">
                  <ColorCodeDisplay
                    colorCode={watchedColorCode}
                    label={getValues('colorName') || watchedColorCode}
                    size="lg"
                  />
                  <div>
                    <div className="font-medium">{watchedSku || '未设置SKU'}</div>
                    <div className="text-sm text-muted-foreground">
                      {getValues('colorName') || watchedColorCode}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onCancel}>
                取消
              </Button>
              <Button
                type="submit"
                disabled={
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  Boolean(watchedSku && skuAvailable === false)
                }
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEditing ? '更新变体' : '创建变体'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
