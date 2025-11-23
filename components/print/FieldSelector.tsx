/**
 * FieldSelector - 打印字段选择器
 *
 * 功能：
 * - 分组显示可选字段
 * - 必填字段不可取消
 * - 支持全选/取消全选
 * - 分类显示（表头/明细/汇总）
 *
 * 设计原则：
 * - 单一职责：仅负责字段选择UI
 * - 受控组件：通过props接收值和回调
 */

'use client';

import React, { useMemo } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
  FieldSelection,
  PrintConfig,
  PrintFieldDefinition,
} from '@/lib/types/print-config';
import { cn } from '@/lib/utils';

/**
 * FieldSelector 组件属性
 */
export interface FieldSelectorProps {
  /**
   * 打印配置
   */
  config: PrintConfig;

  /**
   * 当前选择的字段
   */
  selectedFields: FieldSelection;

  /**
   * 选择变更回调
   */
  onSelectionChange: (selection: FieldSelection) => void;

  /**
   * 额外CSS类名
   */
  className?: string;
}

/**
 * 字段分组类型
 */
interface FieldGroup {
  name: string;
  fields: PrintFieldDefinition[];
}

/**
 * FieldSelector 组件
 *
 * @example
 * ```tsx
 * <FieldSelector
 *   config={salesOrderPrintConfig}
 *   selectedFields={selection}
 *   onSelectionChange={setSelection}
 * />
 * ```
 */
export function FieldSelector({
  config,
  selectedFields,
  onSelectionChange,
  className,
}: FieldSelectorProps) {
  // 按分组整理表头字段
  const headerGroups = useMemo(() => {
    const groups = new Map<string, PrintFieldDefinition[]>();

    config.headerFields.forEach(field => {
      const group = field.group || '其他';
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      const groupFields = groups.get(group);
      if (groupFields) {
        groupFields.push(field);
      }
    });

    return Array.from(groups.entries()).map(([name, fields]) => ({
      name,
      fields,
    }));
  }, [config.headerFields]);

  // 切换字段选择
  const toggleField = (
    type: 'header' | 'item' | 'summary',
    fieldKey: string,
    field: PrintFieldDefinition
  ) => {
    // 必填字段不可取消
    if (field.required) return;

    const currentKeys =
      type === 'header'
        ? selectedFields.headerKeys
        : type === 'item'
          ? selectedFields.itemKeys
          : selectedFields.summaryKeys;

    const newKeys = currentKeys.includes(fieldKey)
      ? currentKeys.filter(k => k !== fieldKey)
      : [...currentKeys, fieldKey];

    onSelectionChange({
      ...selectedFields,
      [type === 'header'
        ? 'headerKeys'
        : type === 'item'
          ? 'itemKeys'
          : 'summaryKeys']: newKeys,
    });
  };

  // 全选/取消全选
  const toggleAll = (type: 'header' | 'item' | 'summary', checked: boolean) => {
    const fields =
      type === 'header'
        ? config.headerFields
        : type === 'item'
          ? config.itemFields
          : config.summaryFields;

    const newKeys = checked
      ? fields.map(f => f.key)
      : fields.filter(f => f.required).map(f => f.key);

    onSelectionChange({
      ...selectedFields,
      [type === 'header'
        ? 'headerKeys'
        : type === 'item'
          ? 'itemKeys'
          : 'summaryKeys']: newKeys,
    });
  };

  // 渲染字段复选框
  const renderFieldCheckbox = (
    type: 'header' | 'item' | 'summary',
    field: PrintFieldDefinition
  ) => {
    const currentKeys =
      type === 'header'
        ? selectedFields.headerKeys
        : type === 'item'
          ? selectedFields.itemKeys
          : selectedFields.summaryKeys;

    const isChecked = currentKeys.includes(field.key);
    const isDisabled = field.required;

    return (
      <div key={field.key} className="flex items-center space-x-2">
        <Checkbox
          id={`${type}-${field.key}`}
          checked={isChecked}
          disabled={isDisabled}
          onCheckedChange={() => toggleField(type, field.key, field)}
        />
        <Label
          htmlFor={`${type}-${field.key}`}
          className={cn(
            'cursor-pointer text-sm',
            isDisabled && 'text-muted-foreground cursor-not-allowed'
          )}
        >
          {field.label}
          {field.required && (
            <span className="text-destructive ml-1 text-xs">*</span>
          )}
        </Label>
      </div>
    );
  };

  // 渲染分组字段
  const renderGroupedFields = (groups: FieldGroup[], type: 'header') =>
    groups.map(group => (
      <div key={group.name} className="space-y-2">
        <h4 className="text-muted-foreground text-sm font-medium">
          {group.name}
        </h4>
        <div className="space-y-2 pl-4">
          {group.fields.map(field => renderFieldCheckbox(type, field))}
        </div>
      </div>
    ));

  return (
    <div className={cn('rounded-lg border', className)}>
      <Tabs defaultValue="header" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="header">表头信息</TabsTrigger>
          <TabsTrigger value="item">订单明细</TabsTrigger>
          <TabsTrigger value="summary">汇总信息</TabsTrigger>
        </TabsList>

        {/* 表头字段 */}
        <TabsContent value="header" className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">选择表头字段</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleAll('header', true)}
                  className="text-primary text-xs hover:underline"
                >
                  全选
                </button>
                <span className="text-muted-foreground text-xs">|</span>
                <button
                  type="button"
                  onClick={() => toggleAll('header', false)}
                  className="text-primary text-xs hover:underline"
                >
                  取消全选
                </button>
              </div>
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-4">
                {renderGroupedFields(headerGroups, 'header')}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        {/* 订单明细字段 */}
        <TabsContent value="item" className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">选择明细字段</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleAll('item', true)}
                  className="text-primary text-xs hover:underline"
                >
                  全选
                </button>
                <span className="text-muted-foreground text-xs">|</span>
                <button
                  type="button"
                  onClick={() => toggleAll('item', false)}
                  className="text-primary text-xs hover:underline"
                >
                  取消全选
                </button>
              </div>
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {config.itemFields.map(field =>
                  renderFieldCheckbox('item', field)
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        {/* 汇总信息字段 */}
        <TabsContent value="summary" className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">选择汇总字段</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleAll('summary', true)}
                  className="text-primary text-xs hover:underline"
                >
                  全选
                </button>
                <span className="text-muted-foreground text-xs">|</span>
                <button
                  type="button"
                  onClick={() => toggleAll('summary', false)}
                  className="text-primary text-xs hover:underline"
                >
                  取消全选
                </button>
              </div>
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {config.summaryFields.map(field =>
                  renderFieldCheckbox('summary', field)
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
