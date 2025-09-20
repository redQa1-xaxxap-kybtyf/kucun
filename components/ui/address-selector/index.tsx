'use client';

import * as React from 'react';

import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';

import { AddressSelectorContent } from './content';
import { CITIES, DISTRICTS } from './data';
import type { AddressData, AddressSelectorProps } from './types';
import { parseAddressString } from './utils';

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

    // 获取可用的城市列表
    const availableCities = React.useMemo(() => {
      if (!currentAddress.province) return [];
      return CITIES[currentAddress.province] || [];
    }, [currentAddress.province]);

    // 获取可用的区县列表
    const availableDistricts = React.useMemo(() => {
      if (!currentAddress.city) return [];
      return DISTRICTS[currentAddress.city] || [];
    }, [currentAddress.city]);

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
        <AddressSelectorContent
          currentAddress={currentAddress}
          availableCities={availableCities}
          availableDistricts={availableDistricts}
          handleAddressChange={handleAddressChange}
          disabled={disabled}
        />
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
