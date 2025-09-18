import { z } from 'zod';

// 基础验证规则
export const baseValidations = {
  id: z.string().uuid('ID 必须是有效的 UUID'),
  email: z.string().email('邮箱格式不正确'),
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, '手机号格式不正确')
    .optional(),
  name: z.string().min(1, '名称不能为空').max(100, '名称不能超过100个字符'),
  code: z.string().min(1, '编码不能为空').max(50, '编码不能超过50个字符'),
  quantity: z.number().min(0, '数量不能为负数'),
  price: z.number().min(0, '价格不能为负数'),
  date: z.date(),
};

// 用户相关验证
export const userValidations = {
  create: z.object({
    email: baseValidations.email,
    username: z
      .string()
      .min(3, '用户名至少3个字符')
      .max(20, '用户名最多20个字符')
      .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线'),
    name: baseValidations.name,
    password: z.string().min(6, '密码至少6个字符'),
    role: z.enum(['admin', 'sales']).default('sales'),
  }),

  update: z.object({
    id: baseValidations.id,
    email: baseValidations.email.optional(),
    username: z
      .string()
      .min(3, '用户名至少3个字符')
      .max(20, '用户名最多20个字符')
      .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线')
      .optional(),
    name: baseValidations.name.optional(),
    role: z.enum(['admin', 'sales']).optional(),
    status: z.enum(['active', 'inactive']).optional(),
  }),

  login: z.object({
    username: z.string().min(1, '用户名不能为空').max(20, '用户名最多20个字符'),
    password: z.string().min(1, '密码不能为空'),
    captcha: z
      .string()
      .min(4, '验证码不能为空')
      .max(6, '验证码格式不正确')
      .regex(/^[A-Z0-9]+$/i, '验证码只能包含字母和数字'),
  }),

  // 密码更新验证
  updatePassword: z
    .object({
      currentPassword: z.string().min(1, '当前密码不能为空'),
      newPassword: z.string().min(6, '新密码至少需要6个字符'),
      confirmPassword: z.string().min(1, '确认密码不能为空'),
    })
    .refine(data => data.newPassword === data.confirmPassword, {
      message: '新密码和确认密码不匹配',
      path: ['confirmPassword'],
    }),

  // 用户注册验证
  register: z
    .object({
      email: baseValidations.email,
      username: z
        .string()
        .min(3, '用户名至少3个字符')
        .max(20, '用户名最多20个字符')
        .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线'),
      name: baseValidations.name,
      password: z.string().min(6, '密码至少需要6个字符'),
      confirmPassword: z.string().min(1, '确认密码不能为空'),
    })
    .refine(data => data.password === data.confirmPassword, {
      message: '密码和确认密码不匹配',
      path: ['confirmPassword'],
    }),
};

// 客户相关验证
export const customerValidations = {
  create: z.object({
    name: baseValidations.name,
    phone: baseValidations.phone,
    address: z.string().max(500, '地址不能超过500个字符').optional(),
    extendedInfo: z.record(z.any()).optional(),
    parentCustomerId: baseValidations.id.optional(),
  }),

  update: z.object({
    id: baseValidations.id,
    name: baseValidations.name.optional(),
    phone: baseValidations.phone,
    address: z.string().max(500, '地址不能超过500个字符').optional(),
    extendedInfo: z.record(z.any()).optional(),
    parentCustomerId: baseValidations.id.optional(),
  }),
};

// 产品相关验证
export const productValidations = {
  create: z.object({
    code: baseValidations.code,
    name: baseValidations.name,
    specification: z.string().max(200, '规格描述不能超过200个字符').optional(),
    specifications: z.record(z.any()).optional(),
    unit: z.enum(['piece', 'sheet', 'strip']).default('piece'),
    piecesPerUnit: z.number().int().min(1, '每件片数至少为1').default(1),
    weight: z.number().min(0, '重量不能为负数').optional(),
  }),

  update: z.object({
    id: baseValidations.id,
    code: baseValidations.code.optional(),
    name: baseValidations.name.optional(),
    specification: z.string().max(200, '规格描述不能超过200个字符').optional(),
    specifications: z.record(z.any()).optional(),
    unit: z.enum(['piece', 'sheet', 'strip']).optional(),
    piecesPerUnit: z.number().int().min(1, '每件片数至少为1').optional(),
    weight: z.number().min(0, '重量不能为负数').optional(),
    status: z.enum(['active', 'inactive']).optional(),
  }),
};

// 销售单相关验证
export const salesOrderValidations = {
  create: z.object({
    customerId: baseValidations.id,
    items: z
      .array(
        z.object({
          productId: baseValidations.id,
          colorCode: z.string().max(50, '色号不能超过50个字符').optional(),
          productionDate: z.string().max(20, '生产日期格式不正确').optional(),
          quantity: z.number().min(0.01, '数量必须大于0'),
          unitPrice: z.number().min(0, '单价不能为负数'),
        })
      )
      .min(1, '至少需要一个商品'),
    remarks: z.string().max(500, '备注不能超过500个字符').optional(),
  }),

  update: z.object({
    id: baseValidations.id,
    status: z
      .enum(['draft', 'confirmed', 'shipped', 'completed', 'cancelled'])
      .optional(),
    remarks: z.string().max(500, '备注不能超过500个字符').optional(),
  }),
};

// 库存相关验证
export const inventoryValidations = {
  create: z.object({
    productId: baseValidations.id,
    productionDate: z.date().optional(),
    quantity: z.number().int().min(0, '库存数量不能为负数'),
  }),

  update: z.object({
    id: baseValidations.id,
    quantity: z.number().int().min(0, '库存数量不能为负数').optional(),
    reservedQuantity: z.number().int().min(0, '预留数量不能为负数').optional(),
  }),

  adjust: z.object({
    productId: baseValidations.id,
    productionDate: z.string().optional(),
    adjustmentType: z.enum(['increase', 'decrease']),
    quantity: z.number().int().min(1, '调整数量必须大于0'),
    reason: z.string().max(200, '调整原因不能超过200个字符'),
  }),
};

// 入库记录相关验证
export const inboundRecordValidations = {
  create: z.object({
    type: z
      .enum(['normal_inbound', 'return_inbound', 'adjust_inbound'])
      .default('normal_inbound'),
    productId: baseValidations.id,
    colorCode: z.string().max(50, '色号不能超过50个字符').optional(),
    productionDate: z.string().optional(),
    quantity: z.number().min(0.01, '入库数量必须大于0'),
    remarks: z.string().max(500, '备注不能超过500个字符').optional(),
  }),
};

// 分页查询验证
export const paginationValidations = {
  query: z.object({
    page: z.number().int().min(1, '页码必须大于0').default(1),
    limit: z
      .number()
      .int()
      .min(1, '每页数量必须大于0')
      .max(100, '每页数量不能超过100')
      .default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    search: z.string().max(100, '搜索关键词不能超过100个字符').optional(),
    // 新增库存查询参数
    productId: z.string().optional(),
    variantId: z.string().optional(),
    colorCode: z.string().optional(),
    batchNumber: z.string().optional(),
    location: z.string().optional(),
    productionDateStart: z.string().optional(),
    productionDateEnd: z.string().optional(),
    lowStock: z.boolean().optional(),
    hasStock: z.boolean().optional(),
    groupByVariant: z.boolean().optional(),
    includeVariants: z.boolean().optional(),
  }),
};

// API 响应验证
export const apiResponseValidations = {
  success: z.object({
    success: z.literal(true),
    data: z.any(),
    message: z.string().optional(),
  }),

  error: z.object({
    success: z.literal(false),
    error: z.string(),
    details: z.any().optional(),
  }),

  paginated: z.object({
    success: z.literal(true),
    data: z.array(z.any()),
    pagination: z.object({
      page: z.number().int(),
      limit: z.number().int(),
      total: z.number().int(),
      totalPages: z.number().int(),
    }),
  }),
};

// 导出所有验证类型
export type UserCreateInput = z.infer<typeof userValidations.create>;
export type UserUpdateInput = z.infer<typeof userValidations.update>;
export type UserLoginInput = z.infer<typeof userValidations.login>;
export type UserUpdatePasswordInput = z.infer<
  typeof userValidations.updatePassword
>;
export type UserRegisterInput = z.infer<typeof userValidations.register>;

export type CustomerCreateInput = z.infer<typeof customerValidations.create>;
export type CustomerUpdateInput = z.infer<typeof customerValidations.update>;

export type ProductCreateInput = z.infer<typeof productValidations.create>;
export type ProductUpdateInput = z.infer<typeof productValidations.update>;

export type SalesOrderCreateInput = z.infer<
  typeof salesOrderValidations.create
>;
export type SalesOrderUpdateInput = z.infer<
  typeof salesOrderValidations.update
>;

export type InventoryCreateInput = z.infer<typeof inventoryValidations.create>;
export type InventoryUpdateInput = z.infer<typeof inventoryValidations.update>;
export type InventoryAdjustInput = z.infer<typeof inventoryValidations.adjust>;

export type InboundRecordCreateInput = z.infer<
  typeof inboundRecordValidations.create
>;

export type PaginationQuery = z.infer<typeof paginationValidations.query>;
