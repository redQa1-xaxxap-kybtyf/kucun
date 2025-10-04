// 验证码验证规则
// 使用 Zod 定义验证码验证的输入验证规则

import { z } from 'zod';

/**
 * 验证码验证输入schema
 * 用于验证用户提交的验证码
 */
export const verifyCaptchaSchema = z.object({
  sessionId: z
    .string({ message: '会话ID必须是字符串' })
    .min(1, { message: '缺少会话ID' })
    .uuid({ message: '无效的会话ID格式' }),

  captcha: z
    .string({ message: '验证码必须是字符串' })
    .min(1, { message: '请输入验证码' })
    .min(4, { message: '验证码长度不正确' })
    .max(10, { message: '验证码长度不正确' })
    .regex(/^[a-zA-Z0-9]+$/, { message: '验证码只能包含字母和数字' }),

  deleteAfterVerify: z.boolean().optional().default(true),
});

/**
 * 验证码生成配置schema（可选，用于自定义验证码配置）
 */
export const captchaConfigSchema = z
  .object({
    length: z
      .number()
      .int()
      .min(4, { message: '验证码长度最少为4位' })
      .max(10, { message: '验证码长度最多为10位' })
      .optional()
      .default(6),

    width: z
      .number()
      .int()
      .min(100, { message: '图片宽度最小为100' })
      .max(500, { message: '图片宽度最大为500' })
      .optional()
      .default(150),

    height: z
      .number()
      .int()
      .min(40, { message: '图片高度最小为40' })
      .max(200, { message: '图片高度最大为200' })
      .optional()
      .default(50),

    noise: z
      .number()
      .int()
      .min(0, { message: '噪点数量不能为负数' })
      .max(10, { message: '噪点数量最多为10' })
      .optional()
      .default(3),

    color: z.boolean().optional().default(true),

    background: z.string().optional(),
  })
  .strict();

// 导出类型定义
export type VerifyCaptchaInput = z.infer<typeof verifyCaptchaSchema>;
export type CaptchaConfigInput = z.infer<typeof captchaConfigSchema>;

// 验证工具函数
export const validateCaptchaFormat = (captcha: string): boolean => {
  return (
    /^[a-zA-Z0-9]+$/.test(captcha) &&
    captcha.length >= 4 &&
    captcha.length <= 10
  );
};

export const validateSessionId = (sessionId: string): boolean => {
  // UUID v4 格式验证
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(sessionId);
};

// 常量定义
export const CAPTCHA_CONSTANTS = {
  MIN_LENGTH: 4,
  MAX_LENGTH: 10,
  DEFAULT_LENGTH: 6,
  DEFAULT_WIDTH: 150,
  DEFAULT_HEIGHT: 50,
  DEFAULT_NOISE: 3,
  SESSION_TTL: 300, // 5分钟过期
  MAX_ATTEMPTS: 3, // 最多尝试3次
} as const;
