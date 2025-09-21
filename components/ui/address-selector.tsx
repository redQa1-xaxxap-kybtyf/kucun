// 地址选择器组件 - 统一入口文件
export {
  formatAddressString,
  parseAddressString,
} from '@/lib/services/address-client';
export type {
  AddressData,
  AddressSelectorProps,
  OptionalAddressData,
} from '@/lib/types/address';
export { AddressSelector } from './address-selector/index';
