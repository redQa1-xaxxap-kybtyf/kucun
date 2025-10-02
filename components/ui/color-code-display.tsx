// 色号显示器组件 - 瓷砖行业特色组件
// 基于 shadcn/ui Badge 组件扩展，支持色号的可视化展示

import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

// 色号显示器变体定义
const colorCodeDisplayVariants = cva(
  'inline-flex items-center gap-2 rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline:
          'text-foreground border-border hover:bg-accent hover:text-accent-foreground',
        tile: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
      },
      size: {
        default: 'h-6',
        sm: 'h-5 text-xs',
        lg: 'h-7 text-sm',
      },
    },
    defaultVariants: {
      variant: 'tile',
      size: 'default',
    },
  }
);

// 色号颜色映射 - 常见瓷砖色号对应的颜色
const COLOR_CODE_COLORS: Record<string, string> = {
  // 白色系
  W001: '#FFFFFF',
  W002: '#FEFEFE',
  W003: '#F8F8F8',
  W004: '#F5F5F5',
  W005: '#F0F0F0',

  // 灰色系
  G001: '#E5E5E5',
  G002: '#CCCCCC',
  G003: '#999999',
  G004: '#666666',
  G005: '#333333',

  // 米色系
  B001: '#F5F5DC',
  B002: '#F0E68C',
  B003: '#DDD8C0',
  B004: '#D2B48C',
  B005: '#BC9A6A',

  // 棕色系
  BR001: '#A0522D',
  BR002: '#8B4513',
  BR003: '#654321',
  BR004: '#4A4A4A',
  BR005: '#2F1B14',

  // 黑色系
  BK001: '#2C2C2C',
  BK002: '#1C1C1C',
  BK003: '#0C0C0C',
  BK004: '#000000',

  // 红色系
  R001: '#FFE4E1',
  R002: '#FFC0CB',
  R003: '#FF69B4',
  R004: '#DC143C',
  R005: '#8B0000',

  // 蓝色系
  BL001: '#E6F3FF',
  BL002: '#B3D9FF',
  BL003: '#4A90E2',
  BL004: '#1E3A8A',
  BL005: '#0F172A',

  // 绿色系
  GR001: '#F0FFF0',
  GR002: '#90EE90',
  GR003: '#32CD32',
  GR004: '#228B22',
  GR005: '#006400',

  // 黄色系
  Y001: '#FFFACD',
  Y002: '#FFFF99',
  Y003: '#FFD700',
  Y004: '#FFA500',
  Y005: '#FF8C00',
};

export interface ColorCodeDisplayProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof colorCodeDisplayVariants> {
  colorCode: string;
  showColorSwatch?: boolean;
  showLabel?: boolean;
  label?: string;
  interactive?: boolean;
  onColorCodeClick?: (colorCode: string) => void;
}

const ColorCodeDisplay = React.forwardRef<
  HTMLDivElement,
  ColorCodeDisplayProps
>(
  (
    {
      className,
      variant,
      size,
      colorCode,
      showColorSwatch = true,
      showLabel = true,
      label,
      interactive = false,
      onColorCodeClick,
      ...props
    },
    ref
  ) => {
    const colorValue = COLOR_CODE_COLORS[colorCode] || '#CCCCCC';
    const displayLabel = label || colorCode;

    const handleClick = () => {
      if (interactive && onColorCodeClick) {
        onColorCodeClick(colorCode);
      }
    };

    return (
      <div
        className={cn(
          colorCodeDisplayVariants({ variant, size }),
          interactive && 'cursor-pointer transition-transform hover:scale-105',
          className
        )}
        ref={ref}
        onClick={handleClick}
        {...props}
      >
        {showColorSwatch && (
          <div
            className="h-3 w-3 shrink-0 rounded-full border border-gray-300"
            style={{ backgroundColor: colorValue }}
            title={`色号: ${colorCode}`}
          />
        )}
        {showLabel && <span className="font-mono text-xs">{displayLabel}</span>}
      </div>
    );
  }
);

ColorCodeDisplay.displayName = 'ColorCodeDisplay';

// 色号选择器组件
export interface ColorCodeSelectorProps {
  value?: string;
  onValueChange?: (value: string) => void;
  colorCodes?: string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const ColorCodeSelector = React.forwardRef<
  HTMLDivElement,
  ColorCodeSelectorProps
>(
  (
    {
      value,
      onValueChange,
      colorCodes = Object.keys(COLOR_CODE_COLORS).slice(0, 20), // 默认显示前20个色号
      placeholder = '选择色号',
      className,
      disabled = false,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);

    return (
      <div className={cn('relative', className)} ref={ref} {...props}>
        {/* 当前选中的色号显示 */}
        <button
          type="button"
          className={cn(
            'border-input bg-background hover:bg-accent hover:text-accent-foreground flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm',
            disabled && 'cursor-not-allowed opacity-50',
            'focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-hidden'
          )}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
        >
          {value ? (
            <ColorCodeDisplay
              colorCode={value}
              variant="outline"
              size="sm"
              className="border-none bg-transparent"
            />
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <svg
            className={cn(
              'h-4 w-4 transition-transform',
              isOpen && 'rotate-180 transform'
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* 色号选择下拉框 */}
        {isOpen && !disabled && (
          <div className="border-border bg-popover absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border shadow-lg">
            <div className="p-2">
              <div className="grid grid-cols-4 gap-2">
                {colorCodes.map(code => (
                  <button
                    key={code}
                    type="button"
                    className="hover:bg-accent rounded-sm p-1 transition-colors"
                    onClick={() => {
                      onValueChange?.(code);
                      setIsOpen(false);
                    }}
                  >
                    <ColorCodeDisplay
                      colorCode={code}
                      variant="outline"
                      size="sm"
                      className="w-full justify-center"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

ColorCodeSelector.displayName = 'ColorCodeSelector';

// 色号网格展示组件
export interface ColorCodeGridProps {
  colorCodes: string[];
  selectedColorCode?: string;
  onColorCodeSelect?: (colorCode: string) => void;
  columns?: number;
  className?: string;
}

const ColorCodeGrid = React.forwardRef<HTMLDivElement, ColorCodeGridProps>(
  (
    {
      colorCodes,
      selectedColorCode,
      onColorCodeSelect,
      columns = 6,
      className,
      ...props
    },
    ref
  ) => (
    <div
      className={cn('grid gap-2', className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      ref={ref}
      {...props}
    >
      {colorCodes.map(code => (
        <ColorCodeDisplay
          key={code}
          colorCode={code}
          variant={selectedColorCode === code ? 'default' : 'outline'}
          size="sm"
          interactive
          onColorCodeClick={onColorCodeSelect}
          className={cn(
            'justify-center',
            selectedColorCode === code && 'ring-primary ring-2 ring-offset-2'
          )}
        />
      ))}
    </div>
  )
);

ColorCodeGrid.displayName = 'ColorCodeGrid';

export {
  COLOR_CODE_COLORS,
  ColorCodeDisplay,
  colorCodeDisplayVariants,
  ColorCodeGrid,
  ColorCodeSelector,
};
