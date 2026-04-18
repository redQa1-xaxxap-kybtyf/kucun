/**
 * 打印设计器 - 线条/边框属性面板
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
import type {
  DashStyle,
  LineStyle,
  RectStyle,
} from '@/lib/print-designer/schemas';

type LineShapeStyleSectionProps = {
  type: 'line';
  style: LineStyle;
  onChange: (updates: Partial<LineStyle>) => void;
};

type RectShapeStyleSectionProps = {
  type: 'rect';
  style: RectStyle;
  onChange: (updates: Partial<RectStyle>) => void;
};

type ShapeStyleSectionProps =
  | LineShapeStyleSectionProps
  | RectShapeStyleSectionProps;

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-muted-foreground text-[10px]">{label}</Label>
      <div className="flex items-center gap-2 overflow-hidden rounded-md border px-2 py-1">
        <input
          type="color"
          value={value}
          onChange={event => onChange(event.target.value)}
          className="h-5 w-5 cursor-pointer rounded border-none bg-transparent p-0"
        />
        <span className="font-mono text-[10px] uppercase">{value}</span>
      </div>
    </div>
  );
}

export function ShapeStyleSection({
  type,
  style,
  onChange,
}: ShapeStyleSectionProps) {
  const strokeWidth = type === 'line' ? style.strokeWidth : style.borderWidth;
  const dashStyle = style.dashStyle;

  return (
    <div className="space-y-4">
      <Label className="text-muted-foreground text-xs">
        {type === 'line' ? '横线样式' : '边框样式'}
      </Label>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">
            {type === 'line' ? '线宽' : '边框宽度'}
          </Label>
          <Input
            type="number"
            min={0.2}
            max={6}
            step={0.1}
            value={strokeWidth}
            onChange={event => {
              const value = parseFloat(event.target.value) || 0.6;
              onChange(
                type === 'line'
                  ? { strokeWidth: value }
                  : { borderWidth: value }
              );
            }}
            className="h-8"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">线型</Label>
          <Select
            value={dashStyle}
            onValueChange={value => onChange({ dashStyle: value as DashStyle })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solid">实线</SelectItem>
              <SelectItem value="dashed">虚线</SelectItem>
              <SelectItem value="dotted">点线</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {type === 'line' ? (
        <ColorField
          label="线条颜色"
          value={style.color}
          onChange={value => onChange({ color: value })}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <ColorField
              label="边框颜色"
              value={style.borderColor}
              onChange={value => onChange({ borderColor: value })}
            />
            <ColorField
              label="填充颜色"
              value={style.fillColor}
              onChange={value => onChange({ fillColor: value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">填充透明度</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={style.fillOpacity}
                onChange={event =>
                  onChange({
                    fillOpacity: Math.max(
                      0,
                      Math.min(1, parseFloat(event.target.value) || 0)
                    ),
                  })
                }
                className="h-8"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">圆角</Label>
              <Input
                type="number"
                min={0}
                max={20}
                step={0.5}
                value={style.radius}
                onChange={event =>
                  onChange({
                    radius: Math.max(
                      0,
                      Math.min(20, parseFloat(event.target.value) || 0)
                    ),
                  })
                }
                className="h-8"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
