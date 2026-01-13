/**
 * HeaderSettings - 表头设置面板
 *
 * 功能：
 * - 标志显示和配置
 * - 公司名称和副标题
 * - 字体样式和对齐
 * - 边框和背景色
 *
 * 设计原则：
 * - 单一职责：仅负责表头设置UI
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
import type { Alignment, HeaderSettings } from '@/lib/types/print-style';

/**
 * HeaderSettings 组件属性
 */
export interface HeaderSettingsProps {
  /**
   * 当前表头设置
   */
  value: HeaderSettings;

  /**
   * 更新回调
   */
  onChange: (updates: Partial<HeaderSettings>) => void;
}

/**
 * HeaderSettings 组件
 *
 * @example
 * ```tsx
 * <HeaderSettings
 *   value={config.header}
 *   onChange={(updates) => updateHeaderSettings(updates)}
 * />
 * ```
 */
export function HeaderSettings({ value, onChange }: HeaderSettingsProps) {
  return (
    <div className="space-y-6">
      {/* 标志设置 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="show-logo">显示标志</Label>
          <Switch
            id="show-logo"
            checked={value.showLogo}
            onCheckedChange={showLogo => onChange({ showLogo })}
          />
        </div>

        {value.showLogo && (
          <div className="border-muted space-y-4 border-l-2 pl-4">
            <div className="space-y-2">
              <Label htmlFor="logo-url">标志链接</Label>
              <Input
                id="logo-url"
                type="url"
                value={value.logoUrl || ''}
                onChange={e => onChange({ logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-muted-foreground text-xs">
                支持 http/https 或相对路径
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="logo-width">标志宽度 (px)</Label>
                <NumberInput
                  id="logo-width"
                  value={value.logoWidth || 120}
                  onChange={logoWidth => onChange({ logoWidth })}
                  min={20}
                  max={400}
                  step={10}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo-height">标志高度 (px)</Label>
                <NumberInput
                  id="logo-height"
                  value={value.logoHeight || 60}
                  onChange={logoHeight => onChange({ logoHeight })}
                  min={20}
                  max={400}
                  step={10}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 公司名称 */}
      <div className="space-y-2">
        <Label htmlFor="company-name">公司名称</Label>
        <Input
          id="company-name"
          value={value.companyName}
          onChange={e => onChange({ companyName: e.target.value })}
          placeholder="请输入公司名称"
        />
        <div className="mt-2 space-y-2">
          <Label htmlFor="company-name-size">字体大小 (px)</Label>
          <NumberInput
            id="company-name-size"
            value={value.companyNameFontSize}
            onChange={companyNameFontSize => onChange({ companyNameFontSize })}
            min={12}
            max={48}
            step={2}
          />
        </div>
      </div>

      {/* 副标题 */}
      <div className="space-y-2">
        <Label htmlFor="subtitle">副标题（可选）</Label>
        <Input
          id="subtitle"
          value={value.subtitle || ''}
          onChange={e => onChange({ subtitle: e.target.value })}
          placeholder="如：销售订单、采购订单"
        />
        <div className="mt-2 space-y-2">
          <Label htmlFor="subtitle-size">字体大小 (px)</Label>
          <NumberInput
            id="subtitle-size"
            value={value.subtitleFontSize}
            onChange={subtitleFontSize => onChange({ subtitleFontSize })}
            min={10}
            max={36}
            step={2}
          />
        </div>
      </div>

      {/* 对齐方式 */}
      <div className="space-y-2">
        <Label htmlFor="header-alignment">对齐方式</Label>
        <Select
          value={value.alignment}
          onValueChange={(alignment: Alignment) => onChange({ alignment })}
        >
          <SelectTrigger id="header-alignment">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">左对齐</SelectItem>
            <SelectItem value="center">居中</SelectItem>
            <SelectItem value="right">右对齐</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 边框设置 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="show-border">显示边框</Label>
          <Switch
            id="show-border"
            checked={value.showBorder}
            onCheckedChange={showBorder => onChange({ showBorder })}
          />
        </div>

        {value.showBorder && (
          <div className="border-muted space-y-2 border-l-2 pl-4">
            <Label htmlFor="border-color">边框颜色</Label>
            <div className="flex gap-2">
              <Input
                id="border-color"
                type="color"
                value={value.borderColor || '#000000'}
                onChange={e => onChange({ borderColor: e.target.value })}
                className="h-10 w-20"
              />
              <Input
                value={value.borderColor || '#000000'}
                onChange={e => onChange({ borderColor: e.target.value })}
                placeholder="#000000"
                className="flex-1"
              />
            </div>

            <div className="mt-3 space-y-2">
              <Label htmlFor="header-border-width">边框宽度 (px)</Label>
              <NumberInput
                id="header-border-width"
                value={value.borderWidth ?? 2}
                onChange={borderWidth => onChange({ borderWidth })}
                min={1}
                max={6}
                step={1}
              />
              <p className="text-muted-foreground text-xs">
                控制标题下方横线粗细，2-3px 适合中国ERP发货单样式。
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 背景颜色 */}
      <div className="space-y-2">
        <Label htmlFor="bg-color">背景颜色</Label>
        <div className="flex gap-2">
          <Input
            id="bg-color"
            type="color"
            value={value.backgroundColor || '#ffffff'}
            onChange={e => onChange({ backgroundColor: e.target.value })}
            className="h-10 w-20"
          />
          <Input
            value={value.backgroundColor || '#ffffff'}
            onChange={e => onChange({ backgroundColor: e.target.value })}
            placeholder="#ffffff"
            className="flex-1"
          />
        </div>
      </div>

      {/* 内边距 */}
      <div className="space-y-2">
        <Label htmlFor="padding">内边距 (px)</Label>
        <NumberInput
          id="padding"
          value={value.padding || 16}
          onChange={padding => onChange({ padding })}
          min={0}
          max={50}
          step={4}
        />
        <p className="text-muted-foreground text-xs">
          控制表头内容与边框的距离
        </p>
      </div>
    </div>
  );
}
