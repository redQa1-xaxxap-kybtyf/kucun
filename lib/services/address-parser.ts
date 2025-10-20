/**
 * 智能地址解析服务
 *
 * 设计原则:
 * - KISS: 简单直接的正则匹配,易于理解和维护
 * - DRY: 统一的解析逻辑,避免重复代码
 * - SOLID: Single Responsibility - 专注于地址字符串解析
 *
 * 功能特性:
 * - 智能识别省/市/区三级行政区划
 * - 支持简称和全称(如"广东"/"广东省")
 * - 处理特殊情况(直辖市、自治区等)
 * - 提取详细地址部分
 * - 容错处理,返回合理默认值
 *
 * 使用场景:
 * - 编辑客户信息时自动填充省市区
 * - 导入地址数据时自动拆分
 * - 地址补全和验证
 */

import { getProvinces } from '@/lib/data/address-static';
import type { AddressData } from '@/lib/types/address';

/**
 * 省份名称模式
 * 支持简称和全称,处理自治区/直辖市等特殊后缀
 */
const PROVINCE_PATTERNS = [
  // 直辖市 - 优先匹配(避免被误识别为普通省份)
  { pattern: /(北京市?|北京)/g, standard: '北京市' },
  { pattern: /(上海市?|上海)/g, standard: '上海市' },
  { pattern: /(天津市?|天津)/g, standard: '天津市' },
  { pattern: /(重庆市?|重庆)/g, standard: '重庆市' },

  // 自治区
  {
    pattern: /(新疆维吾尔自治区|新疆|新疆维吾尔)/g,
    standard: '新疆维吾尔自治区',
  },
  { pattern: /(西藏自治区|西藏)/g, standard: '西藏自治区' },
  { pattern: /(内蒙古自治区|内蒙古|内蒙)/g, standard: '内蒙古自治区' },
  { pattern: /(宁夏回族自治区|宁夏|宁夏回族)/g, standard: '宁夏回族自治区' },
  { pattern: /(广西壮族自治区|广西|广西壮族)/g, standard: '广西壮族自治区' },

  // 普通省份
  { pattern: /(黑龙江省?|黑龙江)/g, standard: '黑龙江省' },
  { pattern: /(吉林省?|吉林)/g, standard: '吉林省' },
  { pattern: /(辽宁省?|辽宁)/g, standard: '辽宁省' },
  { pattern: /(河北省?|河北)/g, standard: '河北省' },
  { pattern: /(河南省?|河南)/g, standard: '河南省' },
  { pattern: /(山西省?|山西)/g, standard: '山西省' },
  { pattern: /(山东省?|山东)/g, standard: '山东省' },
  { pattern: /(江苏省?|江苏)/g, standard: '江苏省' },
  { pattern: /(浙江省?|浙江)/g, standard: '浙江省' },
  { pattern: /(安徽省?|安徽)/g, standard: '安徽省' },
  { pattern: /(江西省?|江西)/g, standard: '江西省' },
  { pattern: /(福建省?|福建)/g, standard: '福建省' },
  { pattern: /(湖北省?|湖北)/g, standard: '湖北省' },
  { pattern: /(湖南省?|湖南)/g, standard: '湖南省' },
  { pattern: /(广东省?|广东)/g, standard: '广东省' },
  { pattern: /(海南省?|海南)/g, standard: '海南省' },
  { pattern: /(四川省?|四川|川)/g, standard: '四川省' },
  { pattern: /(贵州省?|贵州|黔)/g, standard: '贵州省' },
  { pattern: /(云南省?|云南|滇)/g, standard: '云南省' },
  { pattern: /(陕西省?|陕西|陕)/g, standard: '陕西省' },
  { pattern: /(甘肃省?|甘肃|甘)/g, standard: '甘肃省' },
  { pattern: /(青海省?|青海)/g, standard: '青海省' },
] as const;

/**
 * 常见区县关键词
 * 用于识别区县级别
 */
const DISTRICT_KEYWORDS = [
  '区',
  '县',
  '市',
  '旗',
  '自治县',
  '自治旗',
  '特区',
  '林区',
] as const;

/**
 * 解析地址字符串为结构化地址对象
 *
 * @param addressString 完整地址字符串
 * @returns 解析后的地址对象
 *
 * @example
 * parseAddressString("广东省广州市天河区XXX路XXX号")
 * // 返回: { province: "广东省", city: "广州市", district: "天河区", detail: "XXX路XXX号" }
 *
 * parseAddressString("北京市朝阳区XXX路XXX号")
 * // 返回: { province: "北京市", city: "市辖区", district: "朝阳区", detail: "XXX路XXX号" }
 */
export function parseAddressString(addressString: string): AddressData {
  if (!addressString || typeof addressString !== 'string') {
    return createEmptyAddress();
  }

  const trimmed = addressString.trim();
  if (trimmed.length === 0) {
    return createEmptyAddress();
  }

  try {
    // 1. 识别省份
    const provinceResult = extractProvince(trimmed);
    if (!provinceResult.province) {
      // 无法识别省份,返回空结构,detail保存原始地址
      return {
        province: '',
        city: '',
        district: '',
        detail: trimmed,
      };
    }

    // 2. 移除省份后的剩余部分
    const remainingAfterProvince = provinceResult.remaining;

    // 3. 识别城市
    const cityResult = extractCity(
      remainingAfterProvince,
      provinceResult.province
    );

    // 4. 移除城市后的剩余部分
    const remainingAfterCity = cityResult.remaining;

    // 5. 识别区县
    const districtResult = extractDistrict(remainingAfterCity, cityResult.city);

    // 6. 构造完整地址对象
    return {
      province: provinceResult.province,
      city: cityResult.city,
      district: districtResult.district,
      detail: districtResult.remaining.trim(),
    };
  } catch (_error) {
    // 解析失败,返回空结构,detail保存原始地址
    // 错误信息已被捕获,避免影响用户体验
    return {
      province: '',
      city: '',
      district: '',
      detail: trimmed,
    };
  }
}

/**
 * 提取省份信息
 */
function extractProvince(text: string): {
  province: string;
  remaining: string;
} {
  // 遍历所有省份模式进行匹配
  for (const { pattern, standard } of PROVINCE_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[0]) {
      // 找到匹配,返回标准省份名和剩余文本
      const matchedText = match[0];
      const remaining = text.replace(matchedText, '').trim();
      return {
        province: standard,
        remaining,
      };
    }
  }

  // 尝试从实际数据中查找
  const allProvinces = getProvinces();
  for (const prov of allProvinces) {
    // 尝试完整名称匹配
    if (text.includes(prov.name)) {
      const remaining = text.replace(prov.name, '').trim();
      return {
        province: prov.name,
        remaining,
      };
    }

    // 尝试简称匹配(去掉"省"/"市"/"自治区"后缀)
    const shortName = prov.name
      .replace(/省$/, '')
      .replace(/市$/, '')
      .replace(/自治区$/, '')
      .replace(/壮族|回族|维吾尔/, '');

    if (shortName.length >= 2 && text.includes(shortName)) {
      const remaining = text.replace(shortName, '').trim();
      return {
        province: prov.name,
        remaining,
      };
    }
  }

  return {
    province: '',
    remaining: text,
  };
}

/**
 * 提取城市信息
 */
function extractCity(
  text: string,
  province: string
): {
  city: string;
  remaining: string;
} {
  if (!text || text.length === 0) {
    // 直辖市情况,返回"市辖区"
    if (isDirectControlledMunicipality(province)) {
      return {
        city: '市辖区',
        remaining: text,
      };
    }
    return {
      city: '',
      remaining: text,
    };
  }

  // 直辖市特殊处理
  if (isDirectControlledMunicipality(province)) {
    return {
      city: '市辖区',
      remaining: text,
    };
  }

  // 尝试匹配常见城市名称模式
  // 示例: "广州市"、"深圳市"、"成都市"等
  const cityMatch = text.match(/^([^市区县]{2,10})(市|自治州|地区|盟)/);
  if (cityMatch) {
    const cityName = cityMatch[0]; // 包含后缀的完整名称
    const remaining = text.substring(cityName.length).trim();
    return {
      city: cityName,
      remaining,
    };
  }

  // 尝试匹配不带后缀的城市名(但必须后面跟着区县标识符)
  // 例如: "广州天河区" -> city="广州市", remaining="天河区"
  const cityMatchNoSuffixWithDistrict = text.match(
    /^([^市区县]{2,10})([区县市])/
  );
  if (cityMatchNoSuffixWithDistrict) {
    const cityNameNoSuffix = cityMatchNoSuffixWithDistrict[1];
    const potentialCity = `${cityNameNoSuffix}市`;
    const remaining = text.substring(cityNameNoSuffix.length).trim();
    return {
      city: potentialCity,
      remaining,
    };
  }

  return {
    city: '',
    remaining: text,
  };
}

/**
 * 提取区县信息
 */
function extractDistrict(
  text: string,
  _city: string
): {
  district: string;
  remaining: string;
} {
  if (!text || text.length === 0) {
    return {
      district: '',
      remaining: text,
    };
  }

  // 尝试匹配区县模式
  // 示例: "天河区"、"朝阳区"、"番禺区"、"海淀区"等
  for (const keyword of DISTRICT_KEYWORDS) {
    const pattern = new RegExp(`^([^市区县]{2,10})${keyword}`);
    const match = text.match(pattern);
    if (match) {
      const districtName = match[0]; // 包含后缀的完整名称
      const remaining = text.substring(districtName.length).trim();
      return {
        district: districtName,
        remaining,
      };
    }
  }

  // 没有识别到区县,可能直接是详细地址
  return {
    district: '',
    remaining: text,
  };
}

/**
 * 判断是否为直辖市
 */
function isDirectControlledMunicipality(province: string): boolean {
  return ['北京市', '上海市', '天津市', '重庆市'].includes(province);
}

/**
 * 创建空地址对象
 */
function createEmptyAddress(): AddressData {
  return {
    province: '',
    city: '',
    district: '',
    detail: '',
  };
}

/**
 * 验证解析结果的完整性
 * @param address 地址对象
 * @returns 是否包含完整的省市区信息
 */
export function isAddressComplete(address: AddressData): boolean {
  return !!(address.province && address.city && address.district);
}

/**
 * 格式化地址为字符串
 * @param address 地址对象
 * @returns 格式化的地址字符串
 */
export function formatAddressToString(address: AddressData): string {
  const parts = [
    address.province,
    address.city === '市辖区' ? '' : address.city, // 直辖市不显示"市辖区"
    address.district,
    address.detail,
  ].filter(Boolean);

  return parts.join('');
}

/**
 * 补全地址信息
 * 尝试从部分地址信息推断完整地址
 *
 * @param partialAddress 部分地址信息
 * @returns 尽可能补全的地址对象
 */
export function completeAddress(
  partialAddress: Partial<AddressData>
): AddressData {
  const base: AddressData = {
    province: partialAddress.province || '',
    city: partialAddress.city || '',
    district: partialAddress.district || '',
    detail: partialAddress.detail || '',
  };

  // 如果有省份但没有城市,且是直辖市,自动补充"市辖区"
  if (
    base.province &&
    !base.city &&
    isDirectControlledMunicipality(base.province)
  ) {
    base.city = '市辖区';
  }

  return base;
}
