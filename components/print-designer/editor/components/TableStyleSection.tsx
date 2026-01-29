/**
 * 打印设计器 - 表格样式属性面板
 */

'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { TableStyle } from '@/lib/print-designer/schemas';

interface TableStyleSectionProps {
  style: TableStyle;
  onChange: (updates: Partial<TableStyle>) => void;
}

export function TableStyleSection({ style, onChange }: TableStyleSectionProps) {
  return (
    <div className="space-y-4">
      <Label className="text-muted-foreground text-xs">表格样式</Label>

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
    </div>
  );
}
