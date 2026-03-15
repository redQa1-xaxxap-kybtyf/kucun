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
import {
  getFieldsForTemplateType,
  groupFields,
} from '@/lib/print-designer/field-registry';
import type { PlaceholderFormat } from '@/lib/print-designer/schemas';

interface DataBindingSectionProps {
  templateType: string;
  field: string;
  format: PlaceholderFormat;
  fallback: string;
  onFieldChange: (field: string, label: string) => void;
  onFormatChange: (format: PlaceholderFormat) => void;
  onFallbackChange: (fallback: string) => void;
}

export function DataBindingSection({
  templateType,
  field,
  format,
  fallback,
  onFieldChange,
  onFormatChange,
  onFallbackChange,
}: DataBindingSectionProps) {
  const [search, setSearch] = useState('');

  const availableFields = useMemo(
    () => getFieldsForTemplateType(templateType),
    [templateType]
  );

  const filteredFields = useMemo(() => {
    if (!search) return availableFields;
    const lower = search.toLowerCase();
    return availableFields.filter(
      f =>
        f.label.toLowerCase().includes(lower) ||
        f.path.toLowerCase().includes(lower)
    );
  }, [availableFields, search]);

  // 按组分类
  const groupedFields = useMemo(() => groupFields(filteredFields), [filteredFields]);

  const currentField = availableFields.find(f => f.path === field);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3">
        <Label className="text-xs font-semibold text-sky-900">数据绑定</Label>
        <p className="mt-1 text-[11px] leading-5 text-sky-800/80">
          先选字段，再决定格式和空值文案，适合中文单据里常见的日期、金额、数量展示。
        </p>
      </div>

      {/* 当前绑定字段 */}
      <div className="rounded-xl border border-sky-200 bg-white p-3 shadow-sm">
        <div className="text-xs text-sky-600">当前字段</div>
        <div className="mt-1 text-sm font-semibold text-slate-900">
          {currentField?.label ?? field}
        </div>
        <div className="mt-1 font-mono text-xs text-slate-500">{field}</div>
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

        <div className="max-h-48 overflow-auto rounded-xl border bg-white">
          {Object.entries(groupedFields).map(([group, fields]) => (
            <div key={group}>
              <div className="sticky top-0 bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-500">
                {group}
              </div>
              {fields.map(f => (
                <button
                  key={f.path}
                  type="button"
                  className={`w-full px-3 py-2 text-left hover:bg-sky-50 ${
                    f.path === field ? 'bg-sky-100 text-sky-700' : ''
                  }`}
                  onClick={() => onFieldChange(f.path, f.label)}
                >
                  <div className="text-sm font-medium">{f.label}</div>
                  <div className="font-mono text-[11px] text-slate-500">{f.path}</div>
                </button>
              ))}
            </div>
          ))}

          {Object.keys(groupedFields).length === 0 && (
            <div className="p-4 text-center text-sm text-slate-500">
              没找到匹配字段，换个中文关键词试试。
            </div>
          )}
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
          placeholder="例如：暂无、--、待补充"
          className="h-8"
        />
      </div>
    </div>
  );
}
