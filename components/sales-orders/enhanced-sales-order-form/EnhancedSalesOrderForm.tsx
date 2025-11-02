'use client';

import type { FieldArrayWithId, UseFormReturn } from 'react-hook-form';

import { Form } from '@/components/ui/form';
import type { Customer } from '@/lib/types/customer';
import type { Product } from '@/lib/types/product';
import type { SalesOrderCreateFormData as CreateSalesOrderData } from '@/lib/validations/sales-order';
import type { SalesOrderItemFormData } from '@/lib/validations/sales-order/schemas';

import { BasicInfoCard } from './BasicInfoCard';
import { FormActionsBar } from './FormActionsBar';
import { useOrderItemsManager } from './hooks/useOrderItemsManager';
import { useSalesOrderBasics } from './hooks/useSalesOrderBasics';
import { useSalesOrderSubmission } from './hooks/useSalesOrderSubmission';
import {
  InventoryCheckerSection,
  type InventoryCheckHandler,
} from './InventoryCheckerSection';
import { OrderInfoCard } from './OrderInfoCard';
import { OrderItemsCard } from './OrderItemsCard';
import { OrderSummaryCard } from './OrderSummaryCard';
import { SalesOrderHeader } from './SalesOrderHeader';

interface EnhancedSalesOrderFormProps {
  initialOrderNumber?: string; // 新增：服务端预生成的订单号
  onSuccess?: (order: unknown) => void;
  onCancel?: () => void;
}

export function EnhancedSalesOrderForm(props: EnhancedSalesOrderFormProps) {
  const controller = useEnhancedSalesOrderFormController(props);
  return <EnhancedSalesOrderFormView {...controller} />;
}

interface EnhancedSalesOrderFormViewProps {
  form: UseFormReturn<CreateSalesOrderData>;
  autoOrderNumber: string;
  customers: Customer[];
  customersLoading: boolean;
  selectedCustomer: Customer | null;
  customerId: string;
  status: CreateSalesOrderData['status'];
  orderNumber?: string;
  totalAmount: number;
  totalQuantity: number;
  stockWarnings: Record<number, string>;
  fields: FieldArrayWithId<CreateSalesOrderData, 'items', 'id'>[];
  products: Product[];
  isSubmitting: boolean;
  handleGenerateOrderNumber: () => Promise<void>;
  handleInventoryCheck: InventoryCheckHandler;
  addOrderItem: () => void;
  removeOrderItem: (index: number) => void;
  updateOrderItem: <Key extends keyof SalesOrderItemFormData>(
    index: number,
    field: Key,
    value: SalesOrderItemFormData[Key]
  ) => void;
  handleProductSelect: (productId: string, index: number) => void;
  handleCancel: () => void;
  handleSaveDraft: () => void;
  handleSubmitOrder: () => void;
  onSubmit: (data: CreateSalesOrderData) => void;
}

function EnhancedSalesOrderFormView({
  form,
  autoOrderNumber,
  customers,
  customersLoading,
  selectedCustomer,
  customerId,
  status,
  orderNumber,
  totalAmount,
  totalQuantity,
  stockWarnings,
  fields,
  products,
  isSubmitting,
  handleGenerateOrderNumber,
  handleInventoryCheck,
  addOrderItem,
  removeOrderItem,
  updateOrderItem,
  handleProductSelect,
  handleCancel,
  handleSaveDraft,
  handleSubmitOrder,
  onSubmit,
}: EnhancedSalesOrderFormViewProps) {
  return (
    <div className="space-y-6">
      <SalesOrderHeader onBack={handleCancel} />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <BasicInfoCard
            form={form}
            autoOrderNumber={autoOrderNumber}
            customers={customers}
            customersLoading={customersLoading}
            selectedCustomer={selectedCustomer}
          />

          <OrderInfoCard
            form={form}
            orderNumber={orderNumber}
            isBusy={isSubmitting}
            onGenerateOrderNumber={handleGenerateOrderNumber}
          />

          <OrderSummaryCard
            totalAmount={totalAmount}
            itemCount={fields.length}
            totalQuantity={totalQuantity}
            stockWarningCount={Object.keys(stockWarnings).length}
          />

          <InventoryCheckerSection
            fields={fields}
            products={products}
            onInventoryCheck={handleInventoryCheck}
          />

          <OrderItemsCard
            fields={fields}
            products={products}
            stockWarnings={stockWarnings}
            onAddItem={addOrderItem}
            onRemoveItem={removeOrderItem}
            onUpdateItem={updateOrderItem}
            onProductSelect={handleProductSelect}
          />

          <FormActionsBar
            onCancel={handleCancel}
            onSaveDraft={handleSaveDraft}
            onSubmitOrder={handleSubmitOrder}
            isBusy={isSubmitting}
            hasCustomer={Boolean(customerId)}
            hasItems={fields.length > 0}
            activeStatus={status}
          />
        </form>
      </Form>
    </div>
  );
}

function useEnhancedSalesOrderFormController({
  initialOrderNumber,
  onSuccess,
  onCancel,
}: EnhancedSalesOrderFormProps): EnhancedSalesOrderFormViewProps {
  const basics = useSalesOrderBasics(onCancel, initialOrderNumber);
  const items = useOrderItemsManager(basics.form, basics.products);
  const submission = useSalesOrderSubmission(
    basics.form,
    onSuccess,
    basics.toast
  );

  return {
    form: basics.form,
    autoOrderNumber: basics.autoOrderNumber,
    customers: basics.customers,
    customersLoading: basics.customersLoading,
    selectedCustomer: basics.selectedCustomer,
    customerId: basics.customerId,
    status: basics.status,
    orderNumber: basics.orderNumber,
    totalAmount: items.totalAmount,
    totalQuantity: items.totalQuantity,
    stockWarnings: items.stockWarnings,
    fields: items.fields,
    products: basics.products,
    isSubmitting: submission.isSubmitting,
    handleGenerateOrderNumber: basics.handleGenerateOrderNumber,
    handleInventoryCheck: items.handleInventoryCheck,
    addOrderItem: items.addOrderItem,
    removeOrderItem: items.removeOrderItem,
    updateOrderItem: items.updateOrderItem,
    handleProductSelect: items.handleProductSelect,
    handleCancel: basics.handleCancel,
    handleSaveDraft: submission.handleSaveDraft,
    handleSubmitOrder: submission.handleSubmitOrder,
    onSubmit: submission.onSubmit,
  };
}
