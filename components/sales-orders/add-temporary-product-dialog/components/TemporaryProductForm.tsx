import React from 'react';
import type { UseFormReturn } from 'react-hook-form';

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

import type { TemporaryProductRequirements } from '../../smart-product-search/types';
import { UNIT_OPTIONS } from '../types';
import type { TemporaryProductData } from '../validation';

interface TemporaryProductFormProps {
  form: UseFormReturn<TemporaryProductData>;
  onSubmit: (data: TemporaryProductData) => void;
  onCancel: () => void;
  requirements?: TemporaryProductRequirements;
}

export function TemporaryProductForm({
  form,
  onSubmit,
  onCancel,
  requirements,
}: TemporaryProductFormProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <ProductCodeField form={form} requirements={requirements} />
        <NameField form={form} requirements={requirements} />
        <SpecificationWeightFields form={form} />
        <UnitField form={form} />
        <PiecesPerUnitField form={form} />
        <FormActions onCancel={onCancel} />
      </form>
    </Form>
  );
}

function ProductCodeField({
  form,
  requirements,
}: {
  form: UseFormReturn<TemporaryProductData>;
  requirements?: TemporaryProductRequirements;
}) {
  const requireCode = requirements?.requireCode !== false;
  return (
    <FormField
      control={form.control}
      name="productCode"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            产品编码{requireCode && <span className="text-red-500"> *</span>}
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder={
                requireCode ? '输入产品编码' : '输入产品编码（可选）'
              }
              maxLength={50}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function NameField({
  form,
  requirements,
}: {
  form: UseFormReturn<TemporaryProductData>;
  requirements?: TemporaryProductRequirements;
}) {
  const requireName = requirements?.requireName === true;
  return (
    <FormField
      control={form.control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            产品名称
            {requireName && <span className="text-red-500"> *</span>}
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder={
                requireName ? '输入产品名称' : '输入产品名称（可选）'
              }
              maxLength={100}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SpecificationWeightFields({
  form,
}: {
  form: UseFormReturn<TemporaryProductData>;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField
        control={form.control}
        name="specification"
        render={({ field }) => (
          <FormItem>
            <FormLabel>规格</FormLabel>
            <FormControl>
              <Input {...field} placeholder="输入规格" maxLength={200} />
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
                value={field.value ?? ''}
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
  );
}

function UnitField({ form }: { form: UseFormReturn<TemporaryProductData> }) {
  return (
    <FormField
      control={form.control}
      name="unit"
      render={({ field }) => (
        <FormItem>
          <FormLabel>单位</FormLabel>
          <Select onValueChange={field.onChange} value={field.value || ''}>
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
  );
}

function PiecesPerUnitField({
  form,
}: {
  form: UseFormReturn<TemporaryProductData>;
}) {
  return (
    <FormField
      control={form.control}
      name="piecesPerUnit"
      render={({ field }) => (
        <FormItem>
          <FormLabel>每件片数</FormLabel>
          <FormControl>
            <Input
              type="number"
              min="1"
              step="1"
              placeholder="请输入每件片数"
              value={field.value ?? ''}
              onChange={event => {
                const value = event.target.value;
                field.onChange(value === '' ? undefined : parseInt(value, 10));
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function FormActions({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-3">
      <Button type="button" variant="outline" onClick={onCancel}>
        取消
      </Button>
      <Button type="submit">添加产品</Button>
    </div>
  );
}
