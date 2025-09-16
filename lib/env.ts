import { z } from 'zod';

// 环境变量验证 Schema
const envSchema = z.object({
  // 数据库配置
  DATABASE_URL: z.string().url('DATABASE_URL 必须是有效的 URL'),

  // Next-Auth.js 配置
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL 必须是有效的 URL'),
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET 至少需要 32 个字符'),

  // 应用配置
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // 文件上传配置
  UPLOAD_DIR: z.string().default('./public/uploads'),
  MAX_FILE_SIZE: z.string().default('5MB'),
});

// 验证环境变量
function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map(err => err.path.join('.'))
        .join(', ');
      throw new Error(`缺少或无效的环境变量: ${missingVars}`);
    }
    throw error;
  }
}

// 导出验证后的环境变量
export const env = validateEnv();

// 类型定义
export type Env = z.infer<typeof envSchema>;
