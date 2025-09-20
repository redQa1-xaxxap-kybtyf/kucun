import { MapPin } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { PROVINCES } from './data';
import type { AddressData } from './types';
import { formatAddressString } from './utils';

interface AddressSelectorContentProps {
  currentAddress: AddressData;
  availableCities: string[];
  availableDistricts: string[];
  handleAddressChange: (field: keyof AddressData, value: string) => void;
  disabled: boolean;
}

/**
 * 地址选择器内容组件
 * 包含省市区三级联动选择和详细地址输入
 */
export const AddressSelectorContent = ({
  currentAddress,
  availableCities,
  availableDistricts,
  handleAddressChange,
  disabled,
}: AddressSelectorContentProps) => (
  <div className="space-y-4">
    {/* 省市区选择 */}
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* 省份选择 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">省份</label>
        <Select
          value={currentAddress.province}
          onValueChange={value => handleAddressChange('province', value)}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="选择省份" />
          </SelectTrigger>
          <SelectContent>
            {PROVINCES.map(province => (
              <SelectItem key={province} value={province}>
                {province}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 城市选择 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">城市</label>
        <Select
          value={currentAddress.city}
          onValueChange={value => handleAddressChange('city', value)}
          disabled={disabled || !currentAddress.province}
        >
          <SelectTrigger>
            <SelectValue placeholder="选择城市" />
          </SelectTrigger>
          <SelectContent>
            {availableCities.map(city => (
              <SelectItem key={city} value={city}>
                {city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 区县选择 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">区县</label>
        <Select
          value={currentAddress.district}
          onValueChange={value => handleAddressChange('district', value)}
          disabled={disabled || !currentAddress.city}
        >
          <SelectTrigger>
            <SelectValue placeholder="选择区县" />
          </SelectTrigger>
          <SelectContent>
            {availableDistricts.map(district => (
              <SelectItem key={district} value={district}>
                {district}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>

    {/* 详细地址输入 */}
    <div className="space-y-2">
      <label className="text-sm font-medium">详细地址</label>
      <Textarea
        value={currentAddress.detail}
        onChange={e => handleAddressChange('detail', e.target.value)}
        placeholder="请输入详细地址（街道、门牌号等）"
        disabled={disabled}
        rows={3}
        className="resize-none"
      />
    </div>

    {/* 地址预览 */}
    {(currentAddress.province ||
      currentAddress.city ||
      currentAddress.district ||
      currentAddress.detail) && (
      <div className="rounded-md bg-muted p-3">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">完整地址：</span>
          <span>{formatAddressString(currentAddress)}</span>
        </div>
      </div>
    )}
  </div>
);
