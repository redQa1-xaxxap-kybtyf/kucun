import { z } from 'zod';

/**
 * 期初库存 Excel 导入单行数据结构
 *
 * Excel 列示例：
 * - 产品编码
 * - 产品名称（可选，主要用于人工核对）
 * - 规格（可选）
 * - 色号
 * - 批次号
 * - 数量
 * - 单位成本
 * - 成本来源（可选备注）
 * - 库位（可选）
 * - 备注（可选）
 */
export const initialStockRowSchema = z.object({
  产品编码: z
    .string({
      required_error: '产品编码不能为空',
      invalid_type_error: '产品编码必须为文本',
    })
    .trim()
    .min(1, '产品编码不能为空'),
  产品名称: z
    .string({
      invalid_type_error: '产品名称必须为文本',
    })
    .trim()
    .optional()
    .or(z.literal('')),
  规格: z
    .string({
      invalid_type_error: '规格必须为文本',
    })
    .trim()
    .optional()
    .or(z.literal('')),
  色号: z
    .string({
      invalid_type_error: '色号必须为文本',
    })
    .trim()
    .optional()
    .or(z.literal('')),
  批次号: z
    .string({
      required_error: '批次号不能为空',
      invalid_type_error: '批次号必须为文本',
    })
    .trim()
    .min(1, '批次号不能为空'),
  数量: z
    .union([
      z.number({ invalid_type_error: '数量必须为数字' }),
      z
        .string()
        .trim()
        .regex(/^-?\d+(\.\d+)?$/, '数量必须为数字')
        .transform(val => Number(val)),
    ])
    .refine(val => val > 0, '数量必须大于0'),
  单位成本: z
    .union([
      z.number({ invalid_type_error: '单位成本必须为数字' }),
      z
        .string()
        .trim()
        .regex(/^-?\d+(\.\d+)?$/, '单位成本必须为数字')
        .transform(val => Number(val)),
    ])
    .refine(val => val >= 0, '单位成本不能为负数'),
  成本来源: z
    .string({
      invalid_type_error: '成本来源必须为文本',
    })
    .trim()
    .optional()
    .or(z.literal('')),
  库位: z
    .string({
      invalid_type_error: '库位必须为文本',
    })
    .trim()
    .optional()
    .or(z.literal('')),
  备注: z
    .string({
      invalid_type_error: '备注必须为文本',
    })
    .trim()
    .optional()
    .or(z.literal('')),
});

export type InitialStockRowInput = z.input<typeof initialStockRowSchema>;
export type InitialStockRow = z.infer<typeof initialStockRowSchema>;

export const initialStockImportSchema = z.object({
  rows: z
    .array(initialStockRowSchema)
    .min(1, '导入数据不能为空')
    .max(5000, '单次导入行数不能超过 5000 行'),
});
