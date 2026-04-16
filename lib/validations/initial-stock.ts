import { z } from 'zod';

import {
  COST_PRICE_MAX,
  COST_PRICE_MAX_LABEL,
  hasAtMostCostPriceDecimals,
} from '@/lib/utils/cost-price';

export type InitialStockQuantityUnit = '片' | '件';

const INITIAL_STOCK_QUANTITY_UNIT_ALIASES: Record<
  string,
  InitialStockQuantityUnit
> = {
  片: '片',
  砖片: '片',
  piece: '片',
  pieces: '片',
  pc: '片',
  pcs: '片',
  sheet: '片',
  sheets: '片',
  件: '件',
  箱: '件',
  整件: '件',
  unit: '件',
  units: '件',
  box: '件',
  boxes: '件',
  case: '件',
  cases: '件',
};

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

function optionalQuantityUnit(label: string) {
  return z.preprocess(
    value => {
      if (value === '' || value === null || value === undefined) {
        return undefined;
      }

      const text = normalizeExcelTextInput(value);
      if (typeof text !== 'string') {
        return text;
      }

      const trimmed = text.trim();
      if (!trimmed) {
        return undefined;
      }

      const normalizedKey = trimmed.replace(/\s+/g, '').toLowerCase();
      return INITIAL_STOCK_QUANTITY_UNIT_ALIASES[normalizedKey] ?? trimmed;
    },
    z
      .string()
      .refine(
        value => value === '片' || value === '件',
        `${label}只能填写“件”或“片”`
      )
      .transform(value => value as InitialStockQuantityUnit)
      .optional()
  );
}

function requiredExcelNumber(
  label: string,
  options: {
    integer?: boolean;
    min?: number;
    max?: number;
    maxDecimals?: number;
  } = {}
) {
  const { integer = false, min, max, maxDecimals } = options;

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
      .refine(val => (max === undefined ? true : val <= max), {
        message:
          max === undefined
            ? `${label}格式不正确`
            : `${label}不能超过${max === COST_PRICE_MAX ? COST_PRICE_MAX_LABEL : max}`,
      })
      .refine(val => (integer ? Number.isInteger(val) : true), {
        message: `${label}必须是整数`,
      })
      .refine(
        val =>
          maxDecimals === undefined
            ? true
            : maxDecimals === 3
              ? hasAtMostCostPriceDecimals(val)
              : true,
        {
          message: `${label}最多保留${maxDecimals}位小数`,
        }
      )
  );
}

function optionalExcelNumber(
  label: string,
  options: {
    integer?: boolean;
    min?: number;
    max?: number;
    maxDecimals?: number;
  } = {}
) {
  const { integer = false, min, max, maxDecimals } = options;

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
      .optional()
      .refine(
        val => val === undefined || (min === undefined ? true : val >= min),
        {
          message:
            min === undefined
              ? `${label}格式不正确`
              : min === 0
                ? `${label}不能为负数`
                : `${label}必须大于等于${min}`,
        }
      )
      .refine(
        val => val === undefined || (max === undefined ? true : val <= max),
        {
          message:
            max === undefined
              ? `${label}格式不正确`
              : `${label}不能超过${max === COST_PRICE_MAX ? COST_PRICE_MAX_LABEL : max}`,
        }
      )
      .refine(
        val => val === undefined || (integer ? Number.isInteger(val) : true),
        {
          message: `${label}必须是整数`,
        }
      )
      .refine(
        val =>
          val === undefined
            ? true
            : maxDecimals === undefined
              ? true
              : maxDecimals === 3
                ? hasAtMostCostPriceDecimals(val)
                : true,
        {
          message: `${label}最多保留${maxDecimals}位小数`,
        }
      )
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
 * - 装箱数（可选，不填时默认使用产品档案）
 * - 本批次实际每件重量(kg)（可选，不填时默认使用产品档案）
 * - 数量
 * - 数量单位（可选，支持“件/片”；不填时兼容旧模板按“片”处理）
 * - 单位成本
 * - 供应商（可选，按供应商名称精确匹配）
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
    装箱数: optionalExcelNumber('装箱数', {
      integer: true,
      min: 1,
      max: 10000,
    }),
    '本批次实际每件重量(kg)': optionalExcelNumber('本批次实际每件重量(kg)', {
      min: 0.01,
      max: 10000,
      maxDecimals: 3,
    }),
    数量: requiredExcelNumber('数量', { integer: true, min: 1 }),
    数量单位: optionalQuantityUnit('数量单位'),
    单位成本: requiredExcelNumber('单位成本', {
      min: 0,
      max: COST_PRICE_MAX,
      maxDecimals: 3,
    }),
    供应商: optionalExcelText('供应商', 150),
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
