'use client';
/* eslint-disable max-lines-per-function */

import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Plus, Search, User } from 'lucide-react';
import dynamic from 'next/dynamic';
import * as React from 'react';
import { ZodError } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Command,
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
import { useListSearchController } from '@/hooks/use-list-search-controller';
import {
  customerQueryKeys,
  getCustomer,
  searchCustomersLightweight,
} from '@/lib/api/customers';
import type { Customer, CustomerExtendedInfo } from '@/lib/types/customer';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/utils/console-logger';
import {
  isPinyinSearchQuery,
  loadPinyinUtils,
  type PinyinUtils,
} from '@/lib/utils/pinyin-loader';

const CustomerCreateDialog = dynamic(
  () =>
    import('./customer-create-dialog').then(mod => mod.CustomerCreateDialog),
  { ssr: false, loading: () => null }
);

interface CustomerSelectorProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowCreate?: boolean;
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

function normalizeCustomerSearchInput(value: string) {
  return value.trim() ? value : undefined;
}

export function CustomerSelector({
  value,
  onValueChange,
  placeholder = '搜索并选择客户',
  disabled = false,
  className,
  allowCreate = true,
  onCustomerCreated,
  onCustomerResolved,
  initialCustomer,
  onBlur,
}: CustomerSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [committedSearch, setCommittedSearch] = React.useState('');
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [pinyinUtils, setPinyinUtils] = React.useState<PinyinUtils | null>(
    null
  );
  const [selectedCustomer, setSelectedCustomer] = React.useState<
    Customer | undefined
  >(initialCustomer as Customer | undefined); // ✅ 类型断言
  const {
    searchInput,
    isSearching: isSearchPending,
    handleSearchChange,
  } = useListSearchController({
    committedValue: committedSearch,
    onCommit: nextValue => {
      setCommittedSearch(nextValue ?? '');
    },
    normalize: normalizeCustomerSearchInput,
  });

  const notifyBlur = React.useCallback(() => {
    if (!onBlur) {
      return;
    }

    const handleError = (error: unknown) => {
      if (error instanceof ZodError) {
        // 表单校验失败时，react-hook-form 会抛出 ZodError，这里吞掉避免打断交互
        return;
      }
      logger.error('components:sales-orders:customer-selector', 'onBlur failed', error);
    };

    try {
      onBlur(); // ✅ onBlur返回void,不需要检查Promise
    } catch (error) {
      handleError(error);
    }
  }, [onBlur]);

  const normalizedInputSearch = searchInput.trim().toLowerCase();
  const normalizedSearch = committedSearch.trim().toLowerCase();
  // 允许1个字符开始搜索，支持中文单字搜索（如"张"、"李"等）
  const shouldSearch = normalizedSearch.length >= 1;
  const hasSearchInput = normalizedInputSearch.length >= 1;

  const shouldLoadPinyin = open && isPinyinSearchQuery(searchInput);

  React.useEffect(() => {
    if (!shouldLoadPinyin || pinyinUtils) {
      return;
    }

    let cancelled = false;

    loadPinyinUtils()
      .then(utils => {
        if (cancelled) {
          return;
        }
        setPinyinUtils(utils);
      })
      .catch(() => {
        // 拼音库加载失败时，降级为基础搜索（不影响业务正确性）
      });

    return () => {
      cancelled = true;
    };
  }, [pinyinUtils, shouldLoadPinyin]);

  // ✅ 明确指定泛型类型,匹配API返回值
  const { data: searchResults, isFetching: isSearching } = useQuery<
    Pick<Customer, 'id' | 'name' | 'phone' | 'address'>[]
  >({
    queryKey: customerQueryKeys.search(normalizedSearch || '', { limit: 20 }),
    queryFn: () => searchCustomersLightweight(normalizedSearch, { limit: 20 }),
    enabled: shouldSearch && open,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: previousData => previousData, // ✅ 替换已弃用的keepPreviousData
  });

  const { data: resolvedCustomerByValue } = useQuery<Customer>({
    queryKey: customerQueryKeys.detail(value || ''),
    queryFn: () => getCustomer(value || ''),
    enabled: Boolean(value) && (!selectedCustomer || selectedCustomer.id !== value),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // 客户列表：搜索结果或空数组（使用 useMemo 避免重复渲染）
  const customers = React.useMemo(
    () => (searchResults ?? []) as Customer[], // ✅ 类型断言
    [searchResults]
  );
  const isSearchingCustomers = isSearching || isSearchPending;

  // 前端过滤：服务端已做基础搜索，这里只做展示前的轻量过滤
  const filteredCustomers = React.useMemo(() => {
    if (!hasSearchInput) {
      return [];
    }

    const collapseSpaces = (value: string) => value.replace(/\s+/g, '');
    const normalizedQueryNoSpaces = collapseSpaces(normalizedInputSearch);

    const shouldUsePinyin = Boolean(
      pinyinUtils && isPinyinSearchQuery(normalizedInputSearch)
    );

    return customers.filter((customer: Customer) => {
      const name = customer.name ?? '';
      const nameLower = name.toLowerCase();

      // 基础匹配（服务端已处理）
      if (
        nameLower.includes(normalizedInputSearch) ||
        (customer.phone && customer.phone.includes(normalizedInputSearch)) ||
        (customer.address &&
          customer.address.toLowerCase().includes(normalizedInputSearch))
      ) {
        return true;
      }

      if (shouldUsePinyin && pinyinUtils) {
        const fullPinyin = collapseSpaces(
          pinyinUtils.chineseToPinyinUppercase(name).toLowerCase()
        );
        if (fullPinyin && fullPinyin.includes(normalizedQueryNoSpaces)) {
          return true;
        }

        const initials = collapseSpaces(
          pinyinUtils.chineseToPinyinInitialsUppercase(name).toLowerCase()
        );
        if (initials && initials.includes(normalizedQueryNoSpaces)) {
          return true;
        }
      }

      return false;
    });
  }, [customers, hasSearchInput, normalizedInputSearch, pinyinUtils]);

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
    if (!initialCustomer || value !== initialCustomer.id) {
      return;
    }

    const hasChanged =
      !selectedCustomer ||
      initialCustomer.id !== selectedCustomer.id ||
      initialCustomer.address !== selectedCustomer.address ||
      initialCustomer.phone !== selectedCustomer.phone ||
      initialCustomer.name !== selectedCustomer.name;

    if (hasChanged) {
      setSelectedCustomer(initialCustomer as Customer); // ✅ 类型断言
      onCustomerResolved?.(initialCustomer as Customer); // ✅ 类型断言
    }
  }, [initialCustomer, onCustomerResolved, selectedCustomer, value]);

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

  React.useEffect(() => {
    if (!resolvedCustomerByValue) {
      return;
    }

    const hasChanged =
      !selectedCustomer ||
      resolvedCustomerByValue.id !== selectedCustomer.id ||
      resolvedCustomerByValue.address !== selectedCustomer.address ||
      resolvedCustomerByValue.phone !== selectedCustomer.phone ||
      resolvedCustomerByValue.name !== selectedCustomer.name;

    if (hasChanged) {
      setSelectedCustomer(resolvedCustomerByValue);
      onCustomerResolved?.(resolvedCustomerByValue);
    }
  }, [onCustomerResolved, resolvedCustomerByValue, selectedCustomer]);

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
        <PopoverContent
          className="w-[min(400px,calc(100vw-2rem))] p-0"
          align="start"
        >
          <Command filter={() => 1}>
            <CommandInput
              placeholder="搜索客户名称或手机号..."
              value={searchInput}
              onValueChange={handleSearchChange}
            />
            <CommandList>
              {filteredCustomers.length > 0 ? (
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
              ) : isSearchingCustomers ? (
                <div className="py-6 text-center">
                  <div className="text-muted-foreground text-sm">
                    搜索中...
                  </div>
                </div>
              ) : !hasSearchInput ? (
                <div className="py-6 text-center">
                  <div className="text-muted-foreground mb-3 text-sm">
                    输入关键词开始搜索客户
                  </div>
                  {allowCreate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCreateCustomer}
                      className="h-8"
                    >
                      <Plus className="mr-2 h-3 w-3" />
                      新增客户
                    </Button>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <div className="text-muted-foreground mb-3 text-sm">
                    未找到相关客户，尝试输入其它关键词
                  </div>
                  {allowCreate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCreateCustomer}
                      className="h-8"
                    >
                      <Plus className="mr-2 h-3 w-3" />
                      新增客户
                    </Button>
                  )}
                </div>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* 客户创建对话框 */}
      {allowCreate && createDialogOpen && (
        <CustomerCreateDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onCustomerCreated={handleCustomerCreated}
          initialName={searchInput}
        />
      )}
    </>
  );
}
