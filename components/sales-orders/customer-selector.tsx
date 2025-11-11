'use client';
/* eslint-disable max-lines-per-function */

import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Plus, Search, User } from 'lucide-react';
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
import {
  customerQueryKeys,
  searchCustomersLightweight,
} from '@/lib/api/customers';
import type { Customer, CustomerExtendedInfo } from '@/lib/types/customer';
import { cn } from '@/lib/utils';
import {
  chineseToPinyinInitialsUppercase,
  chineseToPinyinUppercase,
} from '@/lib/utils/pinyin';

import { CustomerCreateDialog } from './customer-create-dialog';

interface CustomerSelectorProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onCustomerCreated?: (customer: Customer) => void;
  onCustomerResolved?: (customer: Customer | undefined) => void;
  // 可选：初始客户列表（用于显示已选客户）
  initialCustomer?: Pick<Customer, 'id' | 'name' | 'phone' | 'address'>;
  onBlur?: () => void;
}

/**
 * 可搜索的客户选择器组件
 * 支持按客户名称和手机号码进行模糊搜索
 */
function extractCustomerEmail(customer: Customer): string | undefined {
  if (!customer.extendedInfo) {
    return undefined;
  }

  try {
    const info = JSON.parse(customer.extendedInfo) as CustomerExtendedInfo;
    return typeof info.email === 'string' && info.email.trim().length > 0
      ? info.email.trim()
      : undefined;
  } catch {
    return undefined;
  }
}

export function CustomerSelector({
  value,
  onValueChange,
  placeholder = '搜索并选择客户',
  disabled = false,
  className,
  onCustomerCreated,
  onCustomerResolved,
  initialCustomer,
  onBlur,
}: CustomerSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [selectedCustomer, setSelectedCustomer] = React.useState<
    Customer | undefined
  >(initialCustomer);

  const notifyBlur = React.useCallback(() => {
    if (!onBlur) {
      return;
    }

    const handleError = (error: unknown) => {
      if (error instanceof ZodError) {
        // 表单校验失败时，react-hook-form 会抛出 ZodError，这里吞掉避免打断交互
        return;
      }
      console.error('customer-selector:onBlur failed', error);
    };

    try {
      const result = onBlur();
      if (result && typeof (result as Promise<unknown>).catch === 'function') {
        (result as Promise<unknown>).catch(handleError);
      }
    } catch (error) {
      handleError(error);
    }
  }, [onBlur]);

  // 防抖搜索：用户停止输入 300ms 后才发起搜索
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue]);

  const normalizedSearch = debouncedSearch.trim().toLowerCase();
  // 允许1个字符开始搜索，支持中文单字搜索（如"张"、"李"等）
  const shouldSearch = normalizedSearch.length >= 1;

  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: customerQueryKeys.search(normalizedSearch || '', { limit: 20 }),
    queryFn: () => searchCustomersLightweight(normalizedSearch, { limit: 20 }),
    enabled: shouldSearch && open,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });

  // 客户列表：搜索结果或空数组（使用 useMemo 避免重复渲染）
  const customers = React.useMemo(() => searchResults ?? [], [searchResults]);

  // 前端拼音过滤（增强搜索体验）
  const filteredCustomers = React.useMemo(() => {
    if (!shouldSearch) {
      return [];
    }

    const collapseSpaces = (value: string) => value.replace(/\s+/g, '');
    const normalized = collapseSpaces(normalizedSearch);

    // 服务端已经做了基础搜索，这里只做拼音增强
    return customers.filter((customer: Customer) => {
      const name = customer.name ?? '';
      const nameLower = name.toLowerCase();

      // 基础匹配（服务端已处理）
      if (
        nameLower.includes(normalizedSearch) ||
        (customer.phone && customer.phone.includes(normalizedSearch)) ||
        (customer.address &&
          customer.address.toLowerCase().includes(normalizedSearch))
      ) {
        return true;
      }

      // 拼音匹配（前端增强）
      const pinyinFull = collapseSpaces(
        chineseToPinyinUppercase(name).toLowerCase()
      );
      if (pinyinFull && pinyinFull.includes(normalized)) {
        return true;
      }

      const pinyinInitials = collapseSpaces(
        chineseToPinyinInitialsUppercase(name).toLowerCase()
      );
      if (pinyinInitials && pinyinInitials.includes(normalized)) {
        return true;
      }

      return false;
    });
  }, [customers, normalizedSearch, shouldSearch]);

  // 处理客户选择
  const handleSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    onCustomerResolved?.(customer);
    onValueChange?.(customer.id);
    setOpen(false);
    notifyBlur();
  };

  // 处理新增客户
  const handleCreateCustomer = () => {
    setCreateDialogOpen(true);
    setOpen(false);
    notifyBlur();
  };

  // 处理客户创建成功
  const handleCustomerCreated = (customer: Customer) => {
    // 更新选中的客户
    setSelectedCustomer(customer);

    // 通知父组件
    onCustomerCreated?.(customer);
    onCustomerResolved?.(customer);

    // 自动选择新创建的客户
    onValueChange?.(customer.id);

    // 关闭创建对话框
    setCreateDialogOpen(false);
    notifyBlur();
  };

  // 当 value 变化时，更新 selectedCustomer
  React.useEffect(() => {
    if (initialCustomer && initialCustomer.id !== selectedCustomer?.id) {
      setSelectedCustomer(initialCustomer);
      onCustomerResolved?.(initialCustomer);
    }
  }, [initialCustomer, onCustomerResolved, selectedCustomer?.id]);

  React.useEffect(() => {
    if (!value) {
      if (selectedCustomer) {
        setSelectedCustomer(undefined);
      }
      onCustomerResolved?.(undefined);
      return;
    }

    const matched = customers.find(
      (customer: Customer) => customer.id === value
    );
    if (!matched) {
      return;
    }

    const hasChanged =
      !selectedCustomer ||
      matched.id !== selectedCustomer.id ||
      matched.address !== selectedCustomer.address ||
      matched.phone !== selectedCustomer.phone ||
      matched.name !== selectedCustomer.name;

    if (hasChanged) {
      setSelectedCustomer(matched);
      onCustomerResolved?.(matched);
    }
  }, [value, customers, onCustomerResolved, selectedCustomer]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      notifyBlur();
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn('h-12 w-full justify-between', className)}
            disabled={disabled}
          >
            {selectedCustomer ? (
              <div className="flex items-center gap-2 truncate">
                <User className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="truncate font-medium">
                  {selectedCustomer.name}
                  {selectedCustomer.phone && (
                    <span className="text-muted-foreground ml-2 font-normal">
                      {selectedCustomer.phone}
                    </span>
                  )}
                </span>
              </div>
            ) : (
              <div className="text-muted-foreground flex items-center gap-2">
                <Search className="h-4 w-4" />
                {placeholder}
              </div>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="搜索客户名称或手机号..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>
                {isSearching ? (
                  <div className="py-6 text-center">
                    <div className="text-muted-foreground text-sm">
                      搜索中...
                    </div>
                  </div>
                ) : !shouldSearch ? (
                  <div className="py-6 text-center">
                    <div className="text-muted-foreground mb-3 text-sm">
                      输入关键词开始搜索客户
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCreateCustomer}
                      className="h-8"
                    >
                      <Plus className="mr-2 h-3 w-3" />
                      新增客户
                    </Button>
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <div className="text-muted-foreground mb-3 text-sm">
                      未找到相关客户，尝试输入其它关键词
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCreateCustomer}
                      className="h-8"
                    >
                      <Plus className="mr-2 h-3 w-3" />
                      新增客户
                    </Button>
                  </div>
                )}
              </CommandEmpty>
              {filteredCustomers.length > 0 && (
                <CommandGroup>
                  {filteredCustomers.map((customer: Customer) => {
                    const customerEmail = extractCustomerEmail(customer);
                    const isSelected = value === customer.id;

                    return (
                      <CommandItem
                        key={customer.id}
                        value={`${customer.name} ${customer.phone || ''} ${customerEmail || ''}`}
                        onSelect={() => handleSelect(customer)}
                        className="flex items-center gap-3 p-3"
                      >
                        <Check
                          className={cn(
                            'h-4 w-4',
                            isSelected ? 'opacity-100' : 'opacity-0'
                          )}
                        />

                        <div className="flex-1 space-y-1">
                          {/* 客户名称 */}
                          <div className="font-medium">{customer.name}</div>

                          {/* 客户电话 */}
                          {customer.phone && (
                            <div className="text-muted-foreground text-xs">
                              {customer.phone}
                            </div>
                          )}

                          {/* 客户邮箱 */}
                          {customerEmail && (
                            <div className="text-muted-foreground text-xs">
                              {customerEmail}
                            </div>
                          )}

                          {/* 客户地址 */}
                          {customer.address && (
                            <div className="text-muted-foreground text-xs">
                              {customer.address}
                            </div>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* 客户创建对话框 */}
      <CustomerCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCustomerCreated={handleCustomerCreated}
        initialName={searchValue}
      />
    </>
  );
}
