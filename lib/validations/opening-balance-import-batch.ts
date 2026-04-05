import { z } from 'zod';

import {
  COST_PRICE_MAX,
  COST_PRICE_MAX_LABEL,
  hasAtMostCostPriceDecimals,
} from '@/lib/utils/cost-price';

export const openingBalanceImportBatchIdSchema = z
  .string()
  .trim()
  .min(1, '导入批次号不能为空')
  .max(40, '导入批次号不能超过40个字符');

export const openingBalanceImportBatchCorrectionSchema = z.object({
  corrections: z
    .array(
      z.object({
        id: z.string().uuid('记录ID格式不正确'),
        quantity: z
          .number()
          .int('数量必须是整数')
          .min(1, '数量必须大于等于1片')
          .max(999999, '数量不能超过999999片'),
        unitCost: z
          .number()
          .min(0, '单位成本不能为负数')
          .max(COST_PRICE_MAX, `单位成本不能超过${COST_PRICE_MAX_LABEL}`)
          .refine(hasAtMostCostPriceDecimals, {
            message: '单位成本最多保留3位小数',
          })
          .optional(),
      })
    )
    .min(1, '请至少提交一条更正记录'),
});
