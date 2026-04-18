/**
 * 打印设计器 - 字段选择器
 *
 * 带搜索的字段下拉选择器
 */

'use client';

import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  filterFieldsByQuickFilter,
  getFieldQuickFilterOptions,
} from '@/lib/print-designer/field-quick-filters';
import {
  type FieldDefinition,
  getFieldsForTemplateType,
  getRecommendedFieldsForTemplateType,
  getTableFieldsForTemplateType,
  groupFields,
  matchesFieldSearch,
} from '@/lib/print-designer/field-registry';
import { cn } from '@/lib/utils';

interface FieldPickerProps {
  templateType: string;
  scope?: 'template' | 'table';
  currentField?: string;
  onSelect: (field: FieldDefinition) => void;
  children: React.ReactNode;
}

export function FieldPicker({
  templateType,
  scope = 'template',
  currentField,
  onSelect,
  children,
}: FieldPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState('all');

  const fields = useMemo(
    () =>
      scope === 'table'
        ? getTableFieldsForTemplateType(templateType)
        : getFieldsForTemplateType(templateType),
    [scope, templateType]
  );
  const quickFilterOptions = useMemo(
    () => getFieldQuickFilterOptions(fields, scope),
    [fields, scope]
  );
  const quickFilteredFields = useMemo(
    () => filterFieldsByQuickFilter(fields, templateType, scope, quickFilter),
    [fields, quickFilter, scope, templateType]
  );

  const filteredFields = useMemo(() => {
    if (!search) return quickFilteredFields;
    return quickFilteredFields.filter(f => matchesFieldSearch(f, search));
  }, [quickFilteredFields, search]);
  const recommendedFields = useMemo(
    () => getRecommendedFieldsForTemplateType(templateType, scope).slice(0, 6),
    [scope, templateType]
  );
  const visibleRecommendedFields = useMemo(
    () =>
      recommendedFields.filter(recommendedField =>
        filterFieldsByQuickFilter(
          [recommendedField],
          templateType,
          scope,
          quickFilter
        ).some(field => field.path === recommendedField.path)
      ),
    [quickFilter, recommendedFields, scope, templateType]
  );

  const groupedFields = useMemo(
    () => groupFields(filteredFields),
    [filteredFields]
  );

  const handleSelect = (field: FieldDefinition) => {
    onSelect(field);
    setOpen(false);
    setSearch('');
    setQuickFilter('all');
  };

  return (
    <Popover
      open={open}
      onOpenChange={nextOpen => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setSearch('');
          setQuickFilter('all');
        }
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索数据项、单号、客户..."
              className="h-8 pl-8"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {quickFilterOptions.map(option => (
              <button
                key={option.key}
                type="button"
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] leading-4 transition-colors',
                  quickFilter === option.key
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                )}
                onClick={() => setQuickFilter(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-72 overflow-auto">
          {!search && visibleRecommendedFields.length > 0 && (
            <div>
              <div className="sticky top-0 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600">
                常用数据项
              </div>
              {visibleRecommendedFields.map(field => (
                <button
                  key={`recommended-${field.path}`}
                  type="button"
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-blue-50 ${
                    field.path === currentField
                      ? 'bg-blue-100 text-blue-700'
                      : ''
                  }`}
                  onClick={() => handleSelect(field)}
                >
                  <span>{field.label}</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {field.path}
                  </span>
                </button>
              ))}
            </div>
          )}

          {Object.entries(groupedFields).map(([group, groupFields]) => (
            <div key={group}>
              <div className="sticky top-0 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
                {group}
              </div>
              {groupFields.map(f => (
                <button
                  key={f.path}
                  type="button"
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-blue-50 ${
                    f.path === currentField ? 'bg-blue-100 text-blue-700' : ''
                  }`}
                  onClick={() => handleSelect(f)}
                >
                  <span>{f.label}</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {f.path}
                  </span>
                </button>
              ))}
            </div>
          ))}

          {Object.keys(groupedFields).length === 0 && (
            <div className="text-muted-foreground p-4 text-center text-sm">
              当前分类下没有匹配字段，换个分类或搜中文关键词试试。
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
