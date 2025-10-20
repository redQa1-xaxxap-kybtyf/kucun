'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Supplier {
  id: string;
  name: string;
  phone?: string;
  contactPerson?: string;
}

interface SupplierSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * 供应商选择器组件
 * 提供搜索和选择供应商的功能
 */
export function SupplierSelector({
  value,
  onValueChange,
  disabled = false,
  placeholder = '选择供应商...',
  className,
}: SupplierSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const cacheRef = React.useRef<Map<string, Supplier[]>>(new Map());

  // 获取供应商列表
  React.useEffect(() => {
    const fetchSuppliers = async () => {
      const normalizedSearch = searchValue.trim().toLowerCase();

      if (cacheRef.current.has(normalizedSearch)) {
        setSuppliers(cacheRef.current.get(normalizedSearch) ?? []);
        setError(null);
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/suppliers?status=active&limit=100${
            normalizedSearch
              ? `&search=${encodeURIComponent(normalizedSearch)}`
              : ''
          }`,
          {
            credentials: 'include',
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error('获取供应商列表失败');
        }

        const result = await response.json();
        if (result.success && result.data) {
          setSuppliers(result.data);
          cacheRef.current.set(normalizedSearch, result.data);
          setError(null);
        } else {
          throw new Error(result.error || '获取供应商列表失败');
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error('获取供应商列表失败:', error);
        setError('获取供应商列表失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchSuppliers();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [open, searchValue]);

  const selectedSupplier = suppliers.find(s => s.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between', className)}
          disabled={disabled}
        >
          {selectedSupplier ? (
            <span className="truncate">{selectedSupplier.name}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="搜索供应商名称..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {error ? (
              <div className="text-destructive py-6 text-center text-sm">
                {error}
              </div>
            ) : loading ? (
              <div className="py-6 text-center text-sm">加载中...</div>
            ) : (
              <>
                <CommandEmpty>未找到相关供应商</CommandEmpty>
                <CommandGroup>
                  {suppliers.map(supplier => (
                    <CommandItem
                      key={supplier.id}
                      value={supplier.id}
                      onSelect={currentValue => {
                        onValueChange(
                          currentValue === value ? '' : currentValue
                        );
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === supplier.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="flex flex-1 flex-col">
                        <span className="font-medium">{supplier.name}</span>
                        {(supplier.contactPerson || supplier.phone) && (
                          <span className="text-muted-foreground text-xs">
                            {supplier.contactPerson &&
                              `联系人：${supplier.contactPerson}`}
                            {supplier.contactPerson && supplier.phone && ' | '}
                            {supplier.phone && `电话：${supplier.phone}`}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
