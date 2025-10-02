/**
 * 地址数据服务
 * 基于china-division包提供完整的中国地址数据
 * 严格遵循全栈项目统一约定规范
 */

// 使用完整的地址数据文件
import type {
  AddressData,
  AddressSearchResult,
  CityData,
  DistrictData,
  ProvinceData,
} from '@/lib/types/address';

import { areas, cities, provinces } from '../data/complete-address-data-full';

/**
 * 获取所有省份列表
 */
export function getProvinces(): ProvinceData[] {
  return provinces.map(province => ({
    code: province.code,
    name: province.name,
    type: 'province' as const,
  }));
}

/**
 * 根据省份代码获取城市列表
 */
export function getCitiesByProvince(provinceCode: string): CityData[] {
  return cities
    .filter(city => city.provinceCode === provinceCode)
    .map(city => ({
      code: city.code,
      name: city.name,
      type: 'city' as const,
      provinceCode: city.provinceCode,
      parentCode: city.provinceCode,
    }));
}

/**
 * 根据城市代码获取区县列表
 */
export function getDistrictsByCity(cityCode: string): DistrictData[] {
  return areas
    .filter(area => area.cityCode === cityCode)
    .map(area => ({
      code: area.code,
      name: area.name,
      type: 'district' as const,
      cityCode: area.cityCode,
      provinceCode: area.provinceCode,
      parentCode: area.cityCode,
    }));
}

/**
 * 根据省份名称获取省份代码
 */
export function getProvinceCodeByName(provinceName: string): string | null {
  const province = provinces.find(p => p.name === provinceName);
  return province ? province.code : null;
}

/**
 * 根据城市名称和省份代码获取城市代码
 */
export function getCityCodeByName(
  cityName: string,
  provinceCode: string
): string | null {
  const city = cities.find(
    c => c.name === cityName && c.provinceCode === provinceCode
  );
  return city ? city.code : null;
}

/**
 * 根据区县名称和城市代码获取区县代码
 */
export function getDistrictCodeByName(
  districtName: string,
  cityCode: string
): string | null {
  const district = areas.find(
    a => a.name === districtName && a.cityCode === cityCode
  );
  return district ? district.code : null;
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
 * 解析地址字符串为地址对象（智能解析）
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

  // 简单的解析逻辑，可以根据实际需求优化
  // 这里先返回基本结构，详细地址放在detail中
  return {
    province: '',
    city: '',
    district: '',
    detail: addressString,
  };
}

/**
 * 搜索地址（支持模糊匹配）
 */
export function searchAddress(keyword: string): AddressSearchResult[] {
  if (!keyword || keyword.length < 2) {
    return [];
  }

  const results: AddressSearchResult[] = [];
  const lowerKeyword = keyword.toLowerCase();

  // 搜索省份
  provinces.forEach(province => {
    if (province.name.toLowerCase().includes(lowerKeyword)) {
      results.push({
        province: {
          code: province.code,
          name: province.name,
          type: 'province',
        },
        fullPath: province.name,
        score: calculateScore(province.name, keyword),
      });
    }
  });

  // 搜索城市
  cities.forEach(city => {
    if (city.name.toLowerCase().includes(lowerKeyword)) {
      const province = provinces.find(p => p.code === city.provinceCode);
      if (province) {
        results.push({
          province: {
            code: province.code,
            name: province.name,
            type: 'province',
          },
          city: {
            code: city.code,
            name: city.name,
            type: 'city',
            provinceCode: city.provinceCode,
            parentCode: city.provinceCode,
          },
          fullPath: `${province.name} ${city.name}`,
          score: calculateScore(city.name, keyword),
        });
      }
    }
  });

  // 搜索区县
  areas.forEach(area => {
    if (area.name.toLowerCase().includes(lowerKeyword)) {
      const city = cities.find(c => c.code === area.cityCode);
      const province = provinces.find(p => p.code === area.provinceCode);

      if (city && province) {
        results.push({
          province: {
            code: province.code,
            name: province.name,
            type: 'province',
          },
          city: {
            code: city.code,
            name: city.name,
            type: 'city',
            provinceCode: city.provinceCode,
            parentCode: city.provinceCode,
          },
          district: {
            code: area.code,
            name: area.name,
            type: 'district',
            cityCode: area.cityCode,
            provinceCode: area.provinceCode,
            parentCode: area.cityCode,
          },
          fullPath: `${province.name} ${city.name} ${area.name}`,
          score: calculateScore(area.name, keyword),
        });
      }
    }
  });

  // 按匹配度排序
  return results.sort((a, b) => b.score - a.score).slice(0, 20);
}

/**
 * 计算匹配度分数
 */
function calculateScore(text: string, keyword: string): number {
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();

  // 完全匹配得分最高
  if (lowerText === lowerKeyword) {return 100;}

  // 开头匹配得分较高
  if (lowerText.startsWith(lowerKeyword)) {return 80;}

  // 包含匹配得分中等
  if (lowerText.includes(lowerKeyword)) {return 60;}

  return 0;
}

/**
 * 验证地址数据的完整性
 */
export function validateAddressData(address: AddressData): boolean {
  if (!address.province || !address.city || !address.district) {
    return false;
  }

  // 验证省份是否存在
  const provinceExists = provinces.some(p => p.name === address.province);
  if (!provinceExists) {return false;}

  // 验证城市是否属于该省份
  const provinceCode = getProvinceCodeByName(address.province);
  if (!provinceCode) {return false;}

  const cityExists = cities.some(
    c => c.name === address.city && c.provinceCode === provinceCode
  );
  if (!cityExists) {return false;}

  // 验证区县是否属于该城市
  const cityCode = getCityCodeByName(address.city, provinceCode);
  if (!cityCode) {return false;}

  const districtExists = areas.some(
    a => a.name === address.district && a.cityCode === cityCode
  );

  return districtExists;
}

/**
 * 获取地址的完整路径
 */
export function getAddressFullPath(address: AddressData): string {
  return formatAddressString(address);
}
