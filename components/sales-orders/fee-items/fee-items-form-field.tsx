/**
 * FeeItems FormField - 主容器组件
 *
 * 集成 React Hook Form 的 useFieldArray
 * 使用复合组件模式提供清晰的组件结构
 */

'use client';

import React from 'react';
import { useFieldArray, type Control } from 'react-hook-form';

import { FeeItemsProvider } from './fee-items-context';
import { FeeItemsHeader } from './fee-items-header';
import { FeeItemsList } from './fee-items-list';
import { FeeItemsSummary } from './fee-items-summary';

interface FeeItemsFormFieldProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  disabled?: boolean;
}

/**
 * 费用项动态表单字段组件
 *
 * 核心功能:
 * - 集成 React Hook Form 的 useFieldArray
 * - 提供共享状态给子组件 (通过 Context)
 * - 使用复合组件模式实现清晰的组件结构
 *
 * 使用方式:
 * ```tsx
 * <FormField
 *   control={form.control}
 *   name="feeItems"
 *   render={() => (
 *     <FormItem>
 *       <FeeItemsFormField control={form.control} />
 *     </FormItem>
 *   )}
 * />
 * ```
 */
export function FeeItemsFormField({
  control,
  disabled = false,
}: FeeItemsFormFieldProps) {
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: 'feeItems',
    // ⚠️ 关键: 使用 field.id 作为 key,而非 index
    // 这样可以避免在删除或重新排序时表单状态混乱
    keyName: 'key',
  });

  return (
    <FeeItemsProvider
      value={{
        fields,
        append,
        remove,
        update,
        isDisabled: disabled,
      }}
    >
      <div className="space-y-4" role="region" aria-label="费用项管理">
        <FeeItemsHeader />
        <FeeItemsList />
        <FeeItemsSummary />
      </div>
    </FeeItemsProvider>
  );
}
