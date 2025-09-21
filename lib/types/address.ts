/**
 * 地址相关类型定义
 * 严格遵循全栈项目统一约定规范
 */

/**
 * 地址数据结构
 */
export interface AddressData {
  province: string;
  city: string;
  district: string;
  detail?: string;
}

/**
 * 可选地址数据结构
 */
export interface OptionalAddressData {
  province?: string;
  city?: string;
  district?: string;
  detail?: string;
}

/**
 * 地址选项数据结构（用于下拉选择）
 */
export interface AddressOption {
  code: string;
  name: string;
  parentCode?: string;
}

/**
 * 省份数据结构
 */
export interface ProvinceData extends AddressOption {
  type: 'province';
}

/**
 * 城市数据结构
 */
export interface CityData extends AddressOption {
  type: 'city';
  provinceCode: string;
}

/**
 * 区县数据结构
 */
export interface DistrictData extends AddressOption {
  type: 'district';
  cityCode: string;
  provinceCode: string;
}

/**
 * 地址选择器属性接口
 */
export interface AddressSelectorProps {
  value?: AddressData | string;
  onChange?: (value: AddressData) => void;
  disabled?: boolean;
  required?: boolean;
  showSearch?: boolean;
  className?: string;
  showLabel?: boolean;
  label?: string;
  description?: string;
  placeholder?: {
    province?: string;
    city?: string;
    district?: string;
    detail?: string;
  };
}

/**
 * 地址验证结果
 */
export interface AddressValidationResult {
  isValid: boolean;
  errors: string[];
  suggestions?: AddressData[];
}

/**
 * 地址搜索结果
 */
export interface AddressSearchResult {
  province?: ProvinceData;
  city?: CityData;
  district?: DistrictData;
  fullPath: string;
  score: number;
}
