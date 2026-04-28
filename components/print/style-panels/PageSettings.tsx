/**
 * PageSettings - 页面设置面板
 *
 * 功能：
 * - 纸张大小选择
 * - 页面方向选择
 * - 页边距配置
 *
 * 设计原则：
 * - 单一职责：仅负责页面设置UI
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
import type {
  PageOrientation,
  PageSettings,
  PageSize,
} from '@/lib/types/print-style';

/**
 * PageSettings 组件属性
 */
export interface PageSettingsProps {
  /**
   * 当前页面设置
   */
  value: PageSettings;

  /**
   * 更新回调
   */
  onChange: (updates: Partial<PageSettings>) => void;
}

/**
 * PageSettings 组件
 *
 * @example
 * ```tsx
 * <PageSettings
 *   value={config.page}
 *   onChange={(updates) => updatePageSettings(updates)}
 * />
 * ```
 */
export function PageSettings({ value, onChange }: PageSettingsProps) {
  return (
    <div className="space-y-6">
      {/* 纸张大小 */}
      <div className="space-y-2">
        <Label htmlFor="page-size">纸张大小</Label>
        <Select
          value={value.size}
          onValueChange={(size: PageSize) => onChange({ size })}
        >
          <SelectTrigger id="page-size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="A4">A4 (210 × 297 mm)</SelectItem>
            <SelectItem value="A5">A5 (148 × 210 mm)</SelectItem>
            <SelectItem value="Letter">信纸 (216 × 279 mm)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 页面方向 */}
      <div className="space-y-2">
        <Label htmlFor="page-orientation">页面方向</Label>
        <Select
          value={value.orientation}
          onValueChange={(orientation: PageOrientation) =>
            onChange({ orientation })
          }
        >
          <SelectTrigger id="page-orientation">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="portrait">纵向（竖版）</SelectItem>
            <SelectItem value="landscape">横向（横版）</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 页边距 */}
      <div className="space-y-4">
        <Label>页边距 (mm)</Label>

        <div className="grid grid-cols-2 gap-4">
          {/* 上边距 */}
          <div className="space-y-2">
            <Label htmlFor="margin-top" className="text-sm">
              上边距
            </Label>
            <NumberInput
              id="margin-top"
              value={value.margin.top}
              onChange={top =>
                top !== undefined &&
                onChange({ margin: { ...value.margin, top } })
              }
              min={0}
              max={50}
              step={1}
            />
          </div>

          {/* 右边距 */}
          <div className="space-y-2">
            <Label htmlFor="margin-right" className="text-sm">
              右边距
            </Label>
            <NumberInput
              id="margin-right"
              value={value.margin.right}
              onChange={right =>
                right !== undefined &&
                onChange({ margin: { ...value.margin, right } })
              }
              min={0}
              max={50}
              step={1}
            />
          </div>

          {/* 下边距 */}
          <div className="space-y-2">
            <Label htmlFor="margin-bottom" className="text-sm">
              下边距
            </Label>
            <NumberInput
              id="margin-bottom"
              value={value.margin.bottom}
              onChange={bottom =>
                bottom !== undefined &&
                onChange({ margin: { ...value.margin, bottom } })
              }
              min={0}
              max={50}
              step={1}
            />
          </div>

          {/* 左边距 */}
          <div className="space-y-2">
            <Label htmlFor="margin-left" className="text-sm">
              左边距
            </Label>
            <NumberInput
              id="margin-left"
              value={value.margin.left}
              onChange={left =>
                left !== undefined &&
                onChange({ margin: { ...value.margin, left } })
              }
              min={0}
              max={50}
              step={1}
            />
          </div>
        </div>
      </div>

      {/* 页面外边框 */}
      <div className="space-y-4">
        <Label>页面外边框</Label>
        <div className="space-y-2">
          <Label htmlFor="page-border-color">边框颜色</Label>
          <div className="flex gap-2">
            <Input
              id="page-border-color"
              type="color"
              value={value.borderColor || '#000000'}
              onChange={e =>
                onChange({ borderColor: e.target.value || undefined })
              }
              className="h-10 w-20"
            />
            <Input
              value={value.borderColor || '#000000'}
              onChange={e =>
                onChange({ borderColor: e.target.value || undefined })
              }
              placeholder="#000000"
              className="flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="page-border-width">边框宽度 (px)</Label>
          <NumberInput
            id="page-border-width"
            value={value.borderWidth ?? 0}
            onChange={borderWidth =>
              onChange({
                borderWidth: borderWidth ?? 0,
              })
            }
            min={0}
            max={10}
            step={1}
          />
        </div>
      </div>

      {/* 预览尺寸信息 */}
      <div className="bg-muted space-y-1 rounded-md p-3 text-sm">
        <div className="font-medium">当前页面尺寸</div>
        <div className="text-muted-foreground">
          {value.orientation === 'landscape' ? (
            <span>
              宽 ×{' '}
              {value.size === 'A4'
                ? '297mm'
                : value.size === 'A5'
                  ? '210mm'
                  : '279mm'}{' '}
              × 高 ×{' '}
              {value.size === 'A4'
                ? '210mm'
                : value.size === 'A5'
                  ? '148mm'
                  : '216mm'}
            </span>
          ) : (
            <span>
              宽 ×{' '}
              {value.size === 'A4'
                ? '210mm'
                : value.size === 'A5'
                  ? '148mm'
                  : '216mm'}{' '}
              × 高 ×{' '}
              {value.size === 'A4'
                ? '297mm'
                : value.size === 'A5'
                  ? '210mm'
                  : '279mm'}
            </span>
          )}
        </div>
        <div className="text-muted-foreground">
          内容区域：宽 ×{' '}
          {(value.orientation === 'landscape'
            ? value.size === 'A4'
              ? 297
              : value.size === 'A5'
                ? 210
                : 279
            : value.size === 'A4'
              ? 210
              : value.size === 'A5'
                ? 148
                : 216) -
            value.margin.left -
            value.margin.right}
          mm × 高 ×{' '}
          {(value.orientation === 'landscape'
            ? value.size === 'A4'
              ? 210
              : value.size === 'A5'
                ? 148
                : 216
            : value.size === 'A4'
              ? 297
              : value.size === 'A5'
                ? 210
                : 279) -
            value.margin.top -
            value.margin.bottom}
          mm
        </div>
      </div>
    </div>
  );
}
