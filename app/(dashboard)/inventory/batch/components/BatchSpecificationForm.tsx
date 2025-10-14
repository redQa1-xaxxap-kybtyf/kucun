'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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
import type { ProductOption } from '@/lib/types/inbound';
import type { CreateBatchSpecificationRequest } from '@/lib/types/batch-specification';
import {
  createBatchSpecificationSchema,
  batchSpecificationDefaults,
} from '@/lib/validations/batch-specification';

const formSchema = createBatchSpecificationSchema;
type FormValues = z.infer<typeof formSchema>;

interface BatchSpecificationFormProps {
  mode: 'create' | 'edit';
  defaultValues?: {
    productId: string;
    productName?: string;
    productCode?: string;
    batchNumber: string;
    piecesPerUnit: number;
    weight?: number;
    thickness?: number;
  };
  onSubmit: (values: CreateBatchSpecificationRequest) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function BatchSpecificationForm({
  mode,
  defaultValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: BatchSpecificationFormProps) {
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(
    null
  );

  const initialValues = useMemo<FormValues>(() => {
    return {
      productId: defaultValues?.productId ?? '',
      batchNumber: defaultValues?.batchNumber ?? '',
      piecesPerUnit:
        defaultValues?.piecesPerUnit ??
        batchSpecificationDefaults.piecesPerUnit,
      weight: defaultValues?.weight,
      thickness: defaultValues?.thickness,
    };
  }, [defaultValues]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    form.reset(initialValues);
  }, [form, initialValues]);

  useEffect(() => {
    if (mode === 'edit' && defaultValues?.productId) {
      setSelectedProduct({
        value: defaultValues.productId,
        label: defaultValues.productName ?? '',
        code: defaultValues.productCode ?? '',
        unit: '',
        piecesPerUnit:
          defaultValues.piecesPerUnit ??
          batchSpecificationDefaults.piecesPerUnit,
      });
    }
  }, [mode, defaultValues]);

  const handleSubmit = async (values: FormValues) => {
    await onSubmit({
      productId: values.productId,
      batchNumber: values.batchNumber.trim(),
      piecesPerUnit: values.piecesPerUnit,
      ...(values.weight !== undefined && values.weight !== null
        ? { weight: values.weight }
        : {}),
      ...(values.thickness !== undefined && values.thickness !== null
        ? { thickness: values.thickness }
        : {}),
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-4"
        noValidate
      >
        <FormField
          control={form.control}
          name="productId"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>
                选择产品
                <span className="text-destructive ml-1">*</span>
              </FormLabel>
              <FormControl>
                {mode === 'edit' ? (
                  <div className="border-muted-foreground/40 bg-muted/40 rounded-md border border-dashed px-3 py-2 text-sm">
                    <div className="text-foreground font-medium">
                      {defaultValues?.productName ?? '—'}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      产品编码：{defaultValues?.productCode ?? '—'}
                    </div>
                  </div>
                ) : (
                  <ProductSelector
                    value={field.value}
                    onChange={(productId, product) => {
                      field.onChange(productId);
                      if (product) {
                        setSelectedProduct(product);
                      }
                    }}
                    placeholder="搜索产品名称或编码"
                    error={fieldState.invalid}
                  />
                )}
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="batchNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                批次号
                <span className="text-destructive ml-1">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="例如：P2301-20241012-001"
                  {...field}
                  disabled={mode === 'edit'}
                  autoComplete="off"
                  inputMode="text"
                  spellCheck={false}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="piecesPerUnit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  每件片数
                  <span className="text-destructive ml-1">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={field.value ?? ''}
                    onChange={event => {
                      const value = event.target.value;
                      field.onChange(
                        value === '' ? undefined : Number.parseInt(value, 10)
                      );
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
                <FormLabel>重量 (kg)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="可选"
                    value={
                      field.value === undefined || field.value === null
                        ? ''
                        : field.value
                    }
                    onChange={event => {
                      const value = event.target.value;
                      field.onChange(value === '' ? undefined : Number(value));
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="thickness"
          render={({ field }) => (
            <FormItem>
              <FormLabel>厚度 (mm)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="可选"
                  value={
                    field.value === undefined || field.value === null
                      ? ''
                      : field.value
                  }
                  onChange={event => {
                    const value = event.target.value;
                    field.onChange(value === '' ? undefined : Number(value));
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {mode === 'create' && selectedProduct ? (
          <div className="border-muted-foreground/40 bg-muted/30 text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs">
            当前选择产品：{selectedProduct.label}（编码：{selectedProduct.code}
            ）
            {selectedProduct.piecesPerUnit
              ? `，默认每件片数 ${selectedProduct.piecesPerUnit}`
              : ''}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '提交中...' : '保存'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
