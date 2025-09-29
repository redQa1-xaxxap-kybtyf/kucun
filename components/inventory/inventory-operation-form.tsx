/**
 * 重构后的库存操作表单组件
 * 拆分为更小的子组件和自定义hooks，遵循单一职责原则
 */

'use client';

import { AlertCircle, Package, TrendingDown, TrendingUp } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Form } from '@/components/ui/form';
import {
  type InboundRecord,
  type Inventory,
  type OutboundRecord,
} from '@/lib/types/inventory';

import { InventoryAvailabilityAlert } from './forms/InventoryAvailabilityAlert';
import { InventoryBasicInfoForm } from './forms/InventoryBasicInfoForm';
import { InventoryDetailForm } from './forms/InventoryDetailForm';
import { InventoryFormActions } from './forms/InventoryFormActions';
import { InventoryFormHeader } from './forms/InventoryFormHeader';
import {
  type OperationMode,
  useInventoryOperationForm,
} from './hooks/useInventoryOperationForm';

interface InventoryOperationFormProps {
  mode: OperationMode;
  onSuccess?: (result: InboundRecord | OutboundRecord | Inventory) => void;
  onCancel?: () => void;
}

export function InventoryOperationForm({
  mode,
  onSuccess,
  onCancel,
}: InventoryOperationFormProps) {
  const {
    form,
    formConfig,
    availabilityData,
    submitError,
    isLoading,
    onSubmit,
    getTypeOptions,
  } = useInventoryOperationForm({ mode, onSuccess });

  // 获取图标组件
  const getIconComponent = () => {
    switch (mode) {
      case 'inbound':
        return TrendingUp;
      case 'outbound':
        return TrendingDown;
      case 'adjust':
        return Package;
      default:
        return Package;
    }
  };

  const IconComponent = getIconComponent();

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* 页面标题 */}
      <InventoryFormHeader
        title={formConfig.title}
        description={formConfig.description}
        IconComponent={IconComponent}
        onCancel={onCancel}
      />

      {/* 错误提示 */}
      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {/* 库存可用性检查结果 */}
      <InventoryAvailabilityAlert
        availabilityData={availabilityData || null}
        mode={mode}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 基础信息表单 */}
          <InventoryBasicInfoForm
            control={form.control}
            mode={mode}
            typeOptions={getTypeOptions()}
            isLoading={isLoading}
          />

          {/* 详细信息表单 */}
          <InventoryDetailForm
            control={form.control}
            mode={mode}
            isLoading={isLoading}
          />

          {/* 操作按钮 */}
          <InventoryFormActions
            mode={mode}
            isLoading={isLoading}
            onCancel={onCancel}
          />
        </form>
      </Form>
    </div>
  );
}
