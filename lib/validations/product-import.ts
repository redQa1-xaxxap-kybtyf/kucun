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

const productImportNumberSchema = z.preprocess(
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
        .regex(/^-?\d+(\.\d+)?$/, '必须为数字')
        .transform(value => Number(value)),
    ])
    .optional()
);

export const productImportRowSchema = z.object({
  产品编码: requiredExcelText('产品编码', 50),
  产品名称: requiredExcelText('产品名称', 100),
  规格: requiredExcelText('规格', 200),
  产品分类: optionalExcelText('产品分类', 300),
  一级分类: optionalExcelText('一级分类', 150),
  二级分类: optionalExcelText('二级分类', 150),
  三级分类: optionalExcelText('三级分类', 150),
  分类路径: optionalExcelText('分类路径', 300),
  分类名称: optionalExcelText('分类名称', 150),
  分类编码: optionalExcelText('分类编码', 100),
  '厚度(mm)': productImportNumberSchema,
  状态: optionalExcelText('状态', 20),
  描述: optionalExcelText('描述', 1000),
});

export const productImportSchema = z.object({
  rows: z
    .array(productImportRowSchema)
    .min(1, '导入数据不能为空')
    .max(1000, '单次最多导入 1000 条产品数据'),
});

export type ProductImportRowInput = z.input<typeof productImportRowSchema>;
export type ProductImportRow = z.infer<typeof productImportRowSchema>;
