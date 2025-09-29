'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Package } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

// 临时产品数据验证Schema
const temporaryProductSchema = z.object({
  name: z
    .string()
    .min(1, '商品名称不能为空')
    .max(100, '商品名称不能超过100个字符'),
  specification: z
    .string()
    .max(200, '规格不能超过200个字符')
    .optional()
    .or(z.literal('')),
  weight: z
    .number()
    .min(0, '重量不能为负数')
    .max(99999.99, '重量不能超过99,999.99')
    .multipleOf(0.01, '重量最多保留2位小数')
    .optional(),
  unit: z.string().max(20, '单位不能超过20个字符').optional().or(z.literal('')),
});

type TemporaryProductData = z.infer<typeof temporaryProductSchema>;

// 常用单位选项
// 瓷砖行业专用：只使用"件"和"片"两种单位
const UNIT_OPTIONS = [
  { value: '片', label: '片' },
  { value: '件', label: '件' },
];

interface AddTemporaryProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onConfirm: (data: TemporaryProductData) => void;
}

/**
 * 添加临时产品对话框
 * 用于快速添加不在库存中的临时商品
 */
export function AddTemporaryProductDialog({
  open,
  onOpenChange,
  initialName = '',
  onConfirm,
}: AddTemporaryProductDialogProps) {
  const form = useForm<TemporaryProductData>({
    resolver: zodResolver(temporaryProductSchema),
    defaultValues: {
      name: '',
      specification: '',
      weight: undefined,
      unit: '',
    },
  });

  // 当对话框打开时，设置初始商品名称
  React.useEffect(() => {
    if (open && initialName) {
      form.setValue('name', initialName);
      // 聚焦到商品名称输入框
      setTimeout(() => {
        const nameInput = document.querySelector(
          '[name="name"]'
        ) as HTMLInputElement;
        if (nameInput) {
          nameInput.focus();
          nameInput.select();
        }
      }, 100);
    }
  }, [open, initialName, form]);

  // 处理表单提交
  const handleSubmit = (data: TemporaryProductData) => {
    onConfirm(data);
    handleClose();
  };

  // 处理对话框关闭
  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            添加临时商品
          </DialogTitle>
          <DialogDescription>
            添加不在库存中的临时商品信息。临时商品仅保存在此订单中，不会影响商品库存。
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {/* 提示信息 */}
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
              <div className="text-sm">
                <div className="font-medium text-amber-800">临时商品说明</div>
                <div className="mt-1 text-amber-700">
                  此商品仅存储在当前订单中，不会添加到商品库存系统
                </div>
              </div>
              <Badge variant="outline" className="ml-auto text-xs">
                临时
              </Badge>
            </div>

            {/* 商品名称 */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    商品名称 <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="输入商品名称"
                      maxLength={100}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 规格和重量 */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="specification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>规格</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="输入规格"
                        maxLength={200}
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
                    <FormLabel>重量</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="输入重量"
                        value={field.value || ''}
                        onChange={e => {
                          const value = e.target.value;
                          field.onChange(
                            value === '' ? undefined : Number(value)
                          );
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 单位 */}
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>单位</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ''}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择单位" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {UNIT_OPTIONS.map(option => (
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                取消
              </Button>
              <Button type="submit">添加商品</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
