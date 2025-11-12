/**
 * FeeItems List - 列表容器组件
 *
 * 渲染费用项列表或空状态提示
 */

'use client';

import { FeeItemCard } from './fee-item-card';
import { useFeeItemsContext } from './fee-items-context';

export function FeeItemsList() {
  const { fields } = useFeeItemsContext();

  // 空状态提示
  if (fields.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-tertiary))] p-8 text-center"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm text-[hsl(var(--color-text-tertiary))]">
          暂无额外费用，点击上方按钮添加
        </p>
      </div>
    );
  }

  // 费用项列表
  return (
    <div className="space-y-3" role="list" aria-label="费用项列表">
      {fields.map((field, index) => (
        <FeeItemCard
          key={(field as unknown as { key: string }).key} // ✅ 使用 unknown 作为中间类型
          index={index}
          field={field}
        />
      ))}
    </div>
  );
}
