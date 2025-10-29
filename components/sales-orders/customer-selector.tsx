'use client';
/* eslint-disable max-lines-per-function */

import { Check, ChevronsUpDown, Plus, Search, User } from 'lucide-react';
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
import type { Customer, CustomerExtendedInfo } from '@/lib/types/customer';
import { cn } from '@/lib/utils';
import {
  chineseToPinyinInitialsUppercase,
  chineseToPinyinUppercase,
} from '@/lib/utils/pinyin';

import { CustomerCreateDialog } from './customer-create-dialog';

interface CustomerSelectorProps {
  customers: Customer[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  isLoading?: boolean;
  onCustomerCreated?: (customer: Customer) => void;
  onRefreshCustomers?: () => void;
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
  customers,
  value,
  onValueChange,
  placeholder = '搜索并选择客户',
  disabled = false,
  className,
  isLoading = false,
  onCustomerCreated,
  onRefreshCustomers,
}: CustomerSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const wasOpenRef = React.useRef(false);
  // 保存上一次的搜索关键词，用于重新打开时复用
  const lastSearchValueRef = React.useRef('');

  const selectedCustomer = customers.find(customer => customer.id === value);

  // 过滤客户列表
  const filteredCustomers = React.useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    if (!normalizedSearch) {
      return [];
    }

    const collapseSpaces = (value: string) => value.replace(/\s+/g, '');

    return customers.filter(customer => {
      const name = customer.name ?? '';
      const nameLower = name.toLowerCase();

      if (nameLower.includes(normalizedSearch)) {
        return true;
      }

      if (customer.phone && customer.phone.includes(normalizedSearch)) {
        return true;
      }

      const email = extractCustomerEmail(customer);
      if (email && email.toLowerCase().includes(normalizedSearch)) {
        return true;
      }

      if (
        customer.address &&
        customer.address.toLowerCase().includes(normalizedSearch)
      ) {
        return true;
      }

      const pinyinFull = collapseSpaces(
        chineseToPinyinUppercase(name).toLowerCase()
      );
      if (pinyinFull && pinyinFull.includes(collapseSpaces(normalizedSearch))) {
        return true;
      }

      const pinyinInitials = collapseSpaces(
        chineseToPinyinInitialsUppercase(name).toLowerCase()
      );
      if (
        pinyinInitials &&
        pinyinInitials.includes(collapseSpaces(normalizedSearch))
      ) {
        return true;
      }

      return false;
    });
  }, [customers, searchValue]);

  // 处理客户选择
  const handleSelect = (customerId: string) => {
    onValueChange?.(customerId);
    setOpen(false);
    // 保存当前搜索关键词，供下次打开时复用
    lastSearchValueRef.current = searchValue;
  };

  // 处理新增客户
  const handleCreateCustomer = () => {
    setCreateDialogOpen(true);
    setOpen(false);
  };

  // 处理客户创建成功
  const handleCustomerCreated = (customer: Customer) => {
    // 通知父组件
    onCustomerCreated?.(customer);

    // 自动选择新创建的客户
    onValueChange?.(customer.id);

    // 关闭创建对话框
    setCreateDialogOpen(false);
  };

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      onRefreshCustomers?.();
      // 重新打开时复用上次的搜索关键词
      if (lastSearchValueRef.current) {
        setSearchValue(lastSearchValueRef.current);
      }
    }
    wasOpenRef.current = open;
  }, [open, onRefreshCustomers]);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn('h-12 w-full justify-between', className)}
            disabled={disabled || isLoading}
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
                {isLoading ? '加载中...' : placeholder}
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
                {isLoading ? (
                  '加载中...'
                ) : searchValue.trim() ? (
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
                ) : (
                  <div className="py-6 text-center">
                    <div className="text-muted-foreground mb-3 text-sm">
                      输入客户名称 / 手机号进行搜索，或直接创建新客户
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
                  {filteredCustomers.map(customer => {
                    const customerEmail = extractCustomerEmail(customer);
                    const isSelected = value === customer.id;

                    return (
                      <CommandItem
                        key={customer.id}
                        value={`${customer.name} ${customer.phone || ''} ${customerEmail || ''}`}
                        onSelect={() => handleSelect(customer.id)}
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
