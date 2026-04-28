/**
 * OtherSettings - 其他设置面板
 *
 * 功能：
 * - 汇总区设置
 * - 页脚设置
 * - 签名区设置
 *
 * 设计原则：
 * - 单一职责：仅负责其他设置UI
 * - 受控组件：通过props接收值和更新回调
 */

'use client';

import React from 'react';

import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import type {
  Alignment,
  FontWeight,
  FooterSettings,
  SummaryFieldColorOption,
  SignatureField,
  SignatureSettings,
  SummarySettings,
} from '@/lib/types/print-style';

/**
 * OtherSettings 组件属性
 */
export interface OtherSettingsProps {
  /**
   * 汇总区设置
   */
  summary: SummarySettings;

  /**
   * 页脚设置
   */
  footer: FooterSettings;

  /**
   * 签名区设置
   */
  signature: SignatureSettings;

  /**
   * 可单独设置颜色的汇总字段
   */
  summaryFields?: SummaryFieldColorOption[];

  /**
   * 更新回调
   */
  onSummaryChange: (updates: Partial<SummarySettings>) => void;
  onFooterChange: (updates: Partial<FooterSettings>) => void;
  onSignatureChange: (updates: Partial<SignatureSettings>) => void;
}

/**
 * OtherSettings 组件
 *
 * @example
 * ```tsx
 * <OtherSettings
 *   summary={config.summary}
 *   footer={config.footer}
 *   signature={config.signature}
 *   onSummaryChange={updateSummarySettings}
 *   onFooterChange={updateFooterSettings}
 *   onSignatureChange={updateSignatureSettings}
 * />
 * ```
 */
export function OtherSettings({
  summary,
  footer,
  signature,
  summaryFields = [],
  onSummaryChange,
  onFooterChange,
  onSignatureChange,
}: OtherSettingsProps) {
  const visibleSummaryFields =
    summaryFields.length > 0
      ? summaryFields
      : [
          { key: 'totalAmount', label: '合计金额' },
          { key: 'totalAmountChinese', label: '大写金额' },
          { key: 'totalWeight', label: '总重量' },
          { key: 'totalQuantity', label: '合计数量' },
        ];

  const handleSummaryFieldColorChange = (key: string, value: string) => {
    const trimmedValue = value.trim();
    const nextFieldColors = { ...(summary.fieldColors ?? {}) };

    if (!trimmedValue) {
      delete nextFieldColors[key];
    } else {
      nextFieldColors[key] = trimmedValue;
    }

    onSummaryChange({ fieldColors: nextFieldColors });
  };

  const handleSummaryFieldLabelColorChange = (key: string, value: string) => {
    const trimmedValue = value.trim();
    const nextFieldLabelColors = { ...(summary.fieldLabelColors ?? {}) };

    if (!trimmedValue) {
      delete nextFieldLabelColors[key];
    } else {
      nextFieldLabelColors[key] = trimmedValue;
    }

    onSummaryChange({ fieldLabelColors: nextFieldLabelColors });
  };

  // 添加签名字段
  const handleAddSignatureField = () => {
    const newField: SignatureField = {
      label: '签名',
      width: 80,
    };
    onSignatureChange({
      fields: [...signature.fields, newField],
    });
  };

  // 删除签名字段
  const handleRemoveSignatureField = (index: number) => {
    const newFields = signature.fields.filter((_, i) => i !== index);
    onSignatureChange({ fields: newFields });
  };

  // 更新签名字段
  const handleUpdateSignatureField = (
    index: number,
    updates: Partial<SignatureField>
  ) => {
    const newFields = signature.fields.map((field, i) =>
      i === index ? { ...field, ...updates } : field
    );
    onSignatureChange({ fields: newFields });
  };

  return (
    <div className="space-y-8">
      {/* ========== 汇总区设置 ========== */}
      <div className="space-y-4">
        <h4 className="border-b pb-2 text-sm font-medium">汇总区设置</h4>

        {/* 对齐方式 */}
        <div className="space-y-2">
          <Label htmlFor="summary-alignment">对齐方式</Label>
          <Select
            value={summary.alignment}
            onValueChange={(alignment: Alignment) =>
              onSummaryChange({ alignment })
            }
          >
            <SelectTrigger id="summary-alignment">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">左对齐</SelectItem>
              <SelectItem value="center">居中</SelectItem>
              <SelectItem value="right">右对齐</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* 字体大小 */}
          <div className="space-y-2">
            <Label htmlFor="summary-font-size">字体大小 (px)</Label>
            <NumberInput
              id="summary-font-size"
              value={summary.fontSize}
              onChange={fontSize => onSummaryChange({ fontSize })}
              min={10}
              max={24}
              step={1}
            />
          </div>

          {/* 字重 */}
          <div className="space-y-2">
            <Label htmlFor="summary-font-weight">字重</Label>
            <Select
              value={summary.fontWeight}
              onValueChange={(fontWeight: FontWeight) =>
                onSummaryChange({ fontWeight })
              }
            >
              <SelectTrigger id="summary-font-weight">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">常规</SelectItem>
                <SelectItem value="bold">加粗</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 显示中文大写金额 */}
        <div className="flex items-center justify-between">
          <Label htmlFor="show-chinese-amount">显示中文大写金额</Label>
          <Switch
            id="show-chinese-amount"
            checked={summary.showChineseAmount}
            onCheckedChange={showChineseAmount =>
              onSummaryChange({ showChineseAmount })
            }
          />
        </div>

        {/* 高亮总计行 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="highlight-total">高亮总计行</Label>
            <Switch
              id="highlight-total"
              checked={summary.highlightTotal}
              onCheckedChange={highlightTotal =>
                onSummaryChange({ highlightTotal })
              }
            />
          </div>

          {summary.highlightTotal && (
            <div className="border-muted space-y-2 border-l-2 pl-4">
              <Label htmlFor="highlight-color">高亮颜色</Label>
              <div className="flex gap-2">
                <Input
                  id="highlight-color"
                  type="color"
                  value={summary.highlightColor}
                  onChange={e =>
                    onSummaryChange({ highlightColor: e.target.value })
                  }
                  className="h-10 w-20"
                />
                <Input
                  value={summary.highlightColor}
                  onChange={e =>
                    onSummaryChange({ highlightColor: e.target.value })
                  }
                  placeholder="#fef3c7"
                  className="flex-1"
                />
              </div>
            </div>
          )}
        </div>

        {/* 汇总区边框 */}
        <div className="space-y-2">
          <Label htmlFor="summary-border-width">外边框宽度 (px)</Label>
          <NumberInput
            id="summary-border-width"
            value={summary.borderWidth ?? 0}
            onChange={borderWidth =>
              onSummaryChange({
                borderWidth: borderWidth ?? 0,
                showBorder: (borderWidth ?? 0) > 0,
              })
            }
            min={0}
            max={5}
            step={1}
          />
          <p className="text-muted-foreground text-xs">
            0 表示不显示汇总区域外边框，2px 左右常用于ERP单据中的粗线汇总栏。
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="summary-border-color">外边框颜色</Label>
          <div className="flex gap-2">
            <Input
              id="summary-border-color"
              type="color"
              value={summary.borderColor || '#000000'}
              onChange={e =>
                onSummaryChange({ borderColor: e.target.value || '#000000' })
              }
              className="h-10 w-20"
            />
            <Input
              value={summary.borderColor || '#000000'}
              onChange={e =>
                onSummaryChange({ borderColor: e.target.value || '#000000' })
              }
              placeholder="#000000"
              className="flex-1"
            />
          </div>
        </div>

        {/* 内边距 */}
        <div className="space-y-2">
          <Label htmlFor="summary-padding">内边距 (px)</Label>
          <NumberInput
            id="summary-padding"
            value={summary.padding || 16}
            onChange={padding => onSummaryChange({ padding })}
            min={0}
            max={50}
            step={4}
          />
        </div>

        <div className="space-y-3 rounded-xl border p-3">
          <div>
            <Label className="text-sm font-medium">汇总字段颜色</Label>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              这里可以单独控制“合计金额、总重量”等汇总字段的标签颜色和数值颜色，优先级高于整块高亮背景。
            </p>
          </div>
          <div className="space-y-3">
            {visibleSummaryFields.map(field => {
              const currentLabelColor =
                summary.fieldLabelColors?.[field.key] ?? '';
              const currentValueColor = summary.fieldColors?.[field.key] ?? '';
              const labelColorInputValue =
                currentLabelColor.startsWith('#') &&
                currentLabelColor.length >= 4
                  ? currentLabelColor
                  : '#111111';
              const valueColorInputValue =
                currentValueColor.startsWith('#') &&
                currentValueColor.length >= 4
                  ? currentValueColor
                  : '#111111';

              return (
                <div
                  key={field.key}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <Label
                      htmlFor={`summary-field-value-color-${field.key}`}
                      className="text-xs font-medium"
                    >
                      {field.label}
                    </Label>
                  </div>
                  <div className="grid grid-cols-[64px_1fr_auto] items-center gap-2">
                    <Label
                      htmlFor={`summary-field-label-color-${field.key}`}
                      className="text-xs text-slate-500"
                    >
                      标签
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id={`summary-field-label-color-${field.key}`}
                        type="color"
                        value={labelColorInputValue}
                        onChange={e =>
                          handleSummaryFieldLabelColorChange(
                            field.key,
                            e.target.value
                          )
                        }
                        className="h-10 w-[72px]"
                        aria-label={`${field.label} 标签颜色`}
                      />
                      <Input
                        value={currentLabelColor}
                        onChange={e =>
                          handleSummaryFieldLabelColorChange(
                            field.key,
                            e.target.value
                          )
                        }
                        placeholder="留空则跟随默认颜色"
                        aria-label={`${field.label} 标签颜色值`}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!currentLabelColor}
                      onClick={() =>
                        handleSummaryFieldLabelColorChange(field.key, '')
                      }
                    >
                      跟随默认
                    </Button>
                  </div>
                  <div className="mt-2 grid grid-cols-[64px_1fr_auto] items-center gap-2">
                    <Label
                      htmlFor={`summary-field-value-color-${field.key}`}
                      className="text-xs text-slate-500"
                    >
                      数值
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id={`summary-field-value-color-${field.key}`}
                        type="color"
                        value={valueColorInputValue}
                        onChange={e =>
                          handleSummaryFieldColorChange(
                            field.key,
                            e.target.value
                          )
                        }
                        className="h-10 w-[72px]"
                        aria-label={`${field.label} 数值颜色`}
                      />
                      <Input
                        value={currentValueColor}
                        onChange={e =>
                          handleSummaryFieldColorChange(
                            field.key,
                            e.target.value
                          )
                        }
                        placeholder="留空则跟随默认颜色"
                        aria-label={`${field.label} 数值颜色值`}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!currentValueColor}
                      onClick={() => handleSummaryFieldColorChange(field.key, '')}
                    >
                      跟随默认
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========== 页脚设置 ========== */}
      <div className="space-y-4">
        <h4 className="border-b pb-2 text-sm font-medium">页脚设置</h4>

        {/* 显示页脚 */}
        <div className="flex items-center justify-between">
          <Label htmlFor="show-footer">显示页脚</Label>
          <Switch
            id="show-footer"
            checked={footer.show}
            onCheckedChange={show => onFooterChange({ show })}
          />
        </div>

        {footer.show && (
          <div className="space-y-4">
            {/* 页脚内容 */}
            <div className="space-y-2">
              <Label htmlFor="footer-content">页脚内容模板</Label>
              <Textarea
                id="footer-content"
                value={footer.content}
                onChange={e => onFooterChange({ content: e.target.value })}
                rows={3}
                placeholder="支持变量：{pageNumber}, {totalPages}, {date}, {time}"
              />
              <p className="text-muted-foreground text-xs">
                支持变量：{'{pageNumber}'} (页码), {'{totalPages}'} (总页数),{' '}
                {'{date}'} (日期), {'{time}'} (时间)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* 字体大小 */}
              <div className="space-y-2">
                <Label htmlFor="footer-font-size">字体大小 (px)</Label>
                <NumberInput
                  id="footer-font-size"
                  value={footer.fontSize}
                  onChange={fontSize => onFooterChange({ fontSize })}
                  min={8}
                  max={16}
                  step={1}
                />
              </div>

              {/* 对齐方式 */}
              <div className="space-y-2">
                <Label htmlFor="footer-alignment">对齐方式</Label>
                <Select
                  value={footer.alignment}
                  onValueChange={(alignment: Alignment) =>
                    onFooterChange({ alignment })
                  }
                >
                  <SelectTrigger id="footer-alignment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">左对齐</SelectItem>
                    <SelectItem value="center">居中</SelectItem>
                    <SelectItem value="right">右对齐</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 文字颜色 */}
            <div className="space-y-2">
              <Label htmlFor="footer-text-color">文字颜色</Label>
              <div className="flex gap-2">
                <Input
                  id="footer-text-color"
                  type="color"
                  value={footer.textColor || '#666666'}
                  onChange={e => onFooterChange({ textColor: e.target.value })}
                  className="h-10 w-20"
                />
                <Input
                  value={footer.textColor || '#666666'}
                  onChange={e => onFooterChange({ textColor: e.target.value })}
                  placeholder="#666666"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========== 签名区设置 ========== */}
      <div className="space-y-4">
        <h4 className="border-b pb-2 text-sm font-medium">签名区设置</h4>

        {/* 显示签名区 */}
        <div className="flex items-center justify-between">
          <Label htmlFor="show-signature">显示签名区</Label>
          <Switch
            id="show-signature"
            checked={signature.show}
            onCheckedChange={show => onSignatureChange({ show })}
          />
        </div>

        {signature.show && (
          <div className="space-y-4">
            {/* 签名字段列表 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>签名项</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddSignatureField}
                >
                  添加签名项
                </Button>
              </div>

              <div className="space-y-2">
                {signature.fields.map((field, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 rounded border p-2"
                  >
                    <Input
                      value={field.label}
                      onChange={e =>
                        handleUpdateSignatureField(index, {
                          label: e.target.value,
                        })
                      }
                      placeholder="签名名称"
                      className="flex-1"
                    />
                    <NumberInput
                      value={field.width}
                      onChange={width =>
                        handleUpdateSignatureField(index, { width })
                      }
                      min={40}
                      max={150}
                      step={10}
                      className="w-24"
                    />
                    <span className="text-muted-foreground text-xs">mm</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSignatureField(index)}
                    >
                      删除
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* 签名区间距 */}
              <div className="space-y-2">
                <Label htmlFor="signature-spacing">与表格间距 (px)</Label>
                <NumberInput
                  id="signature-spacing"
                  value={signature.spacing}
                  onChange={spacing => onSignatureChange({ spacing })}
                  min={16}
                  max={80}
                  step={8}
                />
              </div>

              {/* 字体大小 */}
              <div className="space-y-2">
                <Label htmlFor="signature-font-size">字体大小 (px)</Label>
                <NumberInput
                  id="signature-font-size"
                  value={signature.fontSize || 12}
                  onChange={fontSize => onSignatureChange({ fontSize })}
                  min={8}
                  max={18}
                  step={1}
                />
              </div>
            </div>

            {/* 签名线颜色 */}
            <div className="space-y-2">
              <Label htmlFor="signature-line-color">签名线颜色</Label>
              <div className="flex gap-2">
                <Input
                  id="signature-line-color"
                  type="color"
                  value={signature.lineColor || '#000000'}
                  onChange={e =>
                    onSignatureChange({ lineColor: e.target.value })
                  }
                  className="h-10 w-20"
                />
                <Input
                  value={signature.lineColor || '#000000'}
                  onChange={e =>
                    onSignatureChange({ lineColor: e.target.value })
                  }
                  placeholder="#000000"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
