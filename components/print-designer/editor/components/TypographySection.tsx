/**
 * 打印设计器 - 字体排版属性面板
 */

'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { TextStyle } from '@/lib/print-designer/schemas';

interface TypographySectionProps {
  style: TextStyle;
  onChange: (updates: Partial<TextStyle>) => void;
}

export function TypographySection({ style, onChange }: TypographySectionProps) {
  return (
    <div className="space-y-3">
      <Label className="text-muted-foreground text-xs">字体排版</Label>

      {/* 字体 */}
      <div className="space-y-1">
        <Label className="text-xs">字体</Label>
        <Select
          value={style.fontFamily}
          onValueChange={v =>
            onChange({ fontFamily: v as TextStyle['fontFamily'] })
          }
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SimSun">宋体</SelectItem>
            <SelectItem value="SimHei">黑体</SelectItem>
            <SelectItem value="Microsoft YaHei">微软雅黑</SelectItem>
            <SelectItem value="Arial">Arial</SelectItem>
            <SelectItem value="Times New Roman">Times New Roman</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 字号 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">字号 (pt)</Label>
          <Input
            type="number"
            min={6}
            max={200}
            value={style.fontSize}
            onChange={e =>
              onChange({ fontSize: parseInt(e.target.value) || 12 })
            }
            className="h-8"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">行高</Label>
          <Input
            type="number"
            min={1}
            max={3}
            step={0.1}
            value={style.lineHeight}
            onChange={e =>
              onChange({ lineHeight: parseFloat(e.target.value) || 1.2 })
            }
            className="h-8"
          />
        </div>
      </div>

      {/* 粗体/斜体 */}
      <div className="space-y-1">
        <Label className="text-xs">样式</Label>
        <div className="flex gap-2">
          <ToggleGroup
            type="single"
            value={style.fontWeight}
            onValueChange={v =>
              v && onChange({ fontWeight: v as 'normal' | 'bold' })
            }
          >
            <ToggleGroupItem value="normal" className="h-8 px-3 text-xs">
              常规
            </ToggleGroupItem>
            <ToggleGroupItem
              value="bold"
              className="h-8 px-3 text-xs font-bold"
            >
              粗体
            </ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup
            type="single"
            value={style.fontStyle}
            onValueChange={v =>
              v && onChange({ fontStyle: v as 'normal' | 'italic' })
            }
          >
            <ToggleGroupItem value="normal" className="h-8 px-3 text-xs">
              N
            </ToggleGroupItem>
            <ToggleGroupItem value="italic" className="h-8 px-3 text-xs italic">
              I
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* 对齐 */}
      <div className="space-y-1">
        <Label className="text-xs">对齐</Label>
        <ToggleGroup
          type="single"
          value={style.textAlign}
          onValueChange={v =>
            v && onChange({ textAlign: v as 'left' | 'center' | 'right' })
          }
          className="justify-start"
        >
          <ToggleGroupItem value="left" className="h-8 px-3 text-xs">
            左
          </ToggleGroupItem>
          <ToggleGroupItem value="center" className="h-8 px-3 text-xs">
            中
          </ToggleGroupItem>
          <ToggleGroupItem value="right" className="h-8 px-3 text-xs">
            右
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* 颜色 */}
      <div className="space-y-1">
        <Label className="text-xs">颜色</Label>
        <div className="flex items-center gap-2 overflow-hidden rounded-md border px-2 py-1">
          <input
            type="color"
            value={style.color}
            onChange={e => onChange({ color: e.target.value })}
            className="h-6 w-6 cursor-pointer rounded border-none bg-transparent p-0"
          />
          <span className="text-muted-foreground font-mono text-xs uppercase">
            {style.color}
          </span>
        </div>
      </div>
    </div>
  );
}
