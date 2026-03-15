import { z } from 'zod';

const productImportNumberSchema = z
  .union([
    z.number({
      invalid_type_error: '必须为数字',
    } as any),
    z
      .string({
        invalid_type_error: '必须为数字',
      } as any)
      .trim()
      .regex(/^-?\d+(\.\d+)?$/, '必须为数字')
      .transform(value => Number(value)),
  ])
  .optional()
  .or(z.literal(''))
  .transform(value => {
    if (value === '' || value === undefined) {
      return undefined;
    }

    return value;
  });

export const productImportRowSchema = z.object({
  产品编码: z
    .string({
      required_error: '产品编码不能为空',
      invalid_type_error: '产品编码必须为文本',
    } as any)
    .trim()
    .min(1, '产品编码不能为空')
    .max(50, '产品编码不能超过50个字符'),
  产品名称: z
    .string({
      required_error: '产品名称不能为空',
      invalid_type_error: '产品名称必须为文本',
    } as any)
    .trim()
    .min(1, '产品名称不能为空')
    .max(100, '产品名称不能超过100个字符'),
  规格: z
    .string({
      required_error: '规格不能为空',
      invalid_type_error: '规格必须为文本',
    } as any)
    .trim()
    .min(1, '规格不能为空')
    .max(200, '规格不能超过200个字符'),
  分类编码: z
    .string({
      invalid_type_error: '分类编码必须为文本',
    } as any)
    .trim()
    .optional()
    .or(z.literal('')),
  '厚度(mm)': productImportNumberSchema,
  状态: z
    .string({
      invalid_type_error: '状态必须为文本',
    } as any)
    .trim()
    .optional()
    .or(z.literal('')),
  描述: z
    .string({
      invalid_type_error: '描述必须为文本',
    } as any)
    .trim()
    .max(1000, '描述不能超过1000个字符')
    .optional()
    .or(z.literal('')),
});

export const productImportSchema = z.object({
  rows: z
    .array(productImportRowSchema)
    .min(1, '导入数据不能为空')
    .max(1000, '单次最多导入 1000 条产品数据'),
});

export type ProductImportRowInput = z.input<typeof productImportRowSchema>;
export type ProductImportRow = z.infer<typeof productImportRowSchema>;
