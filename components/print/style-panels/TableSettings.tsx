/**
 * TableSettings - 表格设置面板
 *
 * 功能：
 * - 表头颜色和字体
 * - 行样式和高度
 * - 边框样式
 * - 斑马纹配置
 *
 * 设计原则：
 * - 单一职责：仅负责表格设置UI
 * - 受控组件：通过props接收值和更新回调
 */

'use client';

import React from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type {
  BorderStyle,
  FontWeight,
  TableSettings,
} from '@/lib/types/print-style';

/**
 * TableSettings 组件属性
 */
export interface TableSettingsProps {
  /**
   * 当前表格设置
   */
  value: TableSettings;

  /**
   * 更新回调
   */
  onChange: (updates: Partial<TableSettings>) => void;
}

/**
 * TableSettings 组件
 *
 * @example
 * ```tsx
 * <TableSettings
 *   value={config.table}
 *   onChange={(updates) => updateTableSettings(updates)}
 * />
 * ```
 */
export function TableSettings({ value, onChange }: TableSettingsProps) {
  return (
    <div className="space-y-6">
      {/* 表头样式 */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">表头样式</h4>

        {/* 表头背景色 */}
        <div className="space-y-2">
          <Label htmlFor="header-bg">背景颜色</Label>
          <div className="flex gap-2">
            <Input
              id="header-bg"
              type="color"
              value={value.headerBgColor}
              onChange={e => onChange({ headerBgColor: e.target.value })}
              className="h-10 w-20"
            />
            <Input
              value={value.headerBgColor}
              onChange={e => onChange({ headerBgColor: e.target.value })}
              placeholder="#f5f5f5"
              className="flex-1"
            />
          </div>
        </div>

        {/* 表头文字颜色 */}
        <div className="space-y-2">
          <Label htmlFor="header-text">文字颜色</Label>
          <div className="flex gap-2">
            <Input
              id="header-text"
              type="color"
              value={value.headerTextColor}
              onChange={e => onChange({ headerTextColor: e.target.value })}
              className="h-10 w-20"
            />
            <Input
              value={value.headerTextColor}
              onChange={e => onChange({ headerTextColor: e.target.value })}
              placeholder="#000000"
              className="flex-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* 表头字体大小 */}
          <div className="space-y-2">
            <Label htmlFor="header-font-size">字体大小 (px)</Label>
            <NumberInput
              id="header-font-size"
              value={value.headerFontSize}
              onChange={headerFontSize => onChange({ headerFontSize })}
              min={8}
              max={24}
              step={1}
            />
          </div>

          {/* 表头字重 */}
          <div className="space-y-2">
            <Label htmlFor="header-font-weight">字重</Label>
            <Select
              value={value.headerFontWeight}
              onValueChange={(headerFontWeight: FontWeight) =>
                onChange({ headerFontWeight })
              }
            >
              <SelectTrigger id="header-font-weight">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="bold">Bold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 表体样式 */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">表体样式</h4>

        <div className="grid grid-cols-2 gap-4">
          {/* 行字体大小 */}
          <div className="space-y-2">
            <Label htmlFor="row-font-size">字体大小 (px)</Label>
            <NumberInput
              id="row-font-size"
              value={value.rowFontSize}
              onChange={rowFontSize => onChange({ rowFontSize })}
              min={8}
              max={20}
              step={1}
            />
          </div>

          {/* 行高 */}
          <div className="space-y-2">
            <Label htmlFor="row-height">行高 (px)</Label>
            <NumberInput
              id="row-height"
              value={value.rowHeight}
              onChange={rowHeight => onChange({ rowHeight })}
              min={20}
              max={60}
              step={4}
            />
          </div>
        </div>

        {/* 单元格内边距 */}
        <div className="space-y-2">
          <Label htmlFor="cell-padding">单元格内边距 (px)</Label>
          <NumberInput
            id="cell-padding"
            value={value.cellPadding}
            onChange={cellPadding => onChange({ cellPadding })}
            min={2}
            max={20}
            step={2}
          />
        </div>
      </div>

      {/* 边框样式 */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">边框样式</h4>

        {/* 边框样式选择 */}
        <div className="space-y-2">
          <Label htmlFor="border-style">边框类型</Label>
          <Select
            value={value.borderStyle}
            onValueChange={(borderStyle: BorderStyle) =>
              onChange({ borderStyle })
            }
          >
            <SelectTrigger id="border-style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">无边框</SelectItem>
              <SelectItem value="solid">实线</SelectItem>
              <SelectItem value="dashed">虚线</SelectItem>
              <SelectItem value="dotted">点线</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {value.borderStyle !== 'none' && (
          <div className="border-muted space-y-4 border-l-2 pl-4">
            {/* 边框颜色 */}
            <div className="space-y-2">
              <Label htmlFor="border-color">边框颜色</Label>
              <div className="flex gap-2">
                <Input
                  id="border-color"
                  type="color"
                  value={value.borderColor}
                  onChange={e => onChange({ borderColor: e.target.value })}
                  className="h-10 w-20"
                />
                <Input
                  value={value.borderColor}
                  onChange={e => onChange({ borderColor: e.target.value })}
                  placeholder="#000000"
                  className="flex-1"
                />
              </div>
            </div>

            {/* 边框宽度 */}
            <div className="space-y-2">
              <Label htmlFor="border-width">边框宽度 (px)</Label>
              <NumberInput
                id="border-width"
                value={value.borderWidth}
                onChange={borderWidth => onChange({ borderWidth })}
                min={1}
                max={5}
                step={1}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="header-border-width">表头底线宽度 (px)</Label>
                <NumberInput
                  id="header-border-width"
                  value={value.headerBottomBorderWidth ?? value.borderWidth}
                  onChange={headerBottomBorderWidth =>
                    onChange({ headerBottomBorderWidth })
                  }
                  min={1}
                  max={8}
                  step={1}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="last-row-border-width">
                  最后一行底线宽度 (px)
                </Label>
                <NumberInput
                  id="last-row-border-width"
                  value={value.lastRowBottomBorderWidth ?? value.borderWidth}
                  onChange={lastRowBottomBorderWidth =>
                    onChange({ lastRowBottomBorderWidth })
                  }
                  min={1}
                  max={8}
                  step={1}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 斑马纹 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="striped-rows">斑马纹</Label>
          <Switch
            id="striped-rows"
            checked={value.stripedRows}
            onCheckedChange={stripedRows => onChange({ stripedRows })}
          />
        </div>

        {value.stripedRows && (
          <div className="border-muted space-y-2 border-l-2 pl-4">
            <Label htmlFor="striped-color">斑马纹颜色</Label>
            <div className="flex gap-2">
              <Input
                id="striped-color"
                type="color"
                value={value.stripedColor}
                onChange={e => onChange({ stripedColor: e.target.value })}
                className="h-10 w-20"
              />
              <Input
                value={value.stripedColor}
                onChange={e => onChange({ stripedColor: e.target.value })}
                placeholder="#fafafa"
                className="flex-1"
              />
            </div>
            <p className="text-muted-foreground text-xs">偶数行的背景颜色</p>
          </div>
        )}
      </div>
    </div>
  );
}
