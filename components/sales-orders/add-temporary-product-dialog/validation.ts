import { z } from 'zod';

export const temporaryProductSchema = z.object({
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
  piecesPerUnit: z
    .number()
    .int('每件片数必须为整数')
    .min(1, '每件片数必须大于0')
    .max(9999, '每件片数不能超过9999')
    .optional(),
});

export type TemporaryProductData = z.infer<typeof temporaryProductSchema>;
