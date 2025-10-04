// 文件上传验证规则
// 使用 Zod 定义文件上传的验证规则

import { z } from 'zod';

/**
 * 上传文件类型枚举
 */
export const uploadFileTypeSchema = z.enum([
  'image',
  'document',
  'excel',
  'other',
]);

/**
 * 允许的图片格式
 */
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

/**
 * 允许的文档格式
 */
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/**
 * 允许的 Excel 格式
 */
const ALLOWED_EXCEL_TYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
];

/**
 * 文件大小限制（字节）
 */
export const FILE_SIZE_LIMITS = {
  image: 5 * 1024 * 1024, // 5MB
  document: 10 * 1024 * 1024, // 10MB
  excel: 10 * 1024 * 1024, // 10MB
  other: 5 * 1024 * 1024, // 5MB
} as const;

/**
 * 上传配置验证规则
 */
export const uploadConfigSchema = z.object({
  fileType: uploadFileTypeSchema.optional().default('other'),

  maxSize: z
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024, '文件大小不能超过50MB')
    .optional(),

  allowedMimeTypes: z.array(z.string()).optional(),

  folder: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, '文件夹名称只能包含字母、数字、下划线和短横线')
    .optional(),

  generateUniqueName: z.boolean().optional().default(true),
});

/**
 * 上传验证函数
 */
export const validateFileUpload = (
  file: File,
  fileType: 'image' | 'document' | 'excel' | 'other' = 'other'
): { success: boolean; error?: string } => {
  // 检查文件大小
  const maxSize = FILE_SIZE_LIMITS[fileType];
  if (file.size > maxSize) {
    return {
      success: false,
      error: `文件大小不能超过 ${(maxSize / 1024 / 1024).toFixed(0)}MB`,
    };
  }

  // 检查文件类型
  let allowedTypes: string[] = [];
  switch (fileType) {
    case 'image':
      allowedTypes = ALLOWED_IMAGE_TYPES;
      break;
    case 'document':
      allowedTypes = ALLOWED_DOCUMENT_TYPES;
      break;
    case 'excel':
      allowedTypes = ALLOWED_EXCEL_TYPES;
      break;
    default:
      // 其他类型不做 MIME 类型限制
      return { success: true };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      success: false,
      error: `不支持的文件类型: ${file.type}`,
    };
  }

  return { success: true };
};

/**
 * 文件名验证
 */
export const validateFileName = (fileName: string): boolean => {
  // 不允许包含特殊字符，防止路径遍历攻击
  const invalidChars = /[<>:"|?*\/\\]/;
  if (invalidChars.test(fileName)) {
    return false;
  }

  // 文件名长度限制
  if (fileName.length > 255) {
    return false;
  }

  return true;
};

// 导出类型定义
export type UploadConfigInput = z.infer<typeof uploadConfigSchema>;
export type UploadFileType = z.infer<typeof uploadFileTypeSchema>;

// 常量导出
export const UPLOAD_CONSTANTS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_IMAGE_TYPES,
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_EXCEL_TYPES,
  FILE_SIZE_LIMITS,
} as const;
