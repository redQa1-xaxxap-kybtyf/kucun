import type { AddressData } from './types';

/**
 * 解析地址字符串为地址对象
 * 简单的解析逻辑，实际项目中可能需要更复杂的解析算法
 */
export const parseAddressString = (address: string): AddressData => {
  if (!address) {
    return {
      province: '',
      city: '',
      district: '',
      detail: '',
    };
  }

  // 简单的解析逻辑，可以根据实际需求优化
  return {
    province: '',
    city: '',
    district: '',
    detail: address || '',
  };
};

/**
 * 格式化地址对象为字符串
 */
export const formatAddressString = (address: AddressData): string => {
  const parts = [
    address.province,
    address.city,
    address.district,
    address.detail,
  ].filter(Boolean);
  return parts.join('');
};
