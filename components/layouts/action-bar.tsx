import * as React from 'react';

import { cn } from '@/lib/utils';

type ActionBarAlign = 'start' | 'center' | 'end' | 'between';

interface ActionBarProps {
  children: React.ReactNode;
  align?: ActionBarAlign;
  className?: string;
}

const alignClassNameMap: Record<ActionBarAlign, string> = {
  start: 'sm:justify-start',
  center: 'sm:justify-center',
  end: 'sm:justify-end',
  between: 'sm:justify-between',
};

export function ActionBar({
  children,
  align = 'end',
  className,
}: ActionBarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center',
        '[&>*]:w-full sm:[&>*]:w-auto',
        alignClassNameMap[align],
        className
      )}
    >
      {children}
    </div>
  );
}
