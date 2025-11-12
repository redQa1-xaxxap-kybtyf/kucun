/**
 * FeeItems Context Provider
 *
 * 使用 React Context 在复合组件之间共享状态
 * 实现 Compound Components 模式
 */

'use client';

import { createContext, useContext } from 'react';
import type { UseFieldArrayReturn } from 'react-hook-form';

interface FeeItemsContextValue {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields: UseFieldArrayReturn<any, 'feeItems', 'key'>['fields'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  append: UseFieldArrayReturn<any, 'feeItems', 'key'>['append'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  remove: UseFieldArrayReturn<any, 'feeItems', 'key'>['remove'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update: UseFieldArrayReturn<any, 'feeItems', 'key'>['update'];
  isDisabled: boolean;
}

const FeeItemsContext = createContext<FeeItemsContextValue | null>(null);

/**
 * Hook: 获取 FeeItems Context
 *
 * 必须在 FeeItemsProvider 内部使用
 */
export function useFeeItemsContext() {
  const context = useContext(FeeItemsContext);
  if (!context) {
    throw new Error(
      'useFeeItemsContext must be used within FeeItemsProvider. ' +
        'Wrap your component tree with <FeeItemsProvider>.'
    );
  }
  return context;
}

export const FeeItemsProvider = FeeItemsContext.Provider;
