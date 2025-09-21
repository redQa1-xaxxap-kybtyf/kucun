/**
 * 客户端地址数据服务
 * 通过API获取地址数据，适用于浏览器环境
 * 严格遵循全栈项目统一约定规范
 */

import type {
  AddressData,
  CityData,
  DistrictData,
  ProvinceData,
} from '@/lib/types/address';

/**
 * 获取所有省份列表
 */
export async function getProvinces(): Promise<ProvinceData[]> {
  try {
    const response = await fetch('/api/address/provinces');
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '获取省份数据失败');
    }
    
    return result.data;
  } catch (error) {
    console.error('获取省份数据失败:', error);
    return [];
  }
}

/**
 * 根据省份代码获取城市列表
 */
export async function getCitiesByProvince(provinceCode: string): Promise<CityData[]> {
  try {
    const response = await fetch(`/api/address/cities?provinceCode=${encodeURIComponent(provinceCode)}`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '获取城市数据失败');
    }
    
    return result.data;
  } catch (error) {
    console.error('获取城市数据失败:', error);
    return [];
  }
}

/**
 * 根据城市代码获取区县列表
 */
export async function getDistrictsByCity(cityCode: string): Promise<DistrictData[]> {
  try {
    const response = await fetch(`/api/address/districts?cityCode=${encodeURIComponent(cityCode)}`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '获取区县数据失败');
    }
    
    return result.data;
  } catch (error) {
    console.error('获取区县数据失败:', error);
    return [];
  }
}

/**
 * 格式化地址对象为字符串
 */
export function formatAddressString(address: AddressData): string {
  const parts = [
    address.province,
    address.city,
    address.district,
    address.detail,
  ].filter(Boolean);
  return parts.join('');
}

/**
 * 解析地址字符串为地址对象（简单实现）
 */
export function parseAddressString(addressString: string): AddressData {
  if (!addressString) {
    return {
      province: '',
      city: '',
      district: '',
      detail: '',
    };
  }

  // 简单的解析逻辑，将完整地址放在detail中
  return {
    province: '',
    city: '',
    district: '',
    detail: addressString,
  };
}

/**
 * 验证地址数据的完整性（客户端简化版本）
 */
export function validateAddressData(address: AddressData): boolean {
  return !!(address.province && address.city && address.district);
}

/**
 * 获取地址的完整路径
 */
export function getAddressFullPath(address: AddressData): string {
  return formatAddressString(address);
}
