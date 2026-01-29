/* eslint-disable max-lines-per-function, max-lines */
'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2, Save } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import React from 'react';
import {
  useFieldArray,
  useForm,
  useWatch,
  type FieldErrors,
  type Path,
} from 'react-hook-form';

import { CustomerSelector } from '@/components/sales-orders/customer-selector';
import { FeeItemsFormField } from '@/components/sales-orders/fee-items';
import { InventoryChecker } from '@/components/sales-orders/inventory-checker';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/components/ui/use-toast';
import {
  useCustomerPriceHistory,
  type PriceType,
} from '@/hooks/use-price-history';
import { getProducts, productQueryKeys } from '@/lib/api/products';
import {
  useCreateSalesOrder,
  useUpdateSalesOrder,
} from '@/lib/api/sales-orders';
import { getSuppliers, supplierQueryKeys } from '@/lib/api/suppliers';
import type { Customer } from '@/lib/types/customer';
import type { Product } from '@/lib/types/product';
import {
  TRANSFER_MODE_LABELS,
  type SalesOrder,
  type SalesOrderItem,
  type SalesOrderStatus,
  type TransferFulfillmentMode,
} from '@/lib/types/sales-order';
import {
  getDefaultFeePaidBy,
  type SalesOrderFeeItem,
} from '@/lib/types/sales-order-fee';
import type { Supplier } from '@/lib/types/supplier';
import { logger } from '@/lib/utils/console-logger';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import { formatDate } from '@/lib/utils/datetime';
import {
  transformFormDataToCreateInput,
  transformFormDataToUpdateInput,
  type SalesOrderFormData,
} from '@/lib/utils/sales-order-transforms';
import {
  salesOrderCreateSchema as CreateSalesOrderSchema,
  type SalesOrderCreateFormData as CreateSalesOrderData,
  type SalesOrderItemFormData,
} from '@/lib/validations/sales-order';

import { OrderItemsSection } from './erp-sales-order-form/OrderItemsSection';
import { PrepaymentSection } from './erp-sales-order-form/PrepaymentSection';

const SupplierSelector = dynamic(
  () =>
    import('@/components/sales-orders/supplier-selector').then(
      mod => mod.SupplierSelector
    ),
  { ssr: false, loading: () => null }
);

const EMPTY_SALES_ORDER_ITEMS: SalesOrderItemFormData[] = [];
const EMPTY_FEE_ITEMS: SalesOrderFeeItem[] = [];

const UNIT_MAPPING: Record<string, string> = {
  piece: '件',
  pieces: '件',
  box: '箱',
  boxes: '箱',
  pack: '包',
  packs: '包',
  set: '套',
  sets: '套',
  unit: '个',
  units: '个',
  kg: 'kg',
  g: 'g',
  m: 'm',
  cm: 'cm',
  mm: 'mm',
  m2: 'm²',
  m3: 'm³',
  l: 'L',
  ml: 'mL',
};

const coerceNumeric = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// 记住“新建销售订单”页面最近一次选择的订单类型，避免刷新/重载后总是回到 NORMAL
const ORDER_TYPE_STORAGE_KEY = 'salesOrders.create.defaultOrderType';

// 客户数据查询已移至 CustomerSelector 组件内部
type SuppliersResponse = Awaited<ReturnType<typeof getSuppliers>>;

interface ERPSalesOrderFormProps {
  mode?: 'create' | 'edit';
  orderId?: string;
  initialData?: SalesOrder;
  initialOrderNumber?: string; // 新增：服务端预生成的订单号
  onSuccess?: (order: { id: string; orderNumber?: string }) => void;
  onCancel?: () => void;
}

/**
 * ERP风格的销售订单表单组件
 * 采用中国主流ERP系统的界面设计模式
 * 优化：支持接收预生成的订单号，消除加载延迟
 */
export function ERPSalesOrderForm({
  mode = 'create',
  orderId,
  initialData,
  initialOrderNumber,
  onSuccess,
  onCancel,
}: ERPSalesOrderFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 客户数据查询已移至 CustomerSelector 组件内部
  // 不再需要在表单组件中预加载客户列表

  const suppliersQueryParams = React.useMemo(
    () =>
      ({
        page: 1,
        limit: 100,
        status: 'active',
        sortBy: 'name',
        sortOrder: 'asc',
      }) as const,
    []
  );
  const suppliersQueryKey = React.useMemo(
    () => supplierQueryKeys.list(suppliersQueryParams),
    [suppliersQueryParams]
  );

  const [resolvedCustomer, setResolvedCustomer] =
    React.useState<Customer | null>(
      () => (initialData?.customer as Customer) ?? null
    ); // ✅ 类型断言
  React.useEffect(() => {
    if (mode === 'edit' && initialData?.customer) {
      setResolvedCustomer(initialData.customer as Customer); // ✅ 类型断言
    }
  }, [mode, initialData?.customer]);

  const mapFormDataForTransform = React.useCallback(
    (payload: CreateSalesOrderData): SalesOrderFormData => ({
      customerId: payload.customerId,
      status: payload.status,
      orderType: payload.orderType,
      transferMode: payload.transferMode,
      supplierId: payload.supplierId,
      remarks: payload.remarks ?? '',
      items: payload.items ?? [],
      feeItems: (payload.feeItems ?? []).map(fee => ({
        id: fee.id ?? undefined,
        feeType: fee.feeType,
        feeName: fee.feeName,
        feeAmount: fee.feeAmount,
        paidBy: fee.paidBy ?? getDefaultFeePaidBy(fee.feeType),
        remarks: fee.remarks ?? '',
      })),
      roundingAdjustment: payload.roundingAdjustment,
      usePrepayment: payload.usePrepayment,
      prepaymentAmount: payload.prepaymentAmount,
    }),
    []
  );

  // 表单状态
  const form = useForm<CreateSalesOrderData>({
    resolver: standardSchemaResolver(CreateSalesOrderSchema),
    mode: 'onBlur', // ✅ 用户离开字段时验证
    reValidateMode: 'onChange', // ✅ 提交后实时验证
    criteriaMode: 'all', // ✅ 显示所有错误
    shouldFocusError: true,
    defaultValues: {
      customerId: '',
      status: 'draft',
      orderType: 'NORMAL',
      transferMode: 'SUPPLIER_ONLY',
      supplierId: '',
      remarks: '',
      feeItems: [],
      items: [],
      roundingAdjustment: undefined,
    },
  });

  const { fields, append, remove } = useFieldArray<
    CreateSalesOrderData,
    'items'
  >({
    control: form.control,
    name: 'items',
  });

  const findFirstError = React.useCallback(
    (
      errors: FieldErrors<CreateSalesOrderData>
    ): { path: Path<CreateSalesOrderData>; message: string } | null => {
      const traverse = (
        value: unknown,
        currentPath: string
      ): { path: string; message: string } | null => {
        if (!value) {
          return null;
        }

        if (
          typeof value === 'object' &&
          value !== null &&
          'message' in (value as Record<string, unknown>)
        ) {
          const message = String(
            (value as { message?: unknown }).message ?? ''
          ).trim();

          if (message) {
            return { path: currentPath, message };
          }
        }

        if (Array.isArray(value)) {
          for (let index = 0; index < value.length; index += 1) {
            const result = traverse(
              value[index],
              currentPath ? `${currentPath}.${index}` : String(index)
            );
            if (result) {
              return result;
            }
          }
        } else if (typeof value === 'object' && value !== null) {
          for (const [key, child] of Object.entries(
            value as Record<string, unknown>
          )) {
            const nextPath = currentPath ? `${currentPath}.${key}` : key;
            const result = traverse(child, nextPath);
            if (result) {
              return result;
            }
          }
        }

        return null;
      };

      const result = traverse(errors, '');
      if (!result) {
        return null;
      }

      return {
        path: result.path as Path<CreateSalesOrderData>,
        message: result.message,
      };
    },
    []
  );

  // 挂载时从 sessionStorage 恢复最近一次选择的订单类型，防止刷新/重载后总是变回 NORMAL
  React.useEffect(() => {
    if (mode !== 'create') {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const stored = window.sessionStorage.getItem(ORDER_TYPE_STORAGE_KEY);
    if (stored === 'NORMAL' || stored === 'TRANSFER') {
      const current = form.getValues('orderType');
      if (current !== stored) {
        form.setValue('orderType', stored as 'NORMAL' | 'TRANSFER', {
          shouldDirty: false,
          shouldValidate: false,
        });
      }
    }
  }, [form, mode]);

  // 监听客户ID变化
  const selectedCustomerId = form.watch('customerId');
  const orderType = form.watch('orderType');
  const transferMode = form.watch('transferMode') as
    | TransferFulfillmentMode
    | undefined;
  const supplierId = form.watch('supplierId');
  const feeItems = (form.watch('feeItems') ??
    EMPTY_FEE_ITEMS) as SalesOrderFeeItem[];
  const roundingAdjustment = Number(form.watch('roundingAdjustment') ?? 0);

  // 客户数据查询已移至 CustomerSelector 组件内部

  const { data: productsData, isLoading: _productsLoading } = useQuery({
    queryKey: productQueryKeys.list({
      includeInventory: true,
      includeBatchSpecs: true,
    }),
    queryFn: () =>
      getProducts({
        includeInventory: true,
        includeStatistics: false,
        includeBatchSpecs: true,
      }),
  });

  const { data: suppliersData, isLoading: suppliersLoading } = useQuery({
    queryKey: suppliersQueryKey,
    queryFn: () => getSuppliers(suppliersQueryParams),
  });

  // 获取客户的历史价格（根据订单类型决定价格类型）
  // 普通销售用SALES价格，调货销售用FACTORY价格
  const priceType: PriceType = orderType === 'NORMAL' ? 'SALES' : 'FACTORY';

  const { data: priceHistoryData } = useCustomerPriceHistory({
    customerId: selectedCustomerId,
    priceType,
  });

  // ✅ 使用新的 useCreateSalesOrder Hook，自动处理缓存刷新
  const createMutation = useCreateSalesOrder({
    onSuccess: (data: { id: string; orderNumber: string }) => {
      toast({
        title: '订单创建成功',
        description: `订单号：${data.orderNumber}`,
        variant: 'success',
      });

      // ✅ 缓存自动刷新，无需手动调用 invalidateQueries
      // useCreateSalesOrder Hook 已经处理了所有缓存刷新逻辑：
      // - 立即刷新: 销售订单列表、统计
      // - 延迟刷新: 库存、客户、产品、仪表盘、财务（包括应收款、应付款、财务概览）

      onSuccess?.(data);
    },
    onError: (error: Error) => {
      toast({
        title: '创建失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // ✅ 使用新的 useUpdateSalesOrder Hook，自动处理缓存刷新
  const updateMutation = useUpdateSalesOrder({
    onSuccess: (response: { data?: SalesOrder | null }) => {
      const order = response.data;
      toast({
        title: '订单更新成功',
        description: `订单号：${order?.orderNumber || ''}`,
        variant: 'success',
      });

      // ✅ 缓存自动刷新，无需手动调用 invalidateQueries
      // useUpdateSalesOrder Hook 已经处理了所有缓存刷新逻辑：
      // - 立即刷新: 销售订单详情、列表、统计
      // - 延迟刷新: 库存、客户、产品、仪表盘、财务（包括应收款、财务概览）

      if (order) {
        onSuccess?.(order);
      }
    },
    onError: (error: Error) => {
      toast({
        title: '更新失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 计算总金额：始终基于系统数量（片数）和片单价
  const watchedItems = (useWatch<CreateSalesOrderData>({
    control: form.control,
    name: 'items',
    defaultValue: form.getValues('items'),
  }) ?? EMPTY_SALES_ORDER_ITEMS) as SalesOrderItemFormData[];

  const inventoryCheckItems = React.useMemo(
    () =>
      watchedItems.map(item => {
        const quantity = Number(item.quantity ?? 0);
        const safeQuantity = Number.isFinite(quantity) ? quantity : 0;
        const productId = (item.productId ?? '').toString().trim();
        const batchNumber = item.batchNumber ?? '';

        return {
          productId,
          quantity: safeQuantity,
          batchNumber,
        };
      }),
    [watchedItems]
  );

  // 优化：使用 ref 跟踪上一次的 orderType，避免不必要的 setValue 调用
  const prevOrderTypeRef = React.useRef<'NORMAL' | 'TRANSFER'>(orderType);

  React.useEffect(() => {
    // 只在 orderType 真正改变时才执行
    if (prevOrderTypeRef.current === orderType) {
      return;
    }

    prevOrderTypeRef.current = orderType;

    if (orderType === 'TRANSFER') {
      // 切换到调货模式：只在 transferMode 为空时设置默认值
      const currentTransferMode = form.getValues('transferMode');
      if (!currentTransferMode) {
        form.setValue('transferMode', 'SUPPLIER_ONLY', {
          shouldDirty: false,
          shouldValidate: false,
        });
      }
    } else {
      // 切换到普通模式：重置相关字段
      const currentTransferMode = form.getValues('transferMode');
      const currentSupplierId = form.getValues('supplierId');

      if (currentTransferMode !== 'SUPPLIER_ONLY') {
        form.setValue('transferMode', 'SUPPLIER_ONLY', {
          shouldDirty: false,
          shouldValidate: false,
        });
      }

      if (currentSupplierId) {
        form.setValue('supplierId', '', {
          shouldDirty: true,
          shouldValidate: false,
        });
      }
    }
  }, [form, orderType]);

  // 兜底逻辑：在“新建订单”时，只要已经选择了供应商，就强制保持为“调货销售”
  // 目的：防止某些重置/校验流程把 orderType 意外改回 NORMAL，导致你看到模式跳变
  React.useEffect(() => {
    if (mode !== 'create') {
      return;
    }
    const currentSupplierId = (supplierId ?? '').toString().trim();
    const currentOrderType = form.getValues('orderType');
    if (currentSupplierId && currentOrderType !== 'TRANSFER') {
      form.setValue('orderType', 'TRANSFER', {
        shouldDirty: true,
        shouldValidate: false,
      });
    }
  }, [form, mode, supplierId]);

  const { customerPaidFees, companyPaidFees } = React.useMemo(
    () =>
      (feeItems || []).reduce(
        (acc, fee) => {
          const amount = coerceNumeric(fee.feeAmount);
          if ((fee.paidBy ?? 'customer') === 'company') {
            acc.companyPaidFees += amount;
          } else {
            acc.customerPaidFees += amount;
          }
          return acc;
        },
        { customerPaidFees: 0, companyPaidFees: 0 }
      ),
    [feeItems]
  );

  const totalAmount = React.useMemo(
    () =>
      watchedItems.reduce((sum, item) => {
        // 计算片单价（如果当前显示单位是件，需要转换为片单价）
        // 修复: 避免在单价换算时提前四舍五入导致的合计误差。
        // 统一与每行金额相同的计算方式：若显示单位为“件”，用 (片数/每件片数)*件单价；否则用 片数*片单价。
        const piecePriceForCalculation =
          item.displayUnit === '件' && item.unitPrice && item.piecesPerUnit
            ? item.unitPrice / item.piecesPerUnit // 不做2位小数的提前舍入
            : item.unitPrice || 0;

        // 金额 = 系统数量（片数） × 片单价
        return sum + coerceNumeric(item.quantity) * piecePriceForCalculation;
      }, 0),
    [watchedItems]
  );

  const totalQuantityPieces = React.useMemo(
    () =>
      watchedItems.reduce((sum, item) => sum + coerceNumeric(item.quantity), 0),
    [watchedItems]
  );

  const orderTotalWithFees =
    totalAmount + customerPaidFees + roundingAdjustment;

  const totalLocalQuantity = React.useMemo(
    () =>
      watchedItems.reduce(
        (sum, item) => sum + coerceNumeric(item.localQuantity),
        0
      ),
    [watchedItems]
  );
  const totalTransferQuantity = React.useMemo(
    () =>
      watchedItems.reduce(
        (sum, item) => sum + coerceNumeric(item.transferQuantity),
        0
      ),
    [watchedItems]
  );

  const totalTransferCost = React.useMemo(
    () =>
      watchedItems.reduce((sum, item) => {
        const unitCost = coerceNumeric(item.unitCost);
        const effectiveQuantity =
          transferMode === 'MIXED'
            ? coerceNumeric(item.transferQuantity)
            : coerceNumeric(item.quantity);
        return sum + unitCost * effectiveQuantity;
      }, 0),
    [watchedItems, transferMode]
  );

  const formatCurrency = (value: number) =>
    value.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const formatPieces = (value: number) =>
    `${value.toLocaleString('zh-CN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })} 片`;

  // 重量格式化工具函数 - 始终以吨为单位显示,保留1位小数
  const formatWeight = (totalKg: number): string =>
    `${Number.isFinite(totalKg) ? (totalKg / 1000).toFixed(1) : '0.0'}吨`;

  // 计算总重量：根据单位和每件片数正确计算
  const productMap = React.useMemo(() => {
    const map = new Map<string, Product>();
    (productsData?.data ?? []).forEach(product => {
      if (product?.id) {
        map.set(product.id, product);
      }
    });
    return map;
  }, [productsData?.data]);

  const totalWeight = React.useMemo(
    () =>
      watchedItems.reduce((sum, item, index) => {
        const quantityPieces = Number(item.quantity ?? 0);
        if (!Number.isFinite(quantityPieces) || quantityPieces <= 0) {
          return sum;
        }

        const productId = (item.productId ?? '').toString().trim();
        const product = productId ? productMap.get(productId) : undefined;
        const batchSpec =
          product && item.batchNumber
            ? product.batchSpecs?.find(
                spec => spec.batchNumber === item.batchNumber
              )
            : undefined;

        const effectivePiecesPerUnit =
          (item.piecesPerUnit && item.piecesPerUnit > 0
            ? item.piecesPerUnit
            : undefined) ??
          (batchSpec?.piecesPerUnit && batchSpec.piecesPerUnit > 0
            ? batchSpec.piecesPerUnit
            : undefined) ??
          (product?.piecesPerUnit && product.piecesPerUnit > 0
            ? product.piecesPerUnit
            : undefined) ??
          1;

        let weightKg: number | undefined;

        if (item.isManualProduct) {
          // 手动输入产品：manualWeight是用户输入的重量，根据displayUnit判断是每件还是每片
          const manualWeight = Number(item.manualWeight ?? 0);
          if (manualWeight > 0) {
            if (item.displayUnit === '件') {
              // 用户输入的是每件重量
              weightKg = manualWeight * Number(item.displayQuantity ?? 0);
            } else {
              // 用户输入的是每片重量
              weightKg = manualWeight * quantityPieces;
            }
          }
        } else {
          // 库存产品：weight字段存储的是每件的重量(kg)，不是每片
          const weightPerUnit =
            (batchSpec && batchSpec.weight && batchSpec.weight > 0
              ? batchSpec.weight
              : undefined) ??
            (product && product.weight && product.weight > 0
              ? product.weight
              : undefined);

          if (weightPerUnit && weightPerUnit > 0) {
            if (item.displayUnit === '件') {
              // 销售单位是"件"：总重量 = 每件重量 × 件数
              const displayQty = Number(item.displayQuantity ?? 0);
              weightKg = weightPerUnit * displayQty;
            } else {
              // 销售单位是"片"：总重量 = (每件重量 / 每件片数) × 片数
              const weightPerPiece = weightPerUnit / effectivePiecesPerUnit;
              weightKg = weightPerPiece * quantityPieces;
            }
          }

          // 调试日志：输出重量计算详情
          if (productId && index === 0) {
            // 只输出第一个产品的调试信息，避免刷屏
            logger.debug('sales-orders', '重量计算调试 [第1个产品]', {
              productCode: product?.code,
              productName: product?.name,
              batchNumber: item.batchNumber,
              displayUnit: item.displayUnit,
              displayQuantity: item.displayQuantity,
              quantityPieces,
              effectivePiecesPerUnit,
              batchWeight: batchSpec?.weight,
              productWeight: product?.weight,
              weightPerUnit,
              calculatedWeightKg: weightKg,
            });
          }
        }

        if (!weightKg || !Number.isFinite(weightKg)) {
          return sum;
        }

        return sum + weightKg;
      }, 0),
    [watchedItems, productMap]
  );

  // 是否存在库存不足的产品（用于禁用“提交订单”按钮）
  const hasInventoryShortage = React.useMemo(() => {
    const currentOrderType = orderType;
    const currentTransferMode = transferMode;

    const shouldCheckInventory =
      currentOrderType !== 'TRANSFER' || currentTransferMode === 'MIXED';

    if (!shouldCheckInventory || !watchedItems || watchedItems.length === 0) {
      return false;
    }

    const requestedByProduct = new Map<string, number>();

    for (const item of watchedItems) {
      if (!item || !item.productId || item.isManualProduct) continue;

      const productId = item.productId.toString().trim();
      if (!productId) continue;

      const effectiveQty =
        currentOrderType === 'TRANSFER' && currentTransferMode === 'MIXED'
          ? Number(item.localQuantity ?? 0)
          : Number(item.quantity ?? 0);

      if (!Number.isFinite(effectiveQty) || effectiveQty <= 0) continue;

      requestedByProduct.set(
        productId,
        (requestedByProduct.get(productId) ?? 0) + effectiveQty
      );
    }

    for (const [productId, requestedQty] of requestedByProduct.entries()) {
      const product = productMap.get(productId);
      const available = product?.inventory?.availableQuantity;

      if (
        available !== undefined &&
        Number.isFinite(available) &&
        available < requestedQty
      ) {
        return true;
      }
    }

    return false;
  }, [orderType, transferMode, watchedItems, productMap]);

  // 添加产品
  const addOrderItem = () => {
    append({
      productId: '',
      productCode: '',
      batchNumber: '',
      colorCode: '',
      productionDate: '',
      specification: '',
      unit: '',
      displayUnit: '片' as const,
      displayQuantity: 1,
      quantity: 1,
      unitPrice: 0,
      unitCost: undefined,
      costSubtotal: undefined,
      profitAmount: undefined,
      localQuantity: undefined,
      transferQuantity: undefined,
      piecesPerUnit: undefined,
      subtotal: 0,
      remarks: '',
      isManualProduct: false,
      manualProductName: '',
      manualSpecification: '',
      manualWeight: undefined,
      manualUnit: '',
      weightPerPieceKg: undefined,
    });
  };

  // 自动生成订单号状态
  const [autoOrderNumber, setAutoOrderNumber] = React.useState<string>('');

  const creationDisplayDate = React.useMemo(() => {
    if (mode === 'edit' && initialData?.createdAt) {
      const parsedDate = new Date(initialData.createdAt);
      if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }
    return new Date();
  }, [mode, initialData?.createdAt]);

  const initializedOrderRef = React.useRef<string | null>(null);

  // 编辑模式：填充初始数据
  React.useEffect(() => {
    if (mode !== 'edit') {
      initializedOrderRef.current = null;
      return;
    }

    if (!initialData) {
      return;
    }

    const orderKey =
      [initialData.id, initialData.orderNumber, initialData.updatedAt]
        .filter(Boolean)
        .join('__') || 'unknown-order';

    if (initializedOrderRef.current === orderKey) {
      return;
    }

    initializedOrderRef.current = orderKey;

    const mappedItems: SalesOrderItemFormData[] = (initialData.items ?? []).map(
      (item: SalesOrderItem) => {
        const product = item.product;
        const normalizedUnit =
          product?.unit && typeof product.unit === 'string'
            ? (UNIT_MAPPING[
                product.unit.toLowerCase() as keyof typeof UNIT_MAPPING
              ] ?? product.unit)
            : (product?.unit ?? '');

        return {
          productId: item.productId ?? '',
          productCode: item.productCode ?? product?.code ?? '',
          batchNumber: item.batchNumber ?? '',
          colorCode: item.colorCode ?? '',
          productionDate: item.productionDate ?? '',
          specification: item.specification ?? product?.specification ?? '',
          unit: normalizedUnit,
          displayUnit: (item.displayUnit as '片' | '件' | null) ?? '片',
          displayQuantity: item.displayQuantity ?? item.quantity ?? 0,
          quantity: item.quantity ?? 0,
          unitPrice: item.unitPrice ?? 0,
          unitCost: item.unitCost ?? undefined,
          costSubtotal: item.costSubtotal ?? undefined,
          profitAmount: item.profitAmount ?? undefined,
          piecesPerUnit:
            item.piecesPerUnit ?? product?.piecesPerUnit ?? undefined,
          remarks: item.remarks ?? '',
          subtotal:
            item.subtotal ?? (item.quantity ?? 0) * (item.unitPrice ?? 0),
          isManualProduct: item.isManualProduct ?? false,
          manualProductName: item.manualProductName ?? '',
          manualSpecification: item.manualSpecification ?? '',
          manualWeight: item.manualWeight ?? undefined,
          manualUnit: item.manualUnit ?? '',
          localQuantity: item.localQuantity ?? undefined,
          transferQuantity: item.transferQuantity ?? undefined,
          weightPerPieceKg: undefined,
        };
      }
    );

    form.reset({
      orderNumber: initialData.orderNumber,
      customerId: initialData.customerId,
      status: initialData.status,
      orderType: initialData.orderType,
      transferMode:
        (initialData.transferMode as TransferFulfillmentMode | undefined) ??
        'SUPPLIER_ONLY',
      supplierId: initialData.supplierId ?? '',
      remarks: initialData.remarks ?? '',
      roundingAdjustment: initialData.roundingAdjustment ?? undefined,
      items: mappedItems,
      feeItems: Array.isArray(initialData.feeItems)
        ? initialData.feeItems.map(fee => ({
            id: fee.id ?? undefined,
            feeType: fee.feeType,
            feeName: fee.feeName,
            feeAmount: fee.feeAmount,
            paidBy: fee.paidBy ?? getDefaultFeePaidBy(fee.feeType),
            remarks: fee.remarks ?? '',
          }))
        : [],
    });
  }, [form, mode, initialData]);

  // 页面加载时设置订单号（仅创建模式）
  // 优化：优先使用服务端预生成的订单号，消除加载延迟
  React.useEffect(() => {
    if (mode !== 'create') {
      return;
    }

    // 如果有预生成的订单号，直接使用
    if (initialOrderNumber) {
      setAutoOrderNumber(initialOrderNumber);
      return;
    }

    // 降级方案：客户端异步生成（保持向后兼容）
    const abortController = new AbortController();

    const generateOrderNumber = async () => {
      const generateLocalOrderNumber = () => {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = now.getTime().toString().slice(-4);
        return `SO${dateStr}${timeStr}`;
      };

      try {
        const response = await fetch(
          '/api/sales-orders/generate-order-number',
          getCsrfTokenHeader({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            signal: abortController.signal,
          })
        );

        // 检查是否已被取消
        if (abortController.signal.aborted) {
          return;
        }

        const data = await response.json();
        if (response.ok && data?.success && data.data?.orderNumber) {
          setAutoOrderNumber(data.data.orderNumber);
          return;
        }

        // 接口可达但未成功，降级到本地生成
        logger.warn('sales-orders', '自动生成订单号返回非成功结果', undefined, {
          status: response.status,
          body: data,
        });
        setAutoOrderNumber(generateLocalOrderNumber());
      } catch (error) {
        // 如果是取消请求，不处理
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        logger.error('sales-orders', '自动生成订单号失败', error);
        // 如果API失败，使用本地生成逻辑作为备用
        setAutoOrderNumber(generateLocalOrderNumber());
      }
    };

    generateOrderNumber();

    // cleanup: 取消 pending 的请求
    return () => {
      abortController.abort();
    };
  }, [mode, initialOrderNumber]);

  // 客户创建成功处理（客户数据查询已移至 CustomerSelector 组件内部）
  const handleCustomerCreated = (customer: Customer) => {
    // CustomerSelector 组件会自动处理新创建的客户
    toast({
      title: '客户创建成功',
      description: `客户 "${customer.name}" 已创建并自动选择`,
      variant: 'success',
    });
  };
  const handleCustomerResolved = React.useCallback(
    (customer: Customer | undefined) => {
      setResolvedCustomer(customer ?? null);
    },
    []
  );

  const handleSupplierCreated = (supplier: Supplier) => {
    // ✅ 确保新建供应商后，订单仍保持在“调货销售”模式
    // 在正常流程里，只有 orderType === 'TRANSFER' 时才会渲染供应商选择器并允许快速新增。
    // 这里做一次兜底：如果因为某些原因被重置为 NORMAL，则强制切回 TRANSFER，避免用户状态被悄悄改变。
    const currentOrderType = form.getValues('orderType');
    if (currentOrderType !== 'TRANSFER') {
      form.setValue('orderType', 'TRANSFER', {
        shouldDirty: true,
        shouldValidate: false,
      });
    }

    queryClient.setQueryData<SuppliersResponse | undefined>(
      suppliersQueryKey,
      (previous: SuppliersResponse | undefined) => {
        if (!previous) {
          return {
            data: [supplier],
            pagination: {
              page: suppliersQueryParams.page,
              limit: suppliersQueryParams.limit,
              total: 1,
              totalPages: 1,
            },
          };
        }

        const existingIndex = previous.data.findIndex(
          (existing: Supplier) => existing.id === supplier.id
        );

        const updatedData =
          existingIndex >= 0
            ? previous.data.map((item: Supplier, index: number) =>
                index === existingIndex ? supplier : item
              )
            : [supplier, ...previous.data].slice(
                0,
                previous.pagination?.limit ?? previous.data.length + 1
              );

        if (!previous.pagination) {
          return {
            ...previous,
            data: updatedData,
          };
        }

        const previousTotal =
          typeof previous.pagination.total === 'number'
            ? previous.pagination.total
            : previous.data.length;
        const newTotal = existingIndex >= 0 ? previousTotal : previousTotal + 1;

        const updatedPagination = {
          ...previous.pagination,
          total: newTotal,
          totalPages:
            previous.pagination.limit && previous.pagination.limit > 0
              ? Math.ceil(newTotal / previous.pagination.limit)
              : previous.pagination.totalPages,
        };

        return {
          ...previous,
          data: updatedData,
          pagination: updatedPagination,
        };
      }
    );

    form.setValue('supplierId', supplier.id, {
      shouldDirty: true,
      shouldTouch: true,
    });

    toast({
      title: '供应商创建成功',
      description: `供应商 "${supplier.name}" 已创建并自动选择`,
      variant: 'success',
    });
  };

  // 提交表单
  // Zod schema 验证已经在 React Hook Form 中自动执行
  const onSubmit = (data: CreateSalesOrderData) => {
    if (mode === 'edit' && orderId) {
      // 编辑模式：更新现有订单
      const formDataForTransform = mapFormDataForTransform(data);
      const apiData = transformFormDataToUpdateInput(
        orderId,
        formDataForTransform
      );
      updateMutation.mutate(apiData);
    } else {
      const formDataForTransform = mapFormDataForTransform(data);
      const apiData = transformFormDataToCreateInput(formDataForTransform);
      createMutation.mutate(apiData);
    }
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      const isCustomerValid = await form.trigger('customerId');
      if (!isCustomerValid) {
        try {
          form.setFocus('customerId');
        } catch (error) {
          logger.debug(
            'sales-orders',
            'Failed to focus customer field on base submit',
            error
          );
        }
        toast({
          variant: 'destructive',
          title: '客户未选择',
          description: '请选择客户后再保存订单。',
        });
        return;
      }

      await form.handleSubmit(onSubmit)();
    })();
  };

  const submitWithStatus = (status: SalesOrderStatus) => {
    const snapshot = form.getValues();
    if (!snapshot.customerId || snapshot.customerId.trim() === '') {
      form.setError('customerId', {
        type: 'manual',
        message: '请选择客户',
      });
      try {
        form.setFocus('customerId');
      } catch (error) {
        logger.debug('sales-orders', 'Failed to focus customer field', error);
      }
      toast({
        variant: 'destructive',
        title: '客户未选择',
        description: '请选择客户后再保存订单。',
      });
      return;
    }

    // 提交为“已确认”时，先在前端做一次库存充足性快速检查
    // 目的：在点击提交前就给销售明确提示，减少来回修改的次数
    if (status === 'confirmed') {
      const currentOrderType = snapshot.orderType;
      const currentTransferMode = snapshot.transferMode as
        | TransferFulfillmentMode
        | undefined;

      // 与后端库存预留逻辑保持一致：
      // - 普通销售：检查本地库存
      // - 调货销售：只在 MIXED 模式下检查本地库存
      const shouldCheckInventory =
        currentOrderType !== 'TRANSFER' || currentTransferMode === 'MIXED';

      if (shouldCheckInventory && watchedItems.length > 0) {
        const requestedByProduct = new Map<string, number>();

        for (const item of watchedItems) {
          if (!item || !item.productId || item.isManualProduct) {
            continue;
          }

          const productId = item.productId.toString().trim();
          if (!productId) continue;

          const effectiveQty =
            currentOrderType === 'TRANSFER' && currentTransferMode === 'MIXED'
              ? Number(item.localQuantity ?? 0)
              : Number(item.quantity ?? 0);

          if (!Number.isFinite(effectiveQty) || effectiveQty <= 0) {
            continue;
          }

          requestedByProduct.set(
            productId,
            (requestedByProduct.get(productId) ?? 0) + effectiveQty
          );
        }

        const shortageMessages: string[] = [];

        requestedByProduct.forEach((requestedQty, productId) => {
          const product = productMap.get(productId);
          const available = product?.inventory?.availableQuantity ?? undefined;

          if (
            available !== undefined &&
            Number.isFinite(available) &&
            available < requestedQty
          ) {
            const name = product?.name || '未知产品';
            const code = product?.code || productId;
            shortageMessages.push(
              `[${code}] ${name}：可用 ${available} 片，需要 ${requestedQty} 片`
            );
          }
        });

        if (shortageMessages.length > 0) {
          toast({
            variant: 'destructive',
            title: '库存不足，无法提交为已确认',
            description:
              shortageMessages.length === 1
                ? shortageMessages[0]
                : `以下产品库存不足：\n${shortageMessages.join('\n')}`,
          });
          return;
        }
      }
    }

    // Zod schema 验证会在 handleSubmit 中自动执行
    form.setValue('status', status, {
      shouldDirty: true,
      shouldValidate: false,
    });
    void form.handleSubmit(onSubmit, errors => {
      const firstError = findFirstError(errors);

      if (firstError?.path) {
        try {
          form.setFocus(firstError.path);
        } catch (error) {
          logger.debug(
            'sales-orders',
            'Failed to focus first error field',
            firstError.path,
            error
          );
        }
      }

      toast({
        variant: 'destructive',
        title: '请检查订单信息',
        description: firstError?.message || '部分字段填写不完整，请检查后再试',
      });
    })();
  };

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {/* ERP标准布局：基本信息区域 */}
          <div className="bg-card rounded-lg border shadow-sm">
            <div className="border-b bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-bg-secondary))] px-4 py-2.5">
              <h3 className="text-sm font-semibold text-gray-700">基本信息</h3>
            </div>
            <div className="p-4">
              {/* 第一行：订单号和创建日期 */}
              <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {/* 订单号 */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">
                    订单号
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-md border border-[hsl(var(--color-primary-light))] bg-[hsl(var(--color-primary-light))] px-3 py-1.5 font-mono text-sm font-medium text-[hsl(var(--color-primary))]">
                      {mode === 'edit'
                        ? form.watch('orderNumber') || initialData?.orderNumber
                        : autoOrderNumber || '正在生成...'}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    {mode === 'edit'
                      ? '编辑现有订单'
                      : '系统将自动生成唯一订单号'}
                  </p>
                </div>

                {/* 创建日期 */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">
                    创建日期
                  </Label>
                  <div className="rounded-md border bg-gray-50 px-3 py-1.5 text-sm text-gray-700">
                    {formatDate(creationDisplayDate.toISOString())}
                  </div>
                </div>
              </div>

              {/* 第二行：客户和订单类型 */}
              <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {/* 客户名称 */}
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-sm font-medium text-gray-700">
                        客户名称 <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <CustomerSelector
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="搜索并选择客户"
                          onCustomerCreated={handleCustomerCreated}
                          onCustomerResolved={handleCustomerResolved}
                          initialCustomer={initialData?.customer}
                          className="h-9"
                          onBlur={field.onBlur}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                {/* 订单类型 */}
                <FormField
                  control={form.control}
                  name="orderType"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-sm font-medium text-gray-700">
                        订单类型 <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={value => {
                            field.onChange(value);
                            // 把最近一次的选择记到 sessionStorage，防止刷新/重载后丢失
                            if (typeof window !== 'undefined') {
                              window.sessionStorage.setItem(
                                ORDER_TYPE_STORAGE_KEY,
                                value
                              );
                            }
                          }}
                          className="flex flex-row space-x-8 pt-1.5"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="NORMAL" id="normal" />
                            <Label
                              htmlFor="normal"
                              className="cursor-pointer text-sm font-normal"
                            >
                              正常销售
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="TRANSFER" id="transfer" />
                            <Label
                              htmlFor="transfer"
                              className="cursor-pointer text-sm font-normal"
                            >
                              调货销售
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>

              {/* 第三行：客户地址 */}
              {selectedCustomerId && (
                <div className="mb-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">
                      客户地址
                    </Label>
                    <div className="flex min-h-[36px] items-center rounded-md border bg-gray-50 px-3 py-1.5 text-sm text-gray-700">
                      {resolvedCustomer ? (
                        resolvedCustomer.address?.trim() ? (
                          <span className="truncate">
                            {resolvedCustomer.address.trim()}
                          </span>
                        ) : (
                          <span className="text-gray-400">
                            该客户暂无地址，可在客户资料中维护
                          </span>
                        )
                      ) : (
                        <span className="text-gray-400">
                          正在加载客户地址...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 调货销售特殊字段 */}
              {orderType === 'TRANSFER' && (
                <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50/50 p-3">
                  <h4 className="mb-3 text-sm font-semibold text-orange-800">
                    调货销售信息
                  </h4>

                  {/* 供应商未选择警告 */}
                  {!supplierId && (
                    <Alert className="mb-3 border-amber-300 bg-amber-50">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-sm text-amber-800">
                        <strong>提示：</strong>
                        调货订单需要选择供应商才能添加产品。请先在下方选择供应商。
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <FormField
                      control={form.control}
                      name="transferMode"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5 md:col-span-3">
                          <FormLabel className="text-sm font-medium text-gray-700">
                            调货履约模式 <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <RadioGroup
                              value={field.value ?? 'SUPPLIER_ONLY'}
                              onValueChange={value =>
                                field.onChange(value as TransferFulfillmentMode)
                              }
                              className="grid gap-3 md:grid-cols-2"
                            >
                              <div className="border-border flex items-start gap-2 rounded-md border bg-white/80 p-3 shadow-sm">
                                <RadioGroupItem
                                  value="SUPPLIER_ONLY"
                                  id="transfer-mode-supplier"
                                  className="mt-0.5"
                                />
                                <div className="space-y-1">
                                  <Label
                                    htmlFor="transfer-mode-supplier"
                                    className="cursor-pointer text-sm font-medium text-gray-700"
                                  >
                                    {TRANSFER_MODE_LABELS.SUPPLIER_ONLY}
                                  </Label>
                                  <p className="text-xs text-gray-500">
                                    订单全部由供应商调货发出，本地仓无需参与。
                                  </p>
                                </div>
                              </div>
                              <div className="border-border flex items-start gap-2 rounded-md border bg-white/80 p-3 shadow-sm">
                                <RadioGroupItem
                                  value="MIXED"
                                  id="transfer-mode-mixed"
                                  className="mt-0.5"
                                />
                                <div className="space-y-1">
                                  <Label
                                    htmlFor="transfer-mode-mixed"
                                    className="cursor-pointer text-sm font-medium text-gray-700"
                                  >
                                    {TRANSFER_MODE_LABELS.MIXED}
                                  </Label>
                                  <p className="text-xs text-gray-500">
                                    本地仓与供应商共同完成发货，可在订单明细中拆分数量。
                                  </p>
                                </div>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />

                    {/* 供应商选择 */}
                    <FormField
                      control={form.control}
                      name="supplierId"
                      render={({ field }) => (
                        <FormItem className="space-y-1.5">
                          <FormLabel className="text-sm font-medium text-gray-700">
                            供应商/调出方{' '}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <SupplierSelector
                              suppliers={suppliersData?.data || []}
                              value={field.value}
                              onValueChange={value => {
                                // ✅ 先确保订单类型是"调货销售"，再设置供应商ID
                                // 这样可以避免field.onChange触发的副作用导致orderType被重置
                                if (
                                  form.getValues('orderType') !== 'TRANSFER'
                                ) {
                                  form.setValue('orderType', 'TRANSFER', {
                                    shouldDirty: true,
                                    shouldValidate: false,
                                  });
                                }
                                field.onChange(value);
                              }}
                              placeholder="搜索并选择供应商"
                              disabled={suppliersLoading}
                              isLoading={suppliersLoading}
                              onSupplierCreated={handleSupplierCreated}
                              onRefreshSuppliers={() => {
                                queryClient.invalidateQueries({
                                  queryKey: suppliersQueryKey,
                                });
                                queryClient.refetchQueries({
                                  queryKey: suppliersQueryKey,
                                });
                              }}
                              className="h-9"
                              onBlur={field.onBlur}
                            />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <OrderItemsSection
            fields={fields}
            remove={remove}
            onAddItem={addOrderItem}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
            products={productsData?.data || []}
            orderType={orderType}
            transferMode={transferMode}
            unitMapping={UNIT_MAPPING}
            form={form}
            selectedCustomerId={selectedCustomerId}
            supplierId={supplierId}
            priceHistory={priceHistoryData?.data}
            priceType={priceType}
            toast={toast}
          />

          {/* 费用项管理 */}
          <div className="bg-card rounded border">
            <div className="bg-muted/30 border-b px-3 py-2">
              <h3 className="text-sm font-medium">费用项管理</h3>
            </div>
            <div className="space-y-3 p-3">
              <FeeItemsFormField
                control={form.control}
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>
          </div>

          {/* 预收款冲抵 */}
          <div className="bg-card rounded border">
            <div className="bg-muted/30 border-b px-3 py-2">
              <h3 className="text-sm font-medium">预收款冲抵</h3>
            </div>
            <div className="p-3">
              <PrepaymentSection
                form={form}
                customerId={form.watch('customerId')}
                orderTotal={orderTotalWithFees}
                disabled={createMutation.isPending || updateMutation.isPending}
              />
            </div>
          </div>

          {/* ERP标准布局：汇总信息 */}
          <div className="bg-card rounded border">
            <div className="bg-muted/30 border-b px-3 py-2">
              <h3 className="text-sm font-medium">汇总信息</h3>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5 xl:grid-cols-6">
                <div className="flex items-center justify-between rounded border bg-[hsl(var(--color-primary-light))] px-3 py-2">
                  <span className="text-muted-foreground text-xs">
                    产品种类
                  </span>
                  <span className="text-sm font-semibold text-[hsl(var(--color-primary))]">
                    {fields.length} 种
                  </span>
                </div>
                <div className="flex items-center justify-between rounded border bg-green-50/50 px-3 py-2">
                  <span className="text-muted-foreground text-xs">总数量</span>
                  <span className="text-sm font-semibold text-green-600">
                    {totalQuantityPieces.toLocaleString('zh-CN', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}{' '}
                    片
                  </span>
                </div>
                <div className="flex items-center justify-between rounded border bg-purple-50/50 px-3 py-2">
                  <span className="text-muted-foreground text-xs">总重量</span>
                  <span className="text-sm font-semibold text-purple-600">
                    {formatWeight(totalWeight)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded border bg-orange-50/50 px-3 py-2">
                  <span className="text-muted-foreground text-xs">
                    产品金额
                  </span>
                  <span className="text-lg font-bold text-orange-600">
                    ￥{formatCurrency(totalAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded border bg-amber-50/60 px-3 py-2">
                  <span className="text-muted-foreground text-xs">
                    客户承担费用
                  </span>
                  <span className="text-sm font-semibold text-amber-600">
                    ￥{formatCurrency(customerPaidFees)}
                  </span>
                </div>
                {companyPaidFees > 0 && (
                  <div className="flex items-center justify-between rounded border bg-slate-100 px-3 py-2">
                    <span className="text-muted-foreground text-xs">
                      公司承担费用（计入成本）
                    </span>
                    <span className="text-sm font-semibold text-slate-700">
                      ￥{formatCurrency(companyPaidFees)}
                    </span>
                  </div>
                )}
                {Math.abs(roundingAdjustment) > 0.0001 && (
                  <div className="flex items-center justify-between rounded border bg-slate-50 px-3 py-2">
                    <span className="text-muted-foreground text-xs">
                      抹零调整
                    </span>
                    <span className="text-sm font-semibold text-slate-700">
                      ￥{formatCurrency(roundingAdjustment)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between rounded border bg-orange-100 px-3 py-2">
                  <span className="text-muted-foreground text-xs">
                    订单总金额
                  </span>
                  <span className="text-lg font-bold text-orange-700">
                    ￥{formatCurrency(orderTotalWithFees)}
                  </span>
                </div>

                {orderType === 'TRANSFER' && (
                  <div className="flex items-center justify-between rounded border bg-sky-50 px-3 py-2">
                    <span className="text-muted-foreground text-xs">
                      履约模式
                    </span>
                    <span className="text-sm font-semibold text-sky-700">
                      {transferMode
                        ? TRANSFER_MODE_LABELS[transferMode]
                        : TRANSFER_MODE_LABELS.SUPPLIER_ONLY}
                    </span>
                  </div>
                )}
                {orderType === 'TRANSFER' && (
                  <div className="flex items-center justify-between rounded border bg-sky-50/80 px-3 py-2">
                    <span className="text-muted-foreground text-xs">
                      调货数量
                    </span>
                    <span className="text-sm font-semibold text-sky-700">
                      {formatPieces(totalTransferQuantity)}
                    </span>
                  </div>
                )}
                {orderType === 'TRANSFER' && transferMode === 'MIXED' && (
                  <div className="flex items-center justify-between rounded border bg-emerald-50/70 px-3 py-2">
                    <span className="text-muted-foreground text-xs">
                      本地发货数量
                    </span>
                    <span className="text-sm font-semibold text-emerald-700">
                      {formatPieces(totalLocalQuantity)}
                    </span>
                  </div>
                )}

                {/* 调货销售财务汇总 */}
                {orderType === 'TRANSFER' && (
                  <div className="flex items-center justify-between rounded border bg-[hsl(var(--color-primary-light))] px-3 py-2">
                    <span className="text-muted-foreground text-xs">
                      总成本
                    </span>
                    <span className="text-sm font-semibold text-[hsl(var(--color-primary))]">
                      ￥{formatCurrency(totalTransferCost)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 库存检查 */}
          {watchedItems.length > 0 && (
            <InventoryChecker
              items={inventoryCheckItems}
              products={productsData?.data || []}
              onInventoryCheck={() => {
                // 处理库存检查结果
              }}
            />
          )}

          {/* ERP标准布局：操作按钮 */}
          <div className="bg-card sticky bottom-0 rounded border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onCancel?.() || router.back()}
                  disabled={createMutation.isPending}
                  className="h-8 text-xs"
                >
                  取消
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    createMutation.isPending ||
                    updateMutation.isPending ||
                    !form.watch('customerId')
                  }
                  className="h-8 text-xs"
                  onClick={() => submitWithStatus('draft')}
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-3 w-3" />
                  )}
                  {mode === 'edit' ? '保存草稿' : '保存草稿'}
                </Button>
                <Button
                  type="button"
                  disabled={
                    createMutation.isPending ||
                    updateMutation.isPending ||
                    fields.length === 0 ||
                    !form.watch('customerId') ||
                    hasInventoryShortage
                  }
                  className="h-8 text-xs"
                  onClick={() => submitWithStatus('confirmed')}
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-3 w-3" />
                  )}
                  {mode === 'edit' ? '更新并确认' : '提交订单'}
                </Button>
              </div>
            </div>

            <div className="mt-2 text-center">
              <p className="text-xs text-gray-500">
                保存草稿：可随时修改；提交订单：确认后进入处理流程
              </p>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
