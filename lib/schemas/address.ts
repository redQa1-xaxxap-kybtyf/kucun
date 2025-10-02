/**
 * 地址相关的Zod验证Schema
 * 严格遵循全栈项目统一约定规范
 */

import { z } from 'zod';

/**
 * 地址数据结构Schema
 */
export const AddressSchema = z.object({
  province: z.string().min(1, '请选择省份').max(50, '省份名称不能超过50个字符'),
  city: z.string().min(1, '请选择城市').max(50, '城市名称不能超过50个字符'),
  district: z.string().min(1, '请选择区县').max(50, '区县名称不能超过50个字符'),
  detail: z
    .string()
    .min(1, '请输入详细地址')
    .max(200, '详细地址不能超过200个字符'),
});

/**
 * 可选地址Schema（用于非必填场景）
 */
export const OptionalAddressSchema = z.object({
  province: z.string().max(50, '省份名称不能超过50个字符').optional(),
  city: z.string().max(50, '城市名称不能超过50个字符').optional(),
  district: z.string().max(50, '区县名称不能超过50个字符').optional(),
  detail: z.string().max(200, '详细地址不能超过200个字符').optional(),
});

/**
 * 地址字符串Schema（兼容现有的字符串格式）
 */
export const AddressStringSchema = z
  .string()
  .max(500, '地址不能超过500个字符')
  .optional();

/**
 * 混合地址Schema（支持对象和字符串两种格式）
 */
export const MixedAddressSchema = z.union([
  AddressSchema,
  OptionalAddressSchema,
  AddressStringSchema,
]);

// 导出类型
export type AddressData = z.infer<typeof AddressSchema>;
export type OptionalAddressData = z.infer<typeof OptionalAddressSchema>;
export type MixedAddressData = z.infer<typeof MixedAddressSchema>;

/**
 * 地址验证工具函数
 */
export const addressValidation = {
  /**
   * 验证完整地址
   */
  validateFullAddress: (address: unknown): address is AddressData =>
    AddressSchema.safeParse(address).success,

  /**
   * 验证可选地址
   */
  validateOptionalAddress: (address: unknown): address is OptionalAddressData =>
    OptionalAddressSchema.safeParse(address).success,

  /**
   * 验证地址字符串
   */
  validateAddressString: (address: unknown): address is string =>
    AddressStringSchema.safeParse(address).success,

  /**
   * 格式化地址对象为字符串
   */
  formatAddressToString: (
    address: AddressData | OptionalAddressData
  ): string => {
    const parts = [
      address.province,
      address.city,
      address.district,
      address.detail,
    ].filter(Boolean);
    return parts.join('');
  },

  /**
   * 解析地址字符串为对象（简单实现）
   */
  parseStringToAddress: (addressString: string): OptionalAddressData => ({
    // 简单的解析逻辑，实际项目中可能需要更复杂的解析
    // 这里只是将字符串放入detail字段
    province: '',
    city: '',
    district: '',
    detail: addressString || '',
  }),

  /**
   * 检查地址是否为空
   */
  isAddressEmpty: (
    address: AddressData | OptionalAddressData | string | null | undefined
  ): boolean => {
    if (!address) {return true;}

    if (typeof address === 'string') {
      return address.trim().length === 0;
    }

    return (
      !address.province && !address.city && !address.district && !address.detail
    );
  },

  /**
   * 获取地址显示文本
   */
  getAddressDisplayText: (
    address: AddressData | OptionalAddressData | string | null | undefined
  ): string => {
    if (!address) {return '-';}

    if (typeof address === 'string') {
      return address || '-';
    }

    const parts = [
      address.province,
      address.city,
      address.district,
      address.detail,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join('') : '-';
  },
};

/**
 * 地址表单默认值
 */
export const addressFormDefaults: OptionalAddressData = {
  province: '',
  city: '',
  district: '',
  detail: '',
};

/**
 * 常用地址验证规则
 */
export const commonAddressValidations = {
  // 必填地址
  required: AddressSchema,

  // 可选地址
  optional: OptionalAddressSchema,

  // 字符串地址（兼容性）
  string: AddressStringSchema,

  // 混合格式
  mixed: MixedAddressSchema,
};

/**
 * 地址字段标签映射
 */
export const ADDRESS_FIELD_LABELS = {
  province: '省份',
  city: '城市',
  district: '区县',
  detail: '详细地址',
  full: '完整地址',
} as const;
