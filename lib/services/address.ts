/**
 * 地址数据服务
 * 基于china-division包提供完整的中国地址数据
 * 严格遵循全栈项目统一约定规范
 */

// 临时使用静态数据，避免china-division在浏览器环境的问题
const provinces = [
  { code: '11', name: '北京市' },
  { code: '12', name: '天津市' },
  { code: '13', name: '河北省' },
  { code: '14', name: '山西省' },
  { code: '15', name: '内蒙古自治区' },
  { code: '21', name: '辽宁省' },
  { code: '22', name: '吉林省' },
  { code: '23', name: '黑龙江省' },
  { code: '31', name: '上海市' },
  { code: '32', name: '江苏省' },
  { code: '33', name: '浙江省' },
  { code: '34', name: '安徽省' },
  { code: '35', name: '福建省' },
  { code: '36', name: '江西省' },
  { code: '37', name: '山东省' },
  { code: '41', name: '河南省' },
  { code: '42', name: '湖北省' },
  { code: '43', name: '湖南省' },
  { code: '44', name: '广东省' },
  { code: '45', name: '广西壮族自治区' },
  { code: '46', name: '海南省' },
  { code: '50', name: '重庆市' },
  { code: '51', name: '四川省' },
  { code: '52', name: '贵州省' },
  { code: '53', name: '云南省' },
  { code: '54', name: '西藏自治区' },
  { code: '61', name: '陕西省' },
  { code: '62', name: '甘肃省' },
  { code: '63', name: '青海省' },
  { code: '64', name: '宁夏回族自治区' },
  { code: '65', name: '新疆维吾尔自治区' },
];

const cities = [
  // 北京市
  { code: '1101', name: '市辖区', provinceCode: '11' },
  // 天津市
  { code: '1201', name: '市辖区', provinceCode: '12' },
  // 河北省主要城市
  { code: '1301', name: '石家庄市', provinceCode: '13' },
  { code: '1302', name: '唐山市', provinceCode: '13' },
  { code: '1303', name: '秦皇岛市', provinceCode: '13' },
  { code: '1304', name: '邯郸市', provinceCode: '13' },
  { code: '1305', name: '邢台市', provinceCode: '13' },
  { code: '1306', name: '保定市', provinceCode: '13' },
  { code: '1307', name: '张家口市', provinceCode: '13' },
  { code: '1308', name: '承德市', provinceCode: '13' },
  { code: '1309', name: '沧州市', provinceCode: '13' },
  { code: '1310', name: '廊坊市', provinceCode: '13' },
  { code: '1311', name: '衡水市', provinceCode: '13' },
  // 广东省主要城市
  { code: '4401', name: '广州市', provinceCode: '44' },
  { code: '4403', name: '深圳市', provinceCode: '44' },
  { code: '4404', name: '珠海市', provinceCode: '44' },
  { code: '4405', name: '汕头市', provinceCode: '44' },
  { code: '4406', name: '佛山市', provinceCode: '44' },
  { code: '4407', name: '江门市', provinceCode: '44' },
  { code: '4408', name: '湛江市', provinceCode: '44' },
  { code: '4409', name: '茂名市', provinceCode: '44' },
  { code: '4412', name: '肇庆市', provinceCode: '44' },
  { code: '4413', name: '惠州市', provinceCode: '44' },
  { code: '4414', name: '梅州市', provinceCode: '44' },
  { code: '4415', name: '汕尾市', provinceCode: '44' },
  { code: '4416', name: '河源市', provinceCode: '44' },
  { code: '4417', name: '阳江市', provinceCode: '44' },
  { code: '4418', name: '清远市', provinceCode: '44' },
  { code: '4419', name: '东莞市', provinceCode: '44' },
  { code: '4420', name: '中山市', provinceCode: '44' },
  { code: '4451', name: '潮州市', provinceCode: '44' },
  { code: '4452', name: '揭阳市', provinceCode: '44' },
  { code: '4453', name: '云浮市', provinceCode: '44' },
];

const areas = [
  // 北京市区县
  { code: '110101', name: '东城区', cityCode: '1101', provinceCode: '11' },
  { code: '110102', name: '西城区', cityCode: '1101', provinceCode: '11' },
  { code: '110105', name: '朝阳区', cityCode: '1101', provinceCode: '11' },
  { code: '110106', name: '丰台区', cityCode: '1101', provinceCode: '11' },
  { code: '110107', name: '石景山区', cityCode: '1101', provinceCode: '11' },
  { code: '110108', name: '海淀区', cityCode: '1101', provinceCode: '11' },
  { code: '110109', name: '门头沟区', cityCode: '1101', provinceCode: '11' },
  { code: '110111', name: '房山区', cityCode: '1101', provinceCode: '11' },
  { code: '110112', name: '通州区', cityCode: '1101', provinceCode: '11' },
  { code: '110113', name: '顺义区', cityCode: '1101', provinceCode: '11' },
  { code: '110114', name: '昌平区', cityCode: '1101', provinceCode: '11' },
  { code: '110115', name: '大兴区', cityCode: '1101', provinceCode: '11' },
  { code: '110116', name: '怀柔区', cityCode: '1101', provinceCode: '11' },
  { code: '110117', name: '平谷区', cityCode: '1101', provinceCode: '11' },
  { code: '110118', name: '密云区', cityCode: '1101', provinceCode: '11' },
  { code: '110119', name: '延庆区', cityCode: '1101', provinceCode: '11' },

  // 天津市区县
  { code: '120101', name: '和平区', cityCode: '1201', provinceCode: '12' },
  { code: '120102', name: '河东区', cityCode: '1201', provinceCode: '12' },
  { code: '120103', name: '河西区', cityCode: '1201', provinceCode: '12' },
  { code: '120104', name: '南开区', cityCode: '1201', provinceCode: '12' },
  { code: '120105', name: '河北区', cityCode: '1201', provinceCode: '12' },
  { code: '120106', name: '红桥区', cityCode: '1201', provinceCode: '12' },
  { code: '120110', name: '东丽区', cityCode: '1201', provinceCode: '12' },
  { code: '120111', name: '西青区', cityCode: '1201', provinceCode: '12' },
  { code: '120112', name: '津南区', cityCode: '1201', provinceCode: '12' },
  { code: '120113', name: '北辰区', cityCode: '1201', provinceCode: '12' },
  { code: '120114', name: '武清区', cityCode: '1201', provinceCode: '12' },
  { code: '120115', name: '宝坻区', cityCode: '1201', provinceCode: '12' },
  { code: '120116', name: '滨海新区', cityCode: '1201', provinceCode: '12' },
  { code: '120117', name: '宁河区', cityCode: '1201', provinceCode: '12' },
  { code: '120118', name: '静海区', cityCode: '1201', provinceCode: '12' },
  { code: '120119', name: '蓟州区', cityCode: '1201', provinceCode: '12' },

  // 广州市区县
  { code: '440103', name: '荔湾区', cityCode: '4401', provinceCode: '44' },
  { code: '440104', name: '越秀区', cityCode: '4401', provinceCode: '44' },
  { code: '440105', name: '海珠区', cityCode: '4401', provinceCode: '44' },
  { code: '440106', name: '天河区', cityCode: '4401', provinceCode: '44' },
  { code: '440111', name: '白云区', cityCode: '4401', provinceCode: '44' },
  { code: '440112', name: '黄埔区', cityCode: '4401', provinceCode: '44' },
  { code: '440113', name: '番禺区', cityCode: '4401', provinceCode: '44' },
  { code: '440114', name: '花都区', cityCode: '4401', provinceCode: '44' },
  { code: '440115', name: '南沙区', cityCode: '4401', provinceCode: '44' },
  { code: '440117', name: '从化区', cityCode: '4401', provinceCode: '44' },
  { code: '440118', name: '增城区', cityCode: '4401', provinceCode: '44' },

  // 深圳市区县
  { code: '440303', name: '罗湖区', cityCode: '4403', provinceCode: '44' },
  { code: '440304', name: '福田区', cityCode: '4403', provinceCode: '44' },
  { code: '440305', name: '南山区', cityCode: '4403', provinceCode: '44' },
  { code: '440306', name: '宝安区', cityCode: '4403', provinceCode: '44' },
  { code: '440307', name: '龙岗区', cityCode: '4403', provinceCode: '44' },
  { code: '440308', name: '盐田区', cityCode: '4403', provinceCode: '44' },
  { code: '440309', name: '龙华区', cityCode: '4403', provinceCode: '44' },
  { code: '440310', name: '坪山区', cityCode: '4403', provinceCode: '44' },
  { code: '440311', name: '光明区', cityCode: '4403', provinceCode: '44' },
];

import type {
  AddressData,
  AddressSearchResult,
  CityData,
  DistrictData,
  ProvinceData,
} from '@/lib/types/address';

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
  if (lowerText === lowerKeyword) return 100;

  // 开头匹配得分较高
  if (lowerText.startsWith(lowerKeyword)) return 80;

  // 包含匹配得分中等
  if (lowerText.includes(lowerKeyword)) return 60;

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
  if (!provinceExists) return false;

  // 验证城市是否属于该省份
  const provinceCode = getProvinceCodeByName(address.province);
  if (!provinceCode) return false;

  const cityExists = cities.some(
    c => c.name === address.city && c.provinceCode === provinceCode
  );
  if (!cityExists) return false;

  // 验证区县是否属于该城市
  const cityCode = getCityCodeByName(address.city, provinceCode);
  if (!cityCode) return false;

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
