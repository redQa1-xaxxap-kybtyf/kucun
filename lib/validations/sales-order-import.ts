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

function normalizeFullWidthText(value: string) {
  return value.replace(/[０-９．，￥]/g, char => {
    const code = char.charCodeAt(0);
    if (code >= 0xff10 && code <= 0xff19) {
      return String.fromCharCode(code - 0xfee0);
    }

    if (char === '．') return '.';
    if (char === '，') return ',';
    if (char === '￥') return '¥';
    return char;
  });
}

function normalizeExcelNumberText(value: string) {
  const text = normalizeFullWidthText(value)
    .replace(/[,\s]/g, '')
    .replace(/[¥￥]/g, '')
    .replace(/元$/g, '');

  // 兼容中国用户口语写法："3万""1.5万""3w""3W"→数字
  const wanMatch = text.match(/^(-?\d+(?:\.\d+)?)(?:万|[wW])$/);
  if (wanMatch) {
    return String(Number(wanMatch[1]) * 10000);
  }

  // 兼容"X万Y"："1万5"=15000、"2万500"=20500
  const wanCompoundMatch = text.match(/^(-?\d+)万(\d+(?:\.\d+)?)$/);
  if (wanCompoundMatch) {
    const wan = Number(wanCompoundMatch[1]);
    const tail = Number(wanCompoundMatch[2]);
    // "1万5" 把尾部的个位数视作"千位"（1万5=15000）
    const tailValue = wanCompoundMatch[2].length === 1 ? tail * 1000 : tail;
    return String(wan * 10000 + tailValue);
  }

  return text;
}

function normalizeExcelDateText(value: string) {
  const text = normalizeFullWidthText(value.trim());

  // 中文相对日期
  if (text === '今天' || text === '今日') {
    return formatDate(new Date(), DATE_FORMATS.DATE);
  }
  if (text === '昨天' || text === '昨日') {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return formatDate(date, DATE_FORMATS.DATE);
  }
  if (text === '前天') {
    const date = new Date();
    date.setDate(date.getDate() - 2);
    return formatDate(date, DATE_FORMATS.DATE);
  }

  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}`;
  }

  const chinese = text.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?$/);
  if (chinese) {
    return `${chinese[1]}-${chinese[2].padStart(2, '0')}-${chinese[3].padStart(2, '0')}`;
  }

  // 兼容 "25.5.8"/"25-5-8"/"25/5/8"（两位年份）和 "5.8"/"5/8"/"5-8"（当年）
  const dotted = text.match(
    /^(\d{1,4})[./-](\d{1,2})(?:[./-](\d{1,2}))?$/
  );
  if (dotted) {
    const [, a, b, c] = dotted;
    const today = new Date();

    if (c === undefined) {
      // 仅"月.日"，按当年补齐
      const year = today.getFullYear();
      return `${year}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
    }

    // 两位年份补全为 20xx，四位年份原样保留
    const year = a.length <= 2 ? 2000 + Number(a) : Number(a);
    return `${year}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
  }

  return text;
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

// 清洗常见手机号粘贴噪声：全角数字、+86、空格、横线、英文/中文括号、尾部备注
function normalizeImportPhoneText(value: unknown) {
  const text = normalizeExcelTextInput(value);
  if (typeof text !== 'string') {
    return text;
  }

  const cleaned = normalizeFullWidthText(text)
    .trim()
    .replace(/^\+?86[-\s]?/, '')
    .replace(/[\s()（）-]/g, '');

  // 取前 11 位作为主电话；尾部带"（甲）"等会被上一步剥离掉，剩下纯数字
  const digits = cleaned.match(/^\d{6,15}/);
  return digits ? digits[0] : cleaned;
}

function optionalExcelPhone(label: string, maxLength: number) {
  return z.preprocess(
    normalizeImportPhoneText,
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
        return Number(normalizeExcelNumberText(trimmed));
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
        value => options.min === undefined || value >= options.min,
        `${label}不能小于${options.min}`
      )
      .refine(
        value => options.max === undefined || value <= options.max,
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
        return Number(normalizeExcelNumberText(trimmed));
      }

      return value;
    },
    z
      .number({
        error: () => `${label}必须为数字`,
      })
      .finite(`${label}必须为数字`)
      .refine(
        value => options.min === undefined || value >= options.min,
        `${label}不能小于${options.min}`
      )
      .refine(
        value => options.max === undefined || value <= options.max,
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
    value => {
      const normalized = normalizeExcelTextInput(value);
      return typeof normalized === 'string'
        ? normalizeExcelDateText(normalized)
        : normalized;
    },
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
        return parsedDate ? formatDate(parsedDate, DATE_FORMATS.DATE) : value;
      })
  );
}

const salesOrderDisplayUnitSchema = z.preprocess(
  normalizeExcelTextInput,
  z
    .string()
    .trim()
    .refine(value => ['', '片', '块', '件', '箱', '盒'].includes(value), {
      message: '单位仅支持“片/块”或“件/箱/盒”',
    })
    .transform(value => (['件', '箱', '盒'].includes(value) ? '件' : '片'))
);

export const salesOrderImportRowSchema = z.object({
  导入单号: optionalExcelText('导入单号', 100),
  客户名称: requiredExcelText('客户名称', 150),
  客户电话: optionalExcelPhone('客户电话', 50),
  客户地址: optionalExcelText('客户地址', 300),
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

export type SalesOrderImportRowInput = z.input<
  typeof salesOrderImportRowSchema
>;
export type SalesOrderImportRow = z.infer<typeof salesOrderImportRowSchema>;
