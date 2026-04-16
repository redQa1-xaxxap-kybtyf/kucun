/**
 * 基础验证规则
 * 严格遵循全栈项目统一约定规范
 */

import { z } from 'zod';

import { paginationConfig } from '@/lib/config/pagination';

// 基础验证规则
export const baseValidations = {
  // ID验证
  id: z.string().min(1, '编号不能为空').uuid('编号格式不正确'),

  // 用户名验证
  username: z
    .string()
    .min(3, '用户名至少3个字符')
    .max(20, '用户名不能超过20个字符')
    .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和短横线'),

  // 密码验证 - 增强版
  password: z
    .string()
    .min(8, '密码至少8个字符')
    .max(100, '密码不能超过100个字符')
    .regex(/[A-Z]/, '密码必须包含至少一个大写字母')
    .regex(/[a-z]/, '密码必须包含至少一个小写字母')
    .regex(/[0-9]/, '密码必须包含至少一个数字')
    .regex(/[^A-Za-z0-9]/, '密码必须包含至少一个特殊字符'),

  // 简单密码验证(用于兼容旧数据)
  simplePassword: z
    .string()
    .min(8, '密码至少8个字符')
    .max(100, '密码不能超过100个字符'),

  // 邮箱验证
  email: z.string().email('邮箱格式不正确'),

  // 手机号验证
  phone: z
    .string()
    .refine(
      val => {
        if (!val || val === '') return true;
        // 支持多种电话格式：
        // 手机号：1[3-9]\d{9}
        // 固话：区号-号码 或 区号号码 (如 010-12345678、01012345678)
        // 400/800：400-xxx-xxxx、800-xxx-xxxx
        const patterns = [
          /^1[3-9]\d{9}$/, // 手机号
          /^0\d{2,3}-?\d{7,8}$/, // 固话
          /^[48]00-?\d{3,4}-?\d{4}$/, // 400/800
        ];
        return patterns.some(pattern => pattern.test(val));
      },
      { message: '请输入正确的电话号码（支持手机号、固话、400电话）' }
    )
    .optional()
    .or(z.literal('')),

  // 姓名验证
  name: z.string().min(1, '姓名不能为空').max(50, '姓名不能超过50个字符'),

  // 地址验证
  address: z.string().max(200, '地址不能超过200个字符').optional(),

  // 备注验证
  remarks: z.string().max(500, '备注不能超过500个字符').optional(),

  // 状态验证
  status: z.enum(['active', 'inactive']).default('active'),

  // 客户ID验证
  customerId: z.string().min(1, '请选择客户').uuid('客户信息格式不正确'),
};

// 分页验证
export const paginationValidations = {
  query: z.object({
    page: z
      .union([z.string(), z.null(), z.undefined()])
      .optional()
      .transform(val => (val ? parseInt(val) : 1))
      .refine(val => val > 0, '页码必须大于0'),

    limit: z
      .union([z.string(), z.null(), z.undefined()])
      .optional()
      .transform(val =>
        val ? parseInt(val) : paginationConfig.defaultPageSize
      )
      .refine(
        val => val > 0 && val <= paginationConfig.maxPageSize,
        `每页数量必须在1-${paginationConfig.maxPageSize}之间`
      ),

    search: z
      .union([z.string(), z.null(), z.undefined()])
      .optional()
      .transform(val => val?.trim() || undefined),

    categoryId: z.string().uuid('分类信息格式不正确').optional(),

    status: z.enum(['active', 'inactive']).optional(),

    sortBy: z
      .enum(['createdAt', 'updatedAt', 'name', 'code'])
      .default('createdAt'),

    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
};

// 用户相关验证
export const userValidations = {
  login: z.object({
    username: baseValidations.username,
    password: baseValidations.simplePassword, // 登录时使用简单密码验证
    captcha: z
      .string()
      .min(4, '验证码格式不正确')
      .max(10, '验证码格式不正确')
      .regex(/^[a-zA-Z0-9]+$/, '验证码只能包含字母和数字'),
  }),

  register: z.object({
    username: baseValidations.username,
    email: baseValidations.email,
    password: baseValidations.password,
    name: baseValidations.name,
  }),

  update: z.object({
    id: baseValidations.id,
    username: baseValidations.username.optional(),
    email: baseValidations.email.optional(),
    name: baseValidations.name.optional(),
    phone: baseValidations.phone,
    status: baseValidations.status.optional(),
  }),

  updatePassword: z.object({
    id: baseValidations.id,
    currentPassword: baseValidations.password,
    newPassword: baseValidations.password,
  }),
};

// 客户相关验证 - 已迁移到 lib/validations/customer.ts
// 遵循唯一真理源原则，请使用 lib/validations/customer.ts 中的验证规则

// 入库记录验证 - 已迁移到 lib/validations/inbound.ts
// 遵循唯一真理源原则，请使用 lib/validations/inbound.ts 中的验证规则

// 导出所有验证类型
export type UserCreateInput = z.infer<typeof userValidations.register>;
export type UserUpdateInput = z.infer<typeof userValidations.update>;
export type UserLoginInput = z.infer<typeof userValidations.login>;
export type UserUpdatePasswordInput = z.infer<
  typeof userValidations.updatePassword
>;
export type UserRegisterInput = z.infer<typeof userValidations.register>;

// 客户相关类型 - 已迁移到 lib/types/customer.ts
// 遵循唯一真理源原则，请从 lib/types/customer.ts 导入相关类型

// 入库记录类型已迁移到 lib/validations/inbound.ts
// 请从该文件导入 CreateInboundData 和 UpdateInboundData 类型
