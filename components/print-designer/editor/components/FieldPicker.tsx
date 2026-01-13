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
    type FieldDefinition,
    getFieldsForTemplateType,
    getTableFieldsForTemplateType,
    groupFields,
} from '@/lib/print-designer/field-registry';

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

  const fields = useMemo(
    () =>
      scope === 'table'
        ? getTableFieldsForTemplateType(templateType)
        : getFieldsForTemplateType(templateType),
    [scope, templateType]
  );

  const filteredFields = useMemo(() => {
    if (!search) return fields;
    const lower = search.toLowerCase();
    return fields.filter(
      (f) =>
        f.label.toLowerCase().includes(lower) ||
        f.path.toLowerCase().includes(lower)
    );
  }, [fields, search]);

  const groupedFields = useMemo(
    () => groupFields(filteredFields),
    [filteredFields]
  );

  const handleSelect = (field: FieldDefinition) => {
    onSelect(field);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索字段..."
              className="h-8 pl-8"
            />
          </div>
        </div>

        <div className="max-h-64 overflow-auto">
          {Object.entries(groupedFields).map(([group, groupFields]) => (
            <div key={group}>
              <div className="sticky top-0 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
                {group}
              </div>
              {groupFields.map((f) => (
                <button
                  key={f.path}
                  type="button"
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-blue-50 ${
                    f.path === currentField ? 'bg-blue-100 text-blue-700' : ''
                  }`}
                  onClick={() => handleSelect(f)}
                >
                  <span>{f.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {f.path}
                  </span>
                </button>
              ))}
            </div>
          ))}

          {Object.keys(groupedFields).length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              未找到匹配的字段
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
