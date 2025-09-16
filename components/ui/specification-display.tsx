// 规格展示组件 - 瓷砖行业特色组件
// 用于展示瓷砖的尺寸、厚度、表面处理等规格信息

import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// 规格展示变体定义
const specificationDisplayVariants = cva(
  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary border border-primary/20',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border border-border text-foreground hover:bg-accent',
        size: 'bg-blue-50 text-blue-700 border border-blue-200',
        thickness: 'bg-green-50 text-green-700 border border-green-200',
        surface: 'bg-purple-50 text-purple-700 border border-purple-200',
        grade: 'bg-orange-50 text-orange-700 border border-orange-200',
      },
      size: {
        sm: 'text-xs px-1.5 py-0.5',
        default: 'text-xs px-2 py-1',
        lg: 'text-sm px-2.5 py-1.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

// 瓷砖规格接口定义
export interface TileSpecification {
  // 尺寸规格
  length?: number; // 长度 (mm)
  width?: number; // 宽度 (mm)
  thickness?: number; // 厚度 (mm)

  // 表面处理
  surface?:
    | 'glossy'
    | 'matte'
    | 'textured'
    | 'polished'
    | 'natural'
    | 'antique';

  // 等级
  grade?: 'AAA' | 'AA' | 'A' | 'B';

  // 吸水率
  waterAbsorption?: number; // 百分比

  // 防滑等级
  slipResistance?: 'R9' | 'R10' | 'R11' | 'R12' | 'R13';

  // 耐磨等级
  wearResistance?: 'PEI1' | 'PEI2' | 'PEI3' | 'PEI4' | 'PEI5';

  // 抗冻等级
  frostResistance?: boolean;

  // 其他规格
  weight?: number; // 重量 (kg/m²)
  packingQuantity?: number; // 包装数量 (片/箱)
  coverageArea?: number; // 覆盖面积 (m²/箱)
}

// 表面处理标签映射
const SURFACE_LABELS: Record<string, string> = {
  glossy: '亮光',
  matte: '哑光',
  textured: '纹理',
  polished: '抛光',
  natural: '自然面',
  antique: '仿古',
};

// 等级标签映射
const GRADE_LABELS: Record<string, string> = {
  AAA: '优等品',
  AA: '一等品',
  A: '合格品',
  B: '处理品',
};

export interface SpecificationDisplayProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof specificationDisplayVariants> {
  specification: TileSpecification;
  showAll?: boolean;
  compact?: boolean;
}

const SpecificationDisplay = React.forwardRef<
  HTMLDivElement,
  SpecificationDisplayProps
>(
  (
    {
      className,
      variant,
      size,
      specification,
      showAll = false,
      compact = false,
      ...props
    },
    ref
  ) => {
    const {
      length,
      width,
      thickness,
      surface,
      grade,
      waterAbsorption,
      slipResistance,
      wearResistance,
      frostResistance,
      weight,
      packingQuantity,
      coverageArea,
    } = specification;

    // 紧凑模式只显示核心规格
    if (compact) {
      return (
        <div
          className={cn('flex flex-wrap gap-1', className)}
          ref={ref}
          {...props}
        >
          {length && width && (
            <Badge variant="outline" className="text-xs">
              {length}×{width}mm
            </Badge>
          )}
          {thickness && (
            <Badge variant="outline" className="text-xs">
              {thickness}mm厚
            </Badge>
          )}
          {surface && (
            <Badge variant="outline" className="text-xs">
              {SURFACE_LABELS[surface]}
            </Badge>
          )}
          {grade && (
            <Badge variant="outline" className="text-xs">
              {GRADE_LABELS[grade]}
            </Badge>
          )}
        </div>
      );
    }

    return (
      <div className={cn('space-y-3', className)} ref={ref} {...props}>
        {/* 基础尺寸信息 */}
        <div className="flex flex-wrap gap-2">
          {length && width && (
            <div
              className={cn(
                specificationDisplayVariants({ variant: 'size', size })
              )}
            >
              <svg
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              </svg>
              <span>
                {length}×{width}mm
              </span>
            </div>
          )}

          {thickness && (
            <div
              className={cn(
                specificationDisplayVariants({ variant: 'thickness', size })
              )}
            >
              <svg
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                />
              </svg>
              <span>{thickness}mm厚</span>
            </div>
          )}
        </div>

        {/* 表面处理和等级 */}
        <div className="flex flex-wrap gap-2">
          {surface && (
            <div
              className={cn(
                specificationDisplayVariants({ variant: 'surface', size })
              )}
            >
              <svg
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z"
                />
              </svg>
              <span>{SURFACE_LABELS[surface]}</span>
            </div>
          )}

          {grade && (
            <div
              className={cn(
                specificationDisplayVariants({ variant: 'grade', size })
              )}
            >
              <svg
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
              <span>{GRADE_LABELS[grade]}</span>
            </div>
          )}
        </div>

        {/* 详细规格信息 */}
        {showAll && (
          <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
            {waterAbsorption !== undefined && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <span>吸水率:</span>
                <span className="font-medium">{waterAbsorption}%</span>
              </div>
            )}

            {slipResistance && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <span>防滑等级:</span>
                <span className="font-medium">{slipResistance}</span>
              </div>
            )}

            {wearResistance && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <span>耐磨等级:</span>
                <span className="font-medium">{wearResistance}</span>
              </div>
            )}

            {frostResistance !== undefined && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <span>抗冻:</span>
                <span className="font-medium">
                  {frostResistance ? '是' : '否'}
                </span>
              </div>
            )}

            {weight && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <span>重量:</span>
                <span className="font-medium">{weight}kg/m²</span>
              </div>
            )}

            {packingQuantity && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <span>包装:</span>
                <span className="font-medium">{packingQuantity}片/箱</span>
              </div>
            )}

            {coverageArea && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <span>覆盖面积:</span>
                <span className="font-medium">{coverageArea}m²/箱</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

SpecificationDisplay.displayName = 'SpecificationDisplay';

// 规格卡片组件
export interface SpecificationCardProps {
  specification: TileSpecification;
  title?: string;
  className?: string;
}

const SpecificationCard = React.forwardRef<
  HTMLDivElement,
  SpecificationCardProps
>(({ specification, title = '产品规格', className, ...props }, ref) => (
    <Card className={cn('', className)} ref={ref} {...props}>
      <CardContent className="p-4">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          {title}
        </h4>
        <SpecificationDisplay specification={specification} showAll />
      </CardContent>
    </Card>
  ));

SpecificationCard.displayName = 'SpecificationCard';

// 规格比较组件
export interface SpecificationCompareProps {
  specifications: Array<{
    id: string;
    name: string;
    specification: TileSpecification;
  }>;
  className?: string;
}

const SpecificationCompare = React.forwardRef<
  HTMLDivElement,
  SpecificationCompareProps
>(({ specifications, className, ...props }, ref) => {
  if (specifications.length === 0) return null;

  return (
    <div className={cn('overflow-x-auto', className)} ref={ref} {...props}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left font-medium">规格项目</th>
            {specifications.map(spec => (
              <th key={spec.id} className="min-w-32 p-2 text-left font-medium">
                {spec.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="p-2 text-muted-foreground">尺寸</td>
            {specifications.map(spec => (
              <td key={spec.id} className="p-2">
                {spec.specification.length && spec.specification.width
                  ? `${spec.specification.length}×${spec.specification.width}mm`
                  : '-'}
              </td>
            ))}
          </tr>
          <tr className="border-b">
            <td className="p-2 text-muted-foreground">厚度</td>
            {specifications.map(spec => (
              <td key={spec.id} className="p-2">
                {spec.specification.thickness
                  ? `${spec.specification.thickness}mm`
                  : '-'}
              </td>
            ))}
          </tr>
          <tr className="border-b">
            <td className="p-2 text-muted-foreground">表面处理</td>
            {specifications.map(spec => (
              <td key={spec.id} className="p-2">
                {spec.specification.surface
                  ? SURFACE_LABELS[spec.specification.surface]
                  : '-'}
              </td>
            ))}
          </tr>
          <tr className="border-b">
            <td className="p-2 text-muted-foreground">等级</td>
            {specifications.map(spec => (
              <td key={spec.id} className="p-2">
                {spec.specification.grade
                  ? GRADE_LABELS[spec.specification.grade]
                  : '-'}
              </td>
            ))}
          </tr>
          <tr className="border-b">
            <td className="p-2 text-muted-foreground">吸水率</td>
            {specifications.map(spec => (
              <td key={spec.id} className="p-2">
                {spec.specification.waterAbsorption !== undefined
                  ? `${spec.specification.waterAbsorption}%`
                  : '-'}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
});

SpecificationCompare.displayName = 'SpecificationCompare';

export {
  SpecificationDisplay,
  SpecificationCard,
  SpecificationCompare,
  specificationDisplayVariants,
  SURFACE_LABELS,
  GRADE_LABELS,
  type TileSpecification,
};
