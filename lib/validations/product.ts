// 产品表单验证规则（前端）
// 遵循全栈开发执行手册：使用Zod进行表单验证，与React Hook Form集成

import { z } from 'zod'

// 基础验证规则
const baseValidations = {
  code: z.string()
    .min(1, '产品编码不能为空')
    .max(50, '产品编码不能超过50个字符')
    .regex(/^[A-Za-z0-9-_]+$/, '产品编码只能包含字母、数字、短横线和下划线'),
  
  name: z.string()
    .min(1, '产品名称不能为空')
    .max(100, '产品名称不能超过100个字符'),
  
  specification: z.string()
    .max(200, '规格描述不能超过200个字符')
    .optional()
    .or(z.literal('')),
  
  unit: z.enum(['piece', 'sheet', 'strip'], {
    errorMap: () => ({ message: '请选择有效的计量单位' })
  }),
  
  piecesPerUnit: z.number({
    required_error: '每件片数不能为空',
    invalid_type_error: '每件片数必须是数字'
  })
    .int('每件片数必须是整数')
    .min(1, '每件片数至少为1')
    .max(10000, '每件片数不能超过10000'),
  
  weight: z.number({
    invalid_type_error: '重量必须是数字'
  })
    .min(0, '重量不能为负数')
    .max(100000, '重量不能超过100000kg')
    .optional()
    .or(z.literal('')),
  
  status: z.enum(['active', 'inactive'], {
    errorMap: () => ({ message: '请选择有效的产品状态' })
  }),
}

// 瓷砖规格验证
const tileSpecificationValidations = {
  color: z.string().max(50, '颜色描述不能超过50个字符').optional(),
  surface: z.string().max(50, '表面处理不能超过50个字符').optional(),
  thickness: z.number().min(0, '厚度不能为负数').max(100, '厚度不能超过100mm').optional(),
  size: z.string().max(50, '尺寸规格不能超过50个字符').optional(),
  pattern: z.string().max(50, '花纹描述不能超过50个字符').optional(),
  grade: z.string().max(20, '等级不能超过20个字符').optional(),
  origin: z.string().max(50, '产地不能超过50个字符').optional(),
  series: z.string().max(50, '系列名称不能超过50个字符').optional(),
}

// 产品创建表单验证
export const productCreateSchema = z.object({
  code: baseValidations.code,
  name: baseValidations.name,
  specification: baseValidations.specification,
  unit: baseValidations.unit.default('piece'),
  piecesPerUnit: baseValidations.piecesPerUnit.default(1),
  weight: baseValidations.weight,
  // 瓷砖特有规格信息
  specifications: z.object(tileSpecificationValidations).optional(),
  // 产品图片
  images: z.array(z.string().url('图片URL格式不正确')).optional(),
})

// 产品更新表单验证
export const productUpdateSchema = z.object({
  id: z.string().min(1, '产品ID不能为空'),
  code: baseValidations.code.optional(),
  name: baseValidations.name.optional(),
  specification: baseValidations.specification,
  unit: baseValidations.unit.optional(),
  piecesPerUnit: baseValidations.piecesPerUnit.optional(),
  weight: baseValidations.weight,
  status: baseValidations.status.optional(),
  // 瓷砖特有规格信息
  specifications: z.object(tileSpecificationValidations).optional(),
  // 产品图片
  images: z.array(z.string().url('图片URL格式不正确')).optional(),
})

// 产品搜索表单验证
export const productSearchSchema = z.object({
  search: z.string().max(100, '搜索关键词不能超过100个字符').optional(),
  status: z.enum(['active', 'inactive', 'all']).optional(),
  unit: z.enum(['piece', 'sheet', 'strip', '']).optional(),
  sortBy: z.enum(['name', 'code', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// 导出类型推断
export type ProductCreateFormData = z.infer<typeof productCreateSchema>
export type ProductUpdateFormData = z.infer<typeof productUpdateSchema>
export type ProductSearchFormData = z.infer<typeof productSearchSchema>

// 表单默认值
export const productCreateDefaults: Partial<ProductCreateFormData> = {
  unit: 'piece',
  piecesPerUnit: 1,
  specification: '',
  weight: 0, // 修复：使用 0 而不是 undefined，避免受控/非受控组件错误
  images: [],
  specifications: {
    color: '',
    surface: '',
    thickness: 0, // 修复：使用 0 而不是 undefined，避免受控/非受控组件错误
    size: '',
    pattern: '',
    grade: '',
    origin: '',
    series: '',
  }
}

export const productSearchDefaults: ProductSearchFormData = {
  search: '',
  status: 'all',
  unit: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
}
