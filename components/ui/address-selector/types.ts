// 地址数据结构
export interface AddressData {
  province: string;
  city: string;
  district: string;
  detail: string;
}

// 可选地址数据结构
export interface OptionalAddressData {
  province?: string;
  city?: string;
  district?: string;
  detail?: string;
}

// 地址选择器属性
export interface AddressSelectorProps {
  value?: AddressData | string;
  onChange?: (value: AddressData) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showLabel?: boolean;
  label?: string;
  description?: string;
  required?: boolean;
}
