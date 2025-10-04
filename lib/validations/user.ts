// 用户管理验证规则
// 使用 Zod 定义用户创建、更新和查询的验证规则

import { z } from 'zod';

import { paginationConfig } from '@/lib/env';

/**
 * 用户角色枚举
 */
export const userRoleSchema = z.enum(['admin', 'manager', 'user', 'viewer'], {
  message: '请选择有效的用户角色',
});

/**
 * 用户状态枚举
 */
export const userStatusSchema = z.enum(['active', 'inactive', 'suspended'], {
  message: '请选择有效的用户状态',
});

/**
 * 用户创建验证规则
 */
export const createUserSchema = z
  .object({
    username: z
      .string({ message: '用户名必须是字符串' })
      .min(3, { message: '用户名至少3个字符' })
      .max(50, { message: '用户名不能超过50个字符' })
      .regex(/^[a-zA-Z0-9_-]+$/, {
        message: '用户名只能包含字母、数字、下划线和短横线',
      }),

    email: z
      .string({ message: '邮箱必须是字符串' })
      .email({ message: '请输入有效的邮箱地址' })
      .max(100, { message: '邮箱不能超过100个字符' }),

    password: z
      .string({ message: '密码必须是字符串' })
      .min(8, { message: '密码至少8个字符' })
      .max(100, { message: '密码不能超过100个字符' })
      .regex(/[A-Z]/, { message: '密码必须包含至少一个大写字母' })
      .regex(/[a-z]/, { message: '密码必须包含至少一个小写字母' })
      .regex(/[0-9]/, { message: '密码必须包含至少一个数字' }),

    confirmPassword: z.string({ message: '确认密码必须是字符串' }),

    name: z
      .string({ message: '姓名必须是字符串' })
      .min(1, { message: '请输入姓名' })
      .max(100, { message: '姓名不能超过100个字符' }),

    role: userRoleSchema,

    status: userStatusSchema.optional().default('active'),

    phone: z
      .string()
      .regex(/^1[3-9]\d{9}$/, { message: '请输入有效的手机号' })
      .optional()
      .or(z.literal('')),

    department: z
      .string()
      .max(100, { message: '部门名称不能超过100个字符' })
      .optional()
      .or(z.literal('')),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

/**
 * 用户更新验证规则
 */
export const updateUserSchema = z
  .object({
    username: z
      .string()
      .min(3, '用户名至少3个字符')
      .max(50, '用户名不能超过50个字符')
      .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和短横线')
      .optional(),

    email: z
      .string()
      .email('请输入有效的邮箱地址')
      .max(100, '邮箱不能超过100个字符')
      .optional(),

    password: z
      .string()
      .min(8, '密码至少8个字符')
      .max(100, '密码不能超过100个字符')
      .regex(/[A-Z]/, '密码必须包含至少一个大写字母')
      .regex(/[a-z]/, '密码必须包含至少一个小写字母')
      .regex(/[0-9]/, '密码必须包含至少一个数字')
      .optional(),

    confirmPassword: z.string().optional(),

    name: z
      .string()
      .min(1, '请输入姓名')
      .max(100, '姓名不能超过100个字符')
      .optional(),

    role: userRoleSchema.optional(),

    status: userStatusSchema.optional(),

    phone: z
      .string()
      .regex(/^1[3-9]\d{9}$/, '请输入有效的手机号')
      .optional()
      .or(z.literal('')),

    department: z
      .string()
      .max(100, '部门名称不能超过100个字符')
      .optional()
      .or(z.literal('')),
  })
  .refine(
    data => {
      if (data.password && data.confirmPassword) {
        return data.password === data.confirmPassword;
      }
      return true;
    },
    {
      message: '两次输入的密码不一致',
      path: ['confirmPassword'],
    }
  );

/**
 * 用户查询验证规则
 */
export const userQuerySchema = z.object({
  page: z.number().int().positive().optional().default(1),

  limit: z
    .number()
    .int()
    .positive()
    .max(paginationConfig.maxPageSize)
    .optional()
    .default(20),

  search: z.string().optional(),

  role: userRoleSchema.optional(),

  status: userStatusSchema.optional(),

  department: z.string().optional(),

  sortBy: z
    .enum(['createdAt', 'username', 'email', 'name', 'role'])
    .optional()
    .default('createdAt'),

  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

/**
 * 修改密码验证规则
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ message: '请输入当前密码' })
      .min(1, { message: '请输入当前密码' }),

    newPassword: z
      .string({ message: '新密码必须是字符串' })
      .min(8, { message: '新密码至少8个字符' })
      .max(100, { message: '新密码不能超过100个字符' })
      .regex(/[A-Z]/, { message: '新密码必须包含至少一个大写字母' })
      .regex(/[a-z]/, { message: '新密码必须包含至少一个小写字母' })
      .regex(/[0-9]/, { message: '新密码必须包含至少一个数字' }),

    confirmNewPassword: z
      .string({ message: '请确认新密码' })
      .min(1, { message: '请确认新密码' }),
  })
  .refine(data => data.newPassword === data.confirmNewPassword, {
    message: '两次输入的新密码不一致',
    path: ['confirmNewPassword'],
  })
  .refine(data => data.currentPassword !== data.newPassword, {
    message: '新密码不能与当前密码相同',
    path: ['newPassword'],
  });

// 导出类型定义
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;

// 验证工具函数
export const validatePassword = (
  password: string
): {
  valid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('密码至少8个字符');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('必须包含至少一个大写字母');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('必须包含至少一个小写字母');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('必须包含至少一个数字');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const validateUsername = (username: string): boolean => {
  return /^[a-zA-Z0-9_-]{3,50}$/.test(username);
};

export const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// 常量定义
export const USER_CONSTANTS = {
  MIN_USERNAME_LENGTH: 3,
  MAX_USERNAME_LENGTH: 50,
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 100,
  ROLES: ['admin', 'manager', 'user', 'viewer'] as const,
  STATUSES: ['active', 'inactive', 'suspended'] as const,
} as const;
