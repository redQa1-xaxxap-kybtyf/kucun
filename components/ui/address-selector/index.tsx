'use client';

import * as React from 'react';

import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  getCitiesByProvince,
  getDistrictsByCity,
  getProvinces,
  parseAddressString,
} from '@/lib/services/address-client';
import type { AddressData, AddressSelectorProps } from '@/lib/types/address';
import { cn } from '@/lib/utils';

import { AddressSelectorContent } from './content';

/**
 * 地址选择器组件
 * 支持省市区三级联动选择和详细地址输入
 * 严格遵循全栈项目统一约定规范
 */
export const AddressSelector = React.forwardRef<
  HTMLDivElement,
  AddressSelectorProps
>(
  (
    {
      value,
      onChange,
      disabled = false,
      className,
      showLabel = true,
      label = '地址',
      description,
      required = false,
    },
    ref
  ) => {
    // 解析当前值
    const currentAddress = React.useMemo(() => {
      if (!value) {
        return { province: '', city: '', district: '', detail: '' };
      }
      if (typeof value === 'string') {
        return parseAddressString(value);
      }
      return value;
    }, [value]);

    // 状态管理
    const [provinces, setProvinces] = React.useState<any[]>([]);
    const [availableCities, setAvailableCities] = React.useState<any[]>([]);
    const [availableDistricts, setAvailableDistricts] = React.useState<any[]>(
      []
    );
    const [loading, setLoading] = React.useState(true);

    // 获取所有省份列表
    React.useEffect(() => {
      const loadProvinces = async () => {
        try {
          const data = await getProvinces();
          setProvinces(data);
        } catch (error) {
          console.error('加载省份数据失败:', error);
        } finally {
          setLoading(false);
        }
      };
      loadProvinces();
    }, []);

    // 获取可用的城市列表
    React.useEffect(() => {
      const loadCities = async () => {
        if (!currentAddress.province) {
          setAvailableCities([]);
          return;
        }

        try {
          const province = provinces.find(
            p => p.name === currentAddress.province
          );
          if (province) {
            const cities = await getCitiesByProvince(province.code);
            setAvailableCities(cities);
          } else {
            setAvailableCities([]);
          }
        } catch (error) {
          console.error('加载城市数据失败:', error);
          setAvailableCities([]);
        }
      };

      loadCities();
    }, [currentAddress.province, provinces]);

    // 获取可用的区县列表
    React.useEffect(() => {
      const loadDistricts = async () => {
        if (!currentAddress.city) {
          setAvailableDistricts([]);
          return;
        }

        try {
          const city = availableCities.find(
            c => c.name === currentAddress.city
          );
          if (city) {
            const districts = await getDistrictsByCity(city.code);
            setAvailableDistricts(districts);
          } else {
            setAvailableDistricts([]);
          }
        } catch (error) {
          console.error('加载区县数据失败:', error);
          setAvailableDistricts([]);
        }
      };

      loadDistricts();
    }, [currentAddress.city, availableCities]);

    // 处理地址变更
    const handleAddressChange = React.useCallback(
      (field: keyof AddressData, newValue: string) => {
        const newAddress = { ...currentAddress, [field]: newValue };

        // 如果改变了省份，清空城市和区县
        if (field === 'province') {
          newAddress.city = '';
          newAddress.district = '';
        }

        // 如果改变了城市，清空区县
        if (field === 'city') {
          newAddress.district = '';
        }

        onChange?.(newAddress);
      },
      [currentAddress, onChange]
    );

    const content = (
      <div className={cn('space-y-4', className)} ref={ref}>
        {loading ? (
          <div className="text-sm text-muted-foreground">
            正在加载地址数据...
          </div>
        ) : (
          <AddressSelectorContent
            currentAddress={currentAddress}
            provinces={provinces}
            availableCities={availableCities}
            availableDistricts={availableDistricts}
            handleAddressChange={handleAddressChange}
            disabled={disabled || loading}
          />
        )}
      </div>
    );

    // 如果不显示标签，直接返回内容
    if (!showLabel) {
      return content;
    }

    // 包装在FormItem中
    return (
      <FormItem>
        <FormLabel>
          {label}
          {required && <span className="ml-1 text-destructive">*</span>}
        </FormLabel>
        <FormControl>{content}</FormControl>
        {description && <FormDescription>{description}</FormDescription>}
        <FormMessage />
      </FormItem>
    );
  }
);

AddressSelector.displayName = 'AddressSelector';
