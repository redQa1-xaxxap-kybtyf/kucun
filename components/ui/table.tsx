import * as React from 'react';

import { cn } from '@/lib/utils';

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-x-auto rounded-[var(--radius-medium)] border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] shadow-[var(--shadow-light)]">
    <table
      ref={ref}
      className={cn(
        'text-table-cell w-full caption-bottom border-collapse [&_td.text-right]:tabular-nums [&_th.text-right]:tabular-nums',
        className
      )}
      {...props}
    />
  </div>
));
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      'bg-[hsl(var(--color-bg-table-header))] [&_tr]:border-b [&_tr]:border-[hsl(var(--color-border-secondary))] [&_th]:align-middle',
      className
    )}
    {...props}
  />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))] font-medium last:[&>tr]:border-b-0',
      className
    )}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b border-[hsl(var(--color-border-primary))] transition-colors even:bg-[hsl(var(--color-bg-table-stripe))] hover:bg-[hsl(var(--color-primary-light))] data-[state=selected]:bg-[hsl(var(--color-primary-light))] data-[state=selected]:[box-shadow:inset_3px_0_0_hsl(var(--color-primary))]',
      className
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'text-table-header h-11 whitespace-nowrap bg-[hsl(var(--color-bg-table-header))] px-4 py-3 text-left align-middle font-semibold leading-none [&:has([role=checkbox])]:pr-0 [&_button]:inline-flex [&_button]:h-auto [&_button]:items-center [&_button]:justify-start [&_button]:gap-1.5 [&_button]:rounded-none [&_button]:border-0 [&_button]:bg-transparent [&_button]:p-0 [&_button]:font-inherit [&_button]:leading-none [&_button]:text-inherit [&_button]:shadow-none [&_button]:hover:bg-transparent [&_button]:hover:text-[hsl(var(--color-text-primary))] [&_button_svg]:h-3.5 [&_button_svg]:w-3.5 [&_button_svg]:shrink-0',
      className
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      'text-table-cell px-4 py-3.5 align-middle leading-normal [&:has([role=checkbox])]:pr-0 [&_button]:inline-flex [&_button]:items-center [&_button]:justify-center',
      className
    )}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('text-muted-foreground mt-4 text-sm', className)}
    {...props}
  />
));
TableCaption.displayName = 'TableCaption';

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
