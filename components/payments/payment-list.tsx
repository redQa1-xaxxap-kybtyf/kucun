'use client';

import { format } from 'date-fns';
import {
  Check,
  Edit,
  Eye,
  MoreHorizontal,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { ContentLoading } from '@/components/common/loading';
import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  MobileDataTable,
  type ColumnDef,
} from '@/components/ui/mobile-data-table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { paymentUtils } from '@/lib/api/payments';
import {
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_PAYMENT_STATUSES,
  PAYMENT_STATUS_VARIANTS,
  type PaymentRecordDetail,
  type PaymentRecordQuery,
} from '@/lib/types/payment';
import { cn } from '@/lib/utils';
import { formatPaymentDateTime } from '@/lib/utils/datetime';

export interface PaymentListProps {
  payments: PaymentRecordDetail[];
  total: number;
  page: number;
  pageSize: number;
  query: PaymentRecordQuery;
  loading?: boolean;
  onQueryChange: (query: Partial<PaymentRecordQuery>) => void;
  onView?: (payment: PaymentRecordDetail) => void;
  onEdit?: (payment: PaymentRecordDetail) => void;
  onDelete?: (payment: PaymentRecordDetail) => void;
  onConfirm?: (payment: PaymentRecordDetail) => void;
  onCancel?: (payment: PaymentRecordDetail) => void;
  onRefresh?: () => void;
  className?: string;
}

interface PaymentListActions
  extends Pick<
    PaymentListProps,
    'onView' | 'onEdit' | 'onDelete' | 'onConfirm' | 'onCancel'
  > {}

const ALLOWED_SORT_FIELDS: Array<PaymentRecordQuery['sortBy']> = [
  'paymentDate',
  'paymentAmount',
  'createdAt',
];

const paymentNumberColumn: ColumnDef<PaymentRecordDetail> = {
  key: 'paymentNumber',
  title: '收款单号',
  width: '120px',
  render: (_value, payment) => (
    <div className="font-medium">{payment.paymentNumber}</div>
  ),
};

const salesOrderColumn: ColumnDef<PaymentRecordDetail> = {
  key: 'salesOrder',
  title: '销售订单',
  width: '120px',
  render: (_value, payment) => (
    <Link
      href={`/sales-orders/${payment.salesOrder.id}`}
      prefetch={false}
      className="text-primary hover:text-primary/80 hover:underline"
    >
      {payment.salesOrder.orderNumber}
    </Link>
  ),
};

const customerColumn: ColumnDef<PaymentRecordDetail> = {
  key: 'customer',
  title: '客户',
  width: '150px',
  render: (_value, payment) => (
    <div>
      <div className="font-medium">{payment.customer.name}</div>
      {payment.customer.phone && (
        <div className="text-muted-foreground text-sm">
          {payment.customer.phone}
        </div>
      )}
    </div>
  ),
};

const paymentMethodColumn: ColumnDef<PaymentRecordDetail> = {
  key: 'paymentMethod',
  title: '收款方式',
  width: '120px',
  render: (_value, payment) => (
    <div className="flex items-center space-x-2">
      <span>{paymentUtils.getPaymentMethodIcon(payment.paymentMethod)}</span>
      <span>{paymentUtils.formatPaymentMethod(payment.paymentMethod)}</span>
    </div>
  ),
};

const paymentAmountColumn: ColumnDef<PaymentRecordDetail> = {
  key: 'paymentAmount',
  title: '收款金额',
  width: '120px',
  align: 'right',
  render: (_value, payment) => (
    <div className="font-medium text-green-600">
      {paymentUtils.formatAmount(payment.paymentAmount)}
    </div>
  ),
};

const paymentDateColumn: ColumnDef<PaymentRecordDetail> = {
  key: 'paymentDate',
  title: '收款日期',
  width: '100px',
  render: value =>
    value ? (
      <div className="text-sm">
        {format(new Date(value as string), 'yyyy-MM-dd')}
      </div>
    ) : (
      '-'
    ),
};

const statusColumn: ColumnDef<PaymentRecordDetail> = {
  key: 'status',
  title: '状态',
  width: '80px',
  render: (_value, payment) => (
    <Badge variant={PAYMENT_STATUS_VARIANTS[payment.status]}>
      {paymentUtils.formatPaymentStatus(payment.status)}
    </Badge>
  ),
};

const userColumn: ColumnDef<PaymentRecordDetail> = {
  key: 'user',
  title: '操作人',
  width: '100px',
  render: (_value, payment) => (
    <div className="text-sm">{payment.user.name}</div>
  ),
};

const createActionsColumn = (
  actions: PaymentListActions
): ColumnDef<PaymentRecordDetail> => ({
  key: 'actions',
  title: '操作',
  width: '80px',
  render: (_value, payment) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>操作</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {actions.onView && (
          <DropdownMenuItem onClick={() => actions.onView?.(payment)}>
            <Eye className="mr-2 h-4 w-4" />
            查看详情
          </DropdownMenuItem>
        )}
        {actions.onEdit && payment.status === 'pending' && (
          <DropdownMenuItem onClick={() => actions.onEdit?.(payment)}>
            <Edit className="mr-2 h-4 w-4" />
            编辑
          </DropdownMenuItem>
        )}
        {actions.onConfirm && payment.status === 'pending' && (
          <DropdownMenuItem onClick={() => actions.onConfirm?.(payment)}>
            <Check className="mr-2 h-4 w-4" />
            确认到账
          </DropdownMenuItem>
        )}
        {actions.onCancel && payment.status === 'pending' && (
          <DropdownMenuItem onClick={() => actions.onCancel?.(payment)}>
            <X className="mr-2 h-4 w-4" />
            取消收款
          </DropdownMenuItem>
        )}
        {actions.onDelete && payment.status !== 'confirmed' && (
          <DropdownMenuItem
            onClick={() => actions.onDelete?.(payment)}
            className="text-[hsl(var(--color-error))] focus:bg-[hsl(var(--color-error-light))] focus:text-[hsl(var(--color-error))]"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  ),
});

function createColumns(
  actions: PaymentListActions
): Array<ColumnDef<PaymentRecordDetail>> {
  return [
    paymentNumberColumn,
    salesOrderColumn,
    customerColumn,
    paymentMethodColumn,
    paymentAmountColumn,
    paymentDateColumn,
    statusColumn,
    userColumn,
    createActionsColumn(actions),
  ];
}

const renderPaymentMobileCard = (
  payment: PaymentRecordDetail,
  actions: PaymentListActions
) => {
  const methodLabel = paymentUtils.formatPaymentMethod(payment.paymentMethod);
  const infoRows = [
    {
      label: '销售订单:',
      value: (
        <Link
          href={`/sales-orders/${payment.salesOrder.id}`}
          className="text-primary hover:text-primary/80"
        >
          {payment.salesOrder.orderNumber}
        </Link>
      ),
    },
    {
      label: '客户:',
      value: <span className="font-medium">{payment.customer.name}</span>,
    },
    {
      label: '收款方式:',
      value: (
        <div className="flex items-center space-x-1">
          <span>
            {paymentUtils.getPaymentMethodIcon(payment.paymentMethod)}
          </span>
          <span>{methodLabel}</span>
        </div>
      ),
    },
    {
      label: '收款金额:',
      value: (
        <span className="font-medium text-green-600">
          {paymentUtils.formatAmount(payment.paymentAmount)}
        </span>
      ),
    },
    { label: '操作人:', value: payment.user.name },
  ];

  return (
    <Card key={payment.id} className="mb-4">
      <CardContent className="p-4">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <div className="text-sm font-medium">{payment.paymentNumber}</div>
            <div className="text-muted-foreground mt-1 text-xs">
              {formatPaymentDateTime(payment.paymentDate, payment.createdAt)}
            </div>
          </div>
          <Badge variant={PAYMENT_STATUS_VARIANTS[payment.status]}>
            {paymentUtils.formatPaymentStatus(payment.status)}
          </Badge>
        </div>

        <div className="space-y-2 text-sm">
          {infoRows.map(row => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-muted-foreground">{row.label}</span>
              <span>{row.value}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-end space-x-2 border-t pt-3">
          {actions.onView && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => actions.onView?.(payment)}
            >
              <Eye className="mr-1 h-3 w-3" />
              查看
            </Button>
          )}
          {actions.onEdit && payment.status === 'pending' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => actions.onEdit?.(payment)}
            >
              <Edit className="mr-1 h-3 w-3" />
              编辑
            </Button>
          )}
          {actions.onConfirm && payment.status === 'pending' && (
            <Button
              variant="default"
              size="sm"
              onClick={() => actions.onConfirm?.(payment)}
            >
              <Check className="mr-1 h-3 w-3" />
              确认
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface SearchFilterBarProps {
  searchValue: string;
  query: PaymentRecordQuery;
  onSearch: (value: string) => void;
  onFilter: (
    key: keyof PaymentRecordQuery,
    value: string | number | boolean | undefined
  ) => void;
  onRefresh?: () => void;
}

const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchValue,
  query,
  onSearch,
  onFilter,
  onRefresh,
}) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 md:space-x-4">
        <div className="max-w-md flex-1">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
            <Input
              placeholder="搜索收款单号、客户名称..."
              value={searchValue}
              onChange={e => onSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Select
            value={query.paymentMethod || ''}
            onValueChange={value =>
              onFilter('paymentMethod', value ? value : undefined)
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="收款方式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部方式</SelectItem>
              {DEFAULT_PAYMENT_METHODS.filter(method => method.isActive).map(
                method => (
                  <SelectItem key={method.method} value={method.method}>
                    {method.label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>

          <Select
            value={query.status || ''}
            onValueChange={value =>
              onFilter('status', value ? value : undefined)
            }
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部状态</SelectItem>
              {DEFAULT_PAYMENT_STATUSES.filter(status => status.isActive).map(
                status => (
                  <SelectItem key={status.status} value={status.status}>
                    {status.label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>

          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
);

interface PaymentListDataProps {
  payments: PaymentRecordDetail[];
  columns: Array<ColumnDef<PaymentRecordDetail>>;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSort: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  renderMobileCard: (payment: PaymentRecordDetail) => React.ReactNode;
  loading?: boolean;
}

const PaymentListData: React.FC<PaymentListDataProps> = ({
  payments,
  columns,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSort,
  renderMobileCard,
  loading,
}) =>
  payments.length === 0 ? (
    <Card>
      <CardContent className="p-8">
        <EmptyState
          icon={<ChineseYuan className="text-muted-foreground h-8 w-8" />}
          title="暂无收款"
          compact
        />
      </CardContent>
    </Card>
  ) : (
    <MobileDataTable
      data={payments}
      columns={columns}
      total={total}
      page={page}
      pageSize={pageSize}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      onSort={onSort}
      renderMobileCard={renderMobileCard}
      loading={loading}
    />
  );

interface UsePaymentListResult {
  payments: PaymentRecordDetail[];
  total: number;
  page: number;
  pageSize: number;
  query: PaymentRecordQuery;
  loading: boolean;
  onRefresh?: () => void;
  className?: string;
  restProps: Record<string, unknown>;
  searchValue: string;
  handleSearch: (value: string) => void;
  handleFilter: (
    key: keyof PaymentRecordQuery,
    value: string | number | boolean | undefined
  ) => void;
  handlePageChange: (page: number) => void;
  handlePageSizeChange: (size: number) => void;
  handleSort: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  columns: Array<ColumnDef<PaymentRecordDetail>>;
  mobileCardRenderer: (payment: PaymentRecordDetail) => React.ReactNode;
}

function usePaymentList(props: PaymentListProps): UsePaymentListResult {
  const {
    payments,
    total,
    page,
    pageSize,
    query,
    loading = false,
    onQueryChange,
    onView,
    onEdit,
    onDelete,
    onConfirm,
    onCancel,
    onRefresh,
    className,
    ...rest
  } = props;

  const [searchValue, setSearchValue] = React.useState(query.search || '');

  const handleSearch = React.useCallback(
    (value: string) => {
      setSearchValue(value);
      onQueryChange({ search: value, page: 1 });
    },
    [onQueryChange]
  );

  const handleFilter = React.useCallback(
    (
      key: keyof PaymentRecordQuery,
      value: string | number | boolean | undefined
    ) => {
      onQueryChange({ [key]: value, page: 1 });
    },
    [onQueryChange]
  );

  const handlePageChange = React.useCallback(
    (newPage: number) => {
      onQueryChange({ page: newPage });
    },
    [onQueryChange]
  );

  const handlePageSizeChange = React.useCallback(
    (newPageSize: number) => {
      onQueryChange({ pageSize: newPageSize, page: 1 });
    },
    [onQueryChange]
  );

  const handleSort = React.useCallback(
    (sortBy: string, sortOrder: 'asc' | 'desc') => {
      const safeSortBy = ALLOWED_SORT_FIELDS.includes(
        sortBy as PaymentRecordQuery['sortBy']
      )
        ? (sortBy as PaymentRecordQuery['sortBy'])
        : undefined;
      onQueryChange({ sortBy: safeSortBy, sortOrder });
    },
    [onQueryChange]
  );

  const actions = React.useMemo(
    () => ({ onView, onEdit, onDelete, onConfirm, onCancel }),
    [onView, onEdit, onDelete, onConfirm, onCancel]
  );

  const columns = React.useMemo(() => createColumns(actions), [actions]);
  const mobileCardRenderer = React.useCallback(
    (payment: PaymentRecordDetail) => renderPaymentMobileCard(payment, actions),
    [actions]
  );

  return {
    payments,
    total,
    page,
    pageSize,
    query,
    loading,
    onRefresh,
    className,
    restProps: rest,
    searchValue,
    handleSearch,
    handleFilter,
    handlePageChange,
    handlePageSizeChange,
    handleSort,
    columns,
    mobileCardRenderer,
  };
}

const PaymentListComponent = (
  props: PaymentListProps,
  ref: React.Ref<HTMLDivElement>
) => {
  const {
    payments,
    total,
    page,
    pageSize,
    query,
    loading,
    onRefresh,
    className,
    restProps,
    searchValue,
    handleSearch,
    handleFilter,
    handlePageChange,
    handlePageSizeChange,
    handleSort,
    columns,
    mobileCardRenderer,
  } = usePaymentList(props);

  if (loading) {
    return <PaymentListSkeleton />;
  }

  return (
    <div className={cn('space-y-4', className)} ref={ref} {...restProps}>
      <SearchFilterBar
        searchValue={searchValue}
        query={query}
        onSearch={handleSearch}
        onFilter={handleFilter}
        onRefresh={onRefresh}
      />
      <PaymentListData
        payments={payments}
        columns={columns}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        onSort={handleSort}
        renderMobileCard={mobileCardRenderer}
        loading={loading}
      />
    </div>
  );
};

const PaymentList = React.forwardRef<HTMLDivElement, PaymentListProps>(
  PaymentListComponent
);
PaymentList.displayName = 'PaymentList';

function PaymentListSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <ContentLoading text="加载收款中..." />
        </CardContent>
      </Card>
    </div>
  );
}

export { PaymentList };
