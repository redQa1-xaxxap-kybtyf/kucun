'use client';

import * as React from 'react';

import { CopyButton } from '@/components/common/copy-button';
import { cn } from '@/lib/utils';

interface CopyableTextProps {
  text: string;
  displayText?: string;
  className?: string;
  iconSize?: 'sm' | 'md' | 'lg';
  showIcon?: 'always' | 'hover' | 'never';
  onCopy?: () => void;
}

/**
 * 可复制文本组件
 *
 * 显示文本内容,并在旁边提供复制按钮
 * 支持hover时显示复制按钮,保持界面简洁
 *
 * @example
 * <CopyableText text="PRD-001" />
 * <CopyableText text="PRD-001" displayText="产品编码: PRD-001" />
 * <CopyableText text="PRD-001" showIcon="always" />
 */
export function CopyableText({
  text,
  displayText,
  className,
  iconSize = 'sm',
  showIcon = 'hover',
  onCopy,
}: CopyableTextProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  const shouldShowIcon =
    showIcon === 'always' || (showIcon === 'hover' && isHovered);

  return (
    <span
      className={cn('group inline-flex items-center gap-1', className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span>{displayText || text}</span>
      {showIcon !== 'never' && (
        <span
          className={cn(
            'transition-opacity',
            shouldShowIcon ? 'opacity-100' : 'opacity-0'
          )}
        >
          <CopyButton text={text} iconSize={iconSize} onCopy={onCopy} />
        </span>
      )}
    </span>
  );
}
