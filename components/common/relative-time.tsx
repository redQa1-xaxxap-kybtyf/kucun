'use client';

import * as React from 'react';

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
    formatFullTimestamp,
    getRelativeTimeText,
    isWithin24Hours,
    type DateInput,
} from '@/lib/utils/datetime';

interface RelativeTimeProps {
  date: DateInput;
  showTooltip?: boolean;
  autoUpdate?: boolean;
  updateInterval?: number;
  className?: string;
}

/**
 * 相对时间显示组件
 *
 * 24小时内显示相对时间("刚刚"、"X分钟前"、"X小时前")
 * 超过24小时显示标准日期时间格式
 * 鼠标悬停显示完整时间戳
 *
 * @example
 * <RelativeTime date={new Date()} />
 * <RelativeTime date="2025-01-20T10:00:00Z" showTooltip={true} />
 * <RelativeTime date={createdAt} autoUpdate={true} />
 */
export function RelativeTime({
  date,
  showTooltip = true,
  autoUpdate = false,
  updateInterval = 60000, // 默认每分钟更新一次
  className,
}: RelativeTimeProps) {
  const [relativeText, setRelativeText] = React.useState(() =>
    getRelativeTimeText(date)
  );

  // 自动更新逻辑(仅在24小时内且启用autoUpdate时)
  React.useEffect(() => {
    if (!autoUpdate || !isWithin24Hours(date)) {
      return;
    }

    const timer = setInterval(() => {
      setRelativeText(getRelativeTimeText(date));
    }, updateInterval);

    return () => clearInterval(timer);
  }, [date, autoUpdate, updateInterval]);

  // 当date变化时更新显示
  React.useEffect(() => {
    setRelativeText(getRelativeTimeText(date));
  }, [date]);

  const fullTimestamp = formatFullTimestamp(date);

  if (!showTooltip || !fullTimestamp) {
    return (
      <span className={cn('text-muted-foreground', className)}>
        {relativeText}
      </span>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'text-muted-foreground',
              className
            )}
          >
            {relativeText}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{fullTimestamp}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
