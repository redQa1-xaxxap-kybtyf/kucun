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
import type {
  AddressData,
  AddressSelectorProps,
  CityData,
  DistrictData,
  ProvinceData,
} from '@/lib/types/address';
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
    // 内部状态管理 - 维护地址对象
    const [internalAddress, setInternalAddress] = React.useState<AddressData>(
      () => {
        if (!value) {
          return { province: '', city: '', district: '', detail: '' };
        }
        if (typeof value === 'string') {
          return parseAddressString(value);
        }
        return value;
      }
    );

    // 状态管理
    const [provinces, setProvinces] = React.useState<ProvinceData[]>([]);
    const [availableCities, setAvailableCities] = React.useState<CityData[]>(
      []
    );
    const [availableDistricts, setAvailableDistricts] = React.useState<
      DistrictData[]
    >([]);
    const [loading, setLoading] = React.useState(true);

    // 获取所有省份列表
    React.useEffect(() => {
      const loadProvinces = async () => {
        try {
          const data = await getProvinces();
          setProvinces(data);
        } catch (error) {
          // 加载省份数据失败，保持空数组状态
        } finally {
          setLoading(false);
        }
      };
      loadProvinces();
    }, []);

    // 获取可用的城市列表
    React.useEffect(() => {
      const loadCities = async () => {
        if (!internalAddress.province) {
          setAvailableCities([]);
          return;
        }

        try {
          const province = provinces.find(
            p => p.name === internalAddress.province
          );
          if (province) {
            const cities = await getCitiesByProvince(province.code);
            setAvailableCities(cities);
          } else {
            setAvailableCities([]);
          }
        } catch (error) {
          // 加载城市数据失败，保持空数组状态
          setAvailableCities([]);
        }
      };

      loadCities();
    }, [internalAddress.province, provinces]);

    // 获取可用的区县列表
    React.useEffect(() => {
      const loadDistricts = async () => {
        if (!internalAddress.city) {
          setAvailableDistricts([]);
          return;
        }

        try {
          const city = availableCities.find(
            c => c.name === internalAddress.city
          );
          if (city) {
            const districts = await getDistrictsByCity(city.code);
            setAvailableDistricts(districts);
          } else {
            setAvailableDistricts([]);
          }
        } catch (error) {
          // 加载区县数据失败，保持空数组状态
          setAvailableDistricts([]);
        }
      };

      loadDistricts();
    }, [internalAddress.city, availableCities]);

    // 处理地址变更
    const handleAddressChange = React.useCallback(
      (field: keyof AddressData, newValue: string) => {
        const newAddress = { ...internalAddress, [field]: newValue };

        // 如果改变了省份，清空城市和区县
        if (field === 'province') {
          newAddress.city = '';
          newAddress.district = '';
        }

        // 如果改变了城市，清空区县
        if (field === 'city') {
          newAddress.district = '';
        }

        // 更新内部状态
        setInternalAddress(newAddress);

        // 通知父组件
        onChange?.(newAddress);
      },
      [internalAddress, onChange]
    );

    const content = (
      <div className={cn('space-y-4', className)} ref={ref}>
        {loading ? (
          <div className="text-sm text-muted-foreground">
            正在加载地址数据...
          </div>
        ) : (
          <AddressSelectorContent
            currentAddress={internalAddress}
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
