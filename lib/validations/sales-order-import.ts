import { z } from 'zod';

import { DATE_FORMATS, formatDate, parseDate } from '@/lib/utils/datetime';

function normalizeExcelTextInput(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return formatDate(value, DATE_FORMATS.DATE);
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
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
  options: {
    min?: number;
    max?: number;
    maxDecimals?: number;
  } = {}
) {
  return z.preprocess(
    value => {
      if (value === '' || value === null || value === undefined) {
        return undefined;
      }

      if (typeof value === 'number') {
        return value;
      }

      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
          return undefined;
        }
        return Number(trimmed);
      }

      return value;
    },
    z
      .number({
        error: issue =>
          issue.input === undefined ? `${label}不能为空` : `${label}必须为数字`,
      })
      .finite(`${label}必须为数字`)
      .refine(
        value =>
          options.min === undefined || value >= options.min,
        `${label}不能小于${options.min}`
      )
      .refine(
        value =>
          options.max === undefined || value <= options.max,
        `${label}不能大于${options.max}`
      )
      .refine(value => {
        if (options.maxDecimals === undefined) {
          return true;
        }

        const text = value.toString();
        const decimals = text.includes('.') ? text.split('.')[1].length : 0;
        return decimals <= options.maxDecimals;
      }, `${label}最多保留${options.maxDecimals}位小数`)
  );
}

function optionalExcelNumber(
  label: string,
  options: {
    min?: number;
    max?: number;
    maxDecimals?: number;
    integer?: boolean;
  } = {}
) {
  return z.preprocess(
    value => {
      if (value === '' || value === null || value === undefined) {
        return undefined;
      }

      if (typeof value === 'number') {
        return value;
      }

      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
          return undefined;
        }
        return Number(trimmed);
      }

      return value;
    },
    z
      .number({
        error: () => `${label}必须为数字`,
      })
      .finite(`${label}必须为数字`)
      .refine(
        value =>
          options.min === undefined || value >= options.min,
        `${label}不能小于${options.min}`
      )
      .refine(
        value =>
          options.max === undefined || value <= options.max,
        `${label}不能大于${options.max}`
      )
      .refine(
        value => !options.integer || Number.isInteger(value),
        `${label}必须为整数`
      )
      .refine(value => {
        if (options.maxDecimals === undefined) {
          return true;
        }

        const text = value.toString();
        const decimals = text.includes('.') ? text.split('.')[1].length : 0;
        return decimals <= options.maxDecimals;
      }, `${label}最多保留${options.maxDecimals}位小数`)
      .optional()
  );
}

function optionalExcelDate(label: string) {
  return z.preprocess(
    normalizeExcelTextInput,
    z
      .string()
      .trim()
      .refine(
        value => !value || Boolean(parseDate(value)),
        `${label}格式不正确，请使用YYYY-MM-DD`
      )
      .transform(value => {
        if (!value) {
          return '';
        }

        const parsedDate = parseDate(value);
        return parsedDate
          ? formatDate(parsedDate, DATE_FORMATS.DATE)
          : value;
      })
  );
}

const salesOrderDisplayUnitSchema = z.preprocess(
  normalizeExcelTextInput,
  z
    .string()
    .trim()
    .refine(value => value === '' || value === '片' || value === '件', {
      message: '单位仅支持“片”或“件”',
    })
    .transform(value => (value === '件' ? '件' : '片'))
);

export const salesOrderImportRowSchema = z.object({
  导入单号: optionalExcelText('导入单号', 100),
  客户名称: requiredExcelText('客户名称', 150),
  订单日期: optionalExcelDate('订单日期'),
  产品编码: requiredExcelText('产品编码', 50),
  产品名称: optionalExcelText('产品名称', 150),
  装箱数: optionalExcelNumber('装箱数', {
    min: 1,
    max: 9999,
    integer: true,
  }),
  规格: optionalExcelText('规格', 100),
  色号: optionalExcelText('色号', 20),
  批次号: optionalExcelText('批次号', 50),
  生产日期: optionalExcelDate('生产日期'),
  单位: salesOrderDisplayUnitSchema,
  数量: requiredExcelNumber('数量', {
    min: 0.01,
    max: 999999.99,
    maxDecimals: 2,
  }),
  单价: requiredExcelNumber('单价', {
    min: 0,
    max: 999999.99,
    maxDecimals: 2,
  }),
  金额: optionalExcelNumber('金额', {
    min: 0,
    max: 99999999.99,
    maxDecimals: 2,
  }),
  订单备注: optionalExcelText('订单备注', 500),
  明细备注: optionalExcelText('明细备注', 200),
});

export const salesOrderImportSchema = z.object({
  rows: z
    .array(z.unknown())
    .min(1, '导入数据不能为空')
    .max(3000, '单次导入行数不能超过 3000 行'),
});

export type SalesOrderImportRowInput = z.input<typeof salesOrderImportRowSchema>;
export type SalesOrderImportRow = z.infer<typeof salesOrderImportRowSchema>;
