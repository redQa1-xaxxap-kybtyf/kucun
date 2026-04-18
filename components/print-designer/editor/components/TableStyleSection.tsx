/**
 * 打印设计器 - 表格样式属性面板
 */

'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { TableBorderMode, TableStyle } from '@/lib/print-designer/schemas';
import { TABLE_STYLE_PRESETS } from '@/lib/print-designer/table-style-presets';

interface TableStyleSectionProps {
  style: TableStyle;
  onChange: (updates: Partial<TableStyle>) => void;
}

const BORDER_MODE_OPTIONS: Array<{
  value: TableBorderMode;
  label: string;
  description: string;
}> = [
  {
    value: 'full',
    label: '全边框',
    description: '适合标准订单和常规打印单据',
  },
  {
    value: 'row',
    label: '横线式',
    description: '更清爽，适合明细表和客户清单',
  },
  {
    value: 'outer',
    label: '外框式',
    description: '更像纸质单据，适合套打和手写补充',
  },
];

export function TableStyleSection({ style, onChange }: TableStyleSectionProps) {
  return (
    <div className="space-y-4">
      <Label className="text-muted-foreground text-xs">表格样式</Label>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-900">常用样式</p>
            <p className="text-muted-foreground mt-1 text-[11px] leading-5">
              一键带上表头和表尾风格，后面再按需要微调即可。
            </p>
          </div>
        </div>

        <div className="grid gap-2">
          {TABLE_STYLE_PRESETS.map(preset => (
            <button
              key={preset.key}
              type="button"
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-100"
              onClick={() => onChange(preset.style)}
            >
              <div className="text-sm font-medium text-slate-900">
                {preset.label}
              </div>
              <div className="mt-1 text-[11px] leading-5 text-slate-500">
                {preset.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
        <div>
          <p className="text-xs font-medium text-slate-900">边框风格</p>
          <p className="text-muted-foreground mt-1 text-[11px] leading-5">
            直接切换成中文单据常见的边框表现，不用手动画线。
          </p>
        </div>

        <div className="grid gap-2">
          {BORDER_MODE_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                (style.borderMode ?? 'full') === option.value
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
              }`}
              onClick={() => onChange({ borderMode: option.value })}
            >
              <div className="text-sm font-medium text-slate-900">
                {option.label}
              </div>
              <div className="mt-1 text-[11px] leading-5 text-slate-500">
                {option.description}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 字体大小 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">表头字号</Label>
          <Input
            type="number"
            min={6}
            max={72}
            value={style.headerFontSize}
            onChange={e =>
              onChange({ headerFontSize: parseInt(e.target.value) || 10 })
            }
            className="h-8"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">内容字号</Label>
          <Input
            type="number"
            min={6}
            max={72}
            value={style.bodyFontSize}
            onChange={e =>
              onChange({ bodyFontSize: parseInt(e.target.value) || 10 })
            }
            className="h-8"
          />
        </div>
      </div>

      {/* 行高与边框 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">行高 (mm)</Label>
          <Input
            type="number"
            min={1}
            step={0.5}
            value={style.rowHeight}
            onChange={e =>
              onChange({ rowHeight: parseFloat(e.target.value) || 8 })
            }
            className="h-8"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">边框宽度</Label>
          <Input
            type="number"
            min={0}
            step={0.1}
            value={style.borderWidth}
            onChange={e =>
              onChange({ borderWidth: parseFloat(e.target.value) || 0.5 })
            }
            className="h-8"
          />
        </div>
      </div>

      {/* 颜色设置 */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">颜色设置</Label>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-muted-foreground text-[10px]">
              表头背景
            </Label>
            <div className="flex items-center gap-2 overflow-hidden rounded-md border px-2 py-1">
              <input
                type="color"
                value={style.headerBgColor}
                onChange={e => onChange({ headerBgColor: e.target.value })}
                className="h-5 w-5 cursor-pointer rounded border-none bg-transparent p-0"
              />
              <span className="font-mono text-[10px] uppercase">
                {style.headerBgColor}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-muted-foreground text-[10px]">
              表头文字
            </Label>
            <div className="flex items-center gap-2 overflow-hidden rounded-md border px-2 py-1">
              <input
                type="color"
                value={style.headerTextColor}
                onChange={e => onChange({ headerTextColor: e.target.value })}
                className="h-5 w-5 cursor-pointer rounded border-none bg-transparent p-0"
              />
              <span className="font-mono text-[10px] uppercase">
                {style.headerTextColor}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-muted-foreground text-[10px]">
              条纹颜色
            </Label>
            <div className="flex items-center gap-2 overflow-hidden rounded-md border px-2 py-1">
              <input
                type="color"
                value={style.stripedColor}
                onChange={e => onChange({ stripedColor: e.target.value })}
                className="h-5 w-5 cursor-pointer rounded border-none bg-transparent p-0"
                disabled={!style.stripedRows}
              />
              <span className="font-mono text-[10px] uppercase">
                {style.stripedColor}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-muted-foreground text-[10px]">
              边框颜色
            </Label>
            <div className="flex items-center gap-2 overflow-hidden rounded-md border px-2 py-1">
              <input
                type="color"
                value={style.borderColor}
                onChange={e => onChange({ borderColor: e.target.value })}
                className="h-5 w-5 cursor-pointer rounded border-none bg-transparent p-0"
              />
              <span className="font-mono text-[10px] uppercase">
                {style.borderColor}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 斑马纹 */}
      <div className="flex items-center justify-between rounded-md border bg-slate-50 p-2">
        <Label className="text-xs">启用斑马纹</Label>
        <Switch
          checked={style.stripedRows}
          onCheckedChange={checked => onChange({ stripedRows: checked })}
        />
      </div>

      <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-900">恢复默认样式</p>
            <p className="text-xs leading-5 text-slate-500">
              回到系统默认的标准表格，适合重新开始调整。
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => onChange(TABLE_STYLE_PRESETS[0]?.style ?? {})}
          >
            恢复默认
          </Button>
        </div>
      </div>
    </div>
  );
}
