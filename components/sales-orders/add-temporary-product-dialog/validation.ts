import { z } from 'zod';

const baseTemporaryProductSchema = z.object({
  productCode: z
    .string()
    .max(50, '产品编码不能超过50个字符')
    .optional()
    .or(z.literal(''))
    .transform(value => (value ?? '').trim()),
  name: z
    .string()
    .max(100, '产品名称不能超过100个字符')
    .optional()
    .or(z.literal(''))
    .transform(value => (value ?? '').trim()),
  specification: z
    .string()
    .max(200, '规格不能超过200个字符')
    .optional()
    .or(z.literal(''))
    .transform(value => (value ?? '').trim()),
  weight: z
    .number()
    .min(0, '重量不能为负数')
    .max(99999.99, '重量不能超过99,999.99')
    .multipleOf(0.01, '重量最多保留2位小数')
    .optional(),
  unit: z
    .string()
    .max(20, '单位不能超过20个字符')
    .optional()
    .or(z.literal(''))
    .transform(value => (value ?? '').trim()),
  piecesPerUnit: z
    .number()
    .int('装箱数必须为整数')
    .min(1, '装箱数必须大于0')
    .max(9999, '装箱数不能超过9999')
    .optional(),
});

export type TemporaryProductData = z.infer<typeof baseTemporaryProductSchema>;

export interface TemporaryProductValidationOptions {
  requireCode?: boolean;
  requireName?: boolean;
}

export function createTemporaryProductSchema(
  options: TemporaryProductValidationOptions = {}
) {
  const { requireCode = true, requireName = true } = options;

  return baseTemporaryProductSchema.superRefine((data, ctx) => {
    if (requireCode && (!data.productCode || data.productCode.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '产品编码不能为空',
        path: ['productCode'],
      });
    }

    if (requireName && (!data.name || data.name.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '产品名称不能为空',
        path: ['name'],
      });
    }
  });
}

export const temporaryProductSchema = createTemporaryProductSchema();
