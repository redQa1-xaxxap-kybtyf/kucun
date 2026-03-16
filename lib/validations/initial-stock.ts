import { z } from 'zod';

function normalizeExcelTextInput(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value instanceof Date
  ) {
    return String(value);
  }

  return value;
}

function requiredExcelText(label: string, maxLength: number) {
  return z.preprocess(
    normalizeExcelTextInput,
    z
      .string()
      .trim()
      .min(1, `${label}不能为空`)
      .max(maxLength, `${label}不能超过${maxLength}个字符`)
  );
}

function optionalExcelText(label: string, maxLength: number) {
  return z.preprocess(
    normalizeExcelTextInput,
    z.string().trim().max(maxLength, `${label}不能超过${maxLength}个字符`)
  );
}

function requiredExcelNumber(
  label: string,
  options: { integer?: boolean; min?: number } = {}
) {
  const { integer = false, min } = options;

  return z.preprocess(
    value => {
      if (value === '' || value === null || value === undefined) {
        return undefined;
      }

      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : undefined;
      }

      return value;
    },
    z
      .union([
        z.number(),
        z
          .string()
          .regex(/^-?\d+(\.\d+)?$/, `${label}必须为数字`)
          .transform(val => Number(val)),
      ])
      .refine(val => (min === undefined ? true : val >= min), {
        message:
          min === undefined
            ? `${label}格式不正确`
            : min === 0
              ? `${label}不能为负数`
              : `${label}必须大于等于${min}`,
      })
      .refine(val => (integer ? Number.isInteger(val) : true), {
        message: `${label}必须是整数`,
      })
  );
}

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
export const initialStockRowSchema = z
  .object({
    产品编码: optionalExcelText('产品编码', 100),
    产品名称: optionalExcelText('产品名称', 150),
    规格: optionalExcelText('规格', 200),
    色号: optionalExcelText('色号', 64),
    批次号: requiredExcelText('批次号', 100),
    数量: requiredExcelNumber('数量', { integer: true, min: 1 }),
    单位成本: requiredExcelNumber('单位成本', { min: 0 }),
    成本来源: optionalExcelText('成本来源', 200),
    库位: optionalExcelText('库位', 100),
    备注: optionalExcelText('备注', 500),
  })
  .superRefine((row, ctx) => {
    if (row.产品编码) {
      return;
    }

    if (!row.产品名称) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['产品名称'],
        message: '未填写产品编码时，产品名称不能为空',
      });
    }

    if (!row.规格) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['规格'],
        message: '未填写产品编码时，规格不能为空',
      });
    }
  });

export type InitialStockRowInput = z.input<typeof initialStockRowSchema>;
export type InitialStockRow = z.infer<typeof initialStockRowSchema>;

export const initialStockImportSchema = z.object({
  rows: z
    .array(z.unknown())
    .min(1, '导入数据不能为空')
    .max(5000, '单次导入行数不能超过 5000 行'),
});
