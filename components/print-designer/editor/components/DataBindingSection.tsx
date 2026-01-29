/**
 * 打印设计器 - 数据绑定区域
 */

'use client';

import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PlaceholderFormat } from '@/lib/print-designer/schemas';

// 可绑定字段注册表
const fieldRegistry = [
  { path: 'order.orderNumber', label: '订单编号', group: '订单' },
  { path: 'order.createdAt', label: '订单日期', group: '订单' },
  { path: 'order.status', label: '订单状态', group: '订单' },
  { path: 'order.remark', label: '订单备注', group: '订单' },
  { path: 'customer.name', label: '客户名称', group: '客户' },
  { path: 'customer.phone', label: '客户电话', group: '客户' },
  { path: 'customer.address', label: '客户地址', group: '客户' },
  { path: 'customer.contact', label: '联系人', group: '客户' },
  { path: 'totalAmount', label: '总金额', group: '汇总' },
  { path: 'totalQuantity', label: '总数量', group: '汇总' },
  { path: 'totalWeight', label: '总重量', group: '汇总' },
  { path: 'company.name', label: '公司名称', group: '公司' },
  { path: 'company.phone', label: '公司电话', group: '公司' },
  { path: 'company.address', label: '公司地址', group: '公司' },
];

interface DataBindingSectionProps {
  field: string;
  format: PlaceholderFormat;
  fallback: string;
  onFieldChange: (field: string, label: string) => void;
  onFormatChange: (format: PlaceholderFormat) => void;
  onFallbackChange: (fallback: string) => void;
}

export function DataBindingSection({
  field,
  format,
  fallback,
  onFieldChange,
  onFormatChange,
  onFallbackChange,
}: DataBindingSectionProps) {
  const [search, setSearch] = useState('');

  const filteredFields = useMemo(() => {
    if (!search) return fieldRegistry;
    const lower = search.toLowerCase();
    return fieldRegistry.filter(
      f =>
        f.label.toLowerCase().includes(lower) ||
        f.path.toLowerCase().includes(lower)
    );
  }, [search]);

  // 按组分类
  const groupedFields = useMemo(() => {
    const groups: Record<string, typeof filteredFields> = {};
    filteredFields.forEach(f => {
      if (!groups[f.group]) groups[f.group] = [];
      groups[f.group].push(f);
    });
    return groups;
  }, [filteredFields]);

  const currentField = fieldRegistry.find(f => f.path === field);

  return (
    <div className="space-y-3">
      <Label className="text-muted-foreground text-xs">数据绑定</Label>

      {/* 当前绑定字段 */}
      <div className="rounded-md border bg-blue-50 p-2">
        <div className="text-xs text-blue-600">绑定字段</div>
        <div className="font-mono text-sm text-blue-800">
          {currentField?.label ?? field}
        </div>
        <div className="text-xs text-blue-500">{field}</div>
      </div>

      {/* 字段选择器 */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索字段..."
            className="h-8 pl-8"
          />
        </div>

        <div className="max-h-40 overflow-auto rounded-md border bg-white">
          {Object.entries(groupedFields).map(([group, fields]) => (
            <div key={group}>
              <div className="sticky top-0 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
                {group}
              </div>
              {fields.map(f => (
                <button
                  key={f.path}
                  type="button"
                  className={`w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50 ${
                    f.path === field ? 'bg-blue-100 text-blue-700' : ''
                  }`}
                  onClick={() => onFieldChange(f.path, f.label)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* 格式化 */}
      <div className="space-y-1">
        <Label className="text-xs">格式化</Label>
        <Select value={format} onValueChange={onFormatChange}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">文本</SelectItem>
            <SelectItem value="date_cn">中文日期</SelectItem>
            <SelectItem value="currency">货币</SelectItem>
            <SelectItem value="currency_cap">大写金额</SelectItem>
            <SelectItem value="number">数字</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 空值默认值 */}
      <div className="space-y-1">
        <Label className="text-xs">空值显示</Label>
        <Input
          value={fallback}
          onChange={e => onFallbackChange(e.target.value)}
          placeholder="-"
          className="h-8"
        />
      </div>
    </div>
  );
}
