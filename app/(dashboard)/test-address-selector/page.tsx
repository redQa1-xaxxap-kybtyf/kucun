'use client';

import React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';

import { AddressSelector } from '@/components/ui/address-selector';
import type { AddressData } from '@/lib/types/address';

/**
 * 地址选择器测试页面
 * 用于验证地址选择器组件的功能
 */
export default function TestAddressSelectorPage() {
  const [address, setAddress] = React.useState<AddressData>({
    province: '',
    city: '',
    district: '',
    detail: '',
  });

  const [stringAddress, setStringAddress] = React.useState<string>('');

  const handleAddressChange = (newAddress: AddressData | string) => {
    if (typeof newAddress === 'string') {
      setStringAddress(newAddress);
      toast({
        title: '地址更新',
        description: `字符串地址: ${newAddress}`,
      });
    } else {
      setAddress(newAddress);
      toast({
        title: '地址更新',
        description: `对象地址: ${newAddress.province} ${newAddress.city} ${newAddress.district} ${newAddress.detail}`,
      });
    }
  };

  const handleReset = () => {
    setAddress({
      province: '',
      city: '',
      district: '',
      detail: '',
    });
    setStringAddress('');
    toast({
      title: '重置成功',
      description: '地址已重置',
    });
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">地址选择器测试</h1>
        <Button onClick={handleReset} variant="outline">
          重置
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 对象模式测试 */}
        <Card>
          <CardHeader>
            <CardTitle>对象模式测试</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AddressSelector
              value={address}
              onChange={handleAddressChange}
              label="选择地址"
              placeholder="请选择地址"
              required
              description="使用对象格式的地址数据"
            />

            <div className="mt-4 rounded-lg bg-gray-50 p-4">
              <h4 className="mb-2 font-medium">当前地址对象：</h4>
              <pre className="text-sm">{JSON.stringify(address, null, 2)}</pre>
            </div>
          </CardContent>
        </Card>

        {/* 字符串模式测试 */}
        <Card>
          <CardHeader>
            <CardTitle>字符串模式测试</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AddressSelector
              value={stringAddress}
              onChange={handleAddressChange}
              label="选择地址"
              placeholder="请选择地址"
              description="使用字符串格式的地址数据"
            />

            <div className="mt-4 rounded-lg bg-gray-50 p-4">
              <h4 className="mb-2 font-medium">当前地址字符串：</h4>
              <p className="text-sm">{stringAddress || '未选择'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 功能说明 */}
      <Card>
        <CardHeader>
          <CardTitle>功能说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>✅ 使用china-division包提供完整的中国地址数据</p>
            <p>✅ 支持省市区三级联动选择</p>
            <p>✅ 支持对象和字符串两种数据格式</p>
            <p>✅ 响应式设计，适配移动端</p>
            <p>✅ 与shadcn/ui组件库完美集成</p>
            <p>✅ 严格的TypeScript类型安全</p>
            <p>✅ 遵循项目代码质量规范</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
