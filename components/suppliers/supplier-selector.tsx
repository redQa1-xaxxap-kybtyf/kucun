'use client';

import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import dynamic from 'next/dynamic';
import * as React from 'react';
import { ZodError } from 'zod';

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
import type { Supplier as SupplierRecord } from '@/lib/types/supplier';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/utils/console-logger';

const QuickAddSupplierDialog = dynamic(
  () =>
    import('@/components/suppliers/quick-add-supplier-dialog').then(
      mod => mod.QuickAddSupplierDialog
    ),
  { ssr: false, loading: () => null }
);

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
  onBlur?: () => void | Promise<void>; // ✅ 支持同步和异步onBlur
  allowCreate?: boolean;
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
  onBlur,
  allowCreate = false,
}: SupplierSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const cacheRef = React.useRef<Map<string, Supplier[]>>(new Map());

  const notifyBlur = React.useCallback(() => {
    if (!onBlur) {
      return;
    }

    const handleError = (error: unknown) => {
      if (error instanceof ZodError) {
        return;
      }
      logger.error(
        'suppliers:selector',
        'supplier-selector:onBlur failed',
        error
      );
    };

    try {
      // ✅ 调用onBlur,可能返回void或Promise<void>
      const result = onBlur();
      // ✅ 检查是否为Promise,如果是则添加错误处理
      if (
        result !== undefined &&
        typeof (result as Promise<unknown>).catch === 'function'
      ) {
        (result as Promise<unknown>).catch(handleError);
      }
    } catch (error) {
      handleError(error);
    }
  }, [onBlur]);

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
        logger.error('suppliers:selector', '获取供应商列表失败', error, {
          search: normalizedSearch,
        });
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
  const canCreateSupplier = allowCreate && !disabled && !loading && !error;
  const initialSupplierName = searchValue.trim();

  const handleSupplierCreated = React.useCallback(
    (supplier: SupplierRecord) => {
      const nextSupplier: Supplier = {
        id: supplier.id,
        name: supplier.name,
        phone: supplier.phone,
      };

      setSuppliers(current => {
        const exists = current.some(item => item.id === supplier.id);
        return exists
          ? current.map(item =>
              item.id === supplier.id ? { ...item, ...nextSupplier } : item
            )
          : [nextSupplier, ...current];
      });
      cacheRef.current.clear();
      onValueChange(supplier.id);
      setOpen(false);
      notifyBlur();
    },
    [notifyBlur, onValueChange]
  );

  return (
    <>
      <Popover
        open={open}
        onOpenChange={nextOpen => {
          setOpen(nextOpen);
          if (!nextOpen) {
            notifyBlur();
          }
        }}
      >
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
          <Command shouldFilter={false}>
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
                  <CommandEmpty>
                    <div className="flex flex-col items-center gap-2 py-4">
                      <span>未找到相关供应商</span>
                      {canCreateSupplier && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onMouseDown={event => event.preventDefault()}
                          onClick={() => {
                            setOpen(false);
                            setCreateDialogOpen(true);
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          快速新增供应商
                        </Button>
                      )}
                    </div>
                  </CommandEmpty>
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
                          notifyBlur();
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
                              {supplier.contactPerson &&
                                supplier.phone &&
                                ' | '}
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

      {createDialogOpen && (
        <QuickAddSupplierDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSupplierCreated={handleSupplierCreated}
          initialName={initialSupplierName}
        />
      )}
    </>
  );
}
