'use client';

import { Edit, MoreHorizontal, Trash2, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function SupplierRowActions({
  supplierId,
  onDelete,
}: {
  supplierId: string;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-md"
          onClick={event => event.stopPropagation()}
        >
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-md p-1.5 shadow-md">
        <DropdownMenuItem className="rounded-md py-2 font-medium" asChild>
          <Link
            href={`/suppliers/${supplierId}`}
            onClick={event => event.stopPropagation()}
          >
            <TrendingUp className="mr-2 h-4 w-4" /> 查看详情
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="rounded-md py-2 font-medium" asChild>
          <Link
            href={`/suppliers/${supplierId}/edit`}
            onClick={event => event.stopPropagation()}
          >
            <Edit className="mr-2 h-4 w-4" /> 编辑资料
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="rounded-md py-2 font-medium text-rose-600 focus:bg-rose-50 focus:text-rose-700"
          onClick={event => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> 删除供应商
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
