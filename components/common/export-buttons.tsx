/**
 * 导出按钮组件
 */

import { Download, FileImage, FileSpreadsheet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';

export interface ExportButtonsProps {
  /** 是否正在导出图片 */
  isExportingImage?: boolean;
  /** 是否正在导出Excel */
  isExportingExcel?: boolean;
  /** 是否禁用导出 */
  disabled?: boolean;
  /** 尺寸 */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** 变体 */
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link';
  /** 类名 */
  className?: string;
  /** 导出图片回调 */
  onExportImage?: () => void | Promise<void>;
  /** 导出Excel回调 */
  onExportExcel?: () => void;
  /** 导出完整Excel回调 */
  onExportCompleteExcel?: () => void;
  /** 显示完整Excel选项 */
  showCompleteExcel?: boolean;
}

/**
 * 导出按钮组件
 */
export function ExportButtons({
  isExportingImage = false,
  isExportingExcel = false,
  disabled = false,
  size = 'default',
  variant = 'default',
  className = '',
  onExportImage,
  onExportExcel,
  onExportCompleteExcel,
  showCompleteExcel = true,
}: ExportButtonsProps) {
  const isLoading = isExportingImage || isExportingExcel;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={disabled || isLoading}
          className={className}
        >
          {isLoading ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              导出中...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              导出
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onExportImage} disabled={isExportingImage}>
          {isExportingImage ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              生成图片中...
            </>
          ) : (
            <>
              <FileImage className="mr-2 h-4 w-4" />
              导出为图片
            </>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={onExportExcel} disabled={isExportingExcel}>
          {isExportingExcel ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              生成Excel中...
            </>
          ) : (
            <>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              导出为Excel
            </>
          )}
        </DropdownMenuItem>

        {showCompleteExcel && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onExportCompleteExcel}
              disabled={isExportingExcel}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              导出完整Excel
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * 简单导出按钮组件（只显示单个导出选项）
 */
export interface SimpleExportButtonProps {
  /** 导出类型 */
  type: 'image' | 'excel' | 'complete-excel';
  /** 是否正在导出 */
  isLoading?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 尺寸 */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** 变体 */
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link';
  /** 类名 */
  className?: string;
  /** 点击回调 */
  onClick?: () => void | Promise<void>;
  /** 自定义文本 */
  text?: string;
}

export function SimpleExportButton({
  type,
  isLoading = false,
  disabled = false,
  size = 'default',
  variant = 'outline',
  className = '',
  onClick,
  text,
}: SimpleExportButtonProps) {
  const getIcon = () => {
    switch (type) {
      case 'image':
        return <FileImage className="mr-2 h-4 w-4" />;
      case 'excel':
      case 'complete-excel':
        return <FileSpreadsheet className="mr-2 h-4 w-4" />;
      default:
        return <Download className="mr-2 h-4 w-4" />;
    }
  };

  const getDefaultText = () => {
    switch (type) {
      case 'image':
        return '导出图片';
      case 'excel':
        return '导出Excel';
      case 'complete-excel':
        return '导出完整Excel';
      default:
        return '导出';
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={className}
    >
      {isLoading ? (
        <>
          <Spinner className="mr-2 h-4 w-4" />
          导出中...
        </>
      ) : (
        <>
          {getIcon()}
          {text || getDefaultText()}
        </>
      )}
    </Button>
  );
}
