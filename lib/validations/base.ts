/**
 * 基础验证规则
 * 严格遵循全栈项目统一约定规范
 */

import { z } from 'zod';

import { paginationConfig } from '@/lib/env';

// 基础验证规则
export const baseValidations = {
  // ID验证
  id: z.string().min(1, 'ID不能为空').uuid('ID格式不正确'),

  // 用户名验证
  username: z
    .string()
    .min(3, '用户名至少3个字符')
    .max(20, '用户名不能超过20个字符')
    .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线'),

  // 密码验证
  password: z
    .string()
    .min(6, '密码至少6个字符')
    .max(50, '密码不能超过50个字符'),

  // 邮箱验证
  email: z.string().email('邮箱格式不正确'),

  // 手机号验证
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, '手机号格式不正确')
    .optional(),

  // 姓名验证
  name: z.string().min(1, '姓名不能为空').max(50, '姓名不能超过50个字符'),

  // 地址验证
  address: z.string().max(200, '地址不能超过200个字符').optional(),

  // 备注验证
  remarks: z.string().max(500, '备注不能超过500个字符').optional(),

  // 状态验证
  status: z.enum(['active', 'inactive']).default('active'),

  // 客户ID验证
  customerId: z.string().min(1, '请选择客户').uuid('客户ID格式不正确'),
};

// 分页验证
export const paginationValidations = {
  query: z.object({
    page: z
      .string()
      .optional()
      .transform(val => (val ? parseInt(val) : 1))
      .refine(val => val > 0, '页码必须大于0'),

    limit: z
      .string()
      .optional()
      .transform(val =>
        val ? parseInt(val) : paginationConfig.defaultPageSize
      )
      .refine(
        val => val > 0 && val <= paginationConfig.maxPageSize,
        `每页数量必须在1-${paginationConfig.maxPageSize}之间`
      ),

    search: z
      .string()
      .optional()
      .transform(val => val?.trim() || undefined),

    categoryId: z.string().uuid('分类ID格式不正确').optional(),

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
    password: baseValidations.password,
    captcha: z.string().min(1, '请输入验证码'),
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
