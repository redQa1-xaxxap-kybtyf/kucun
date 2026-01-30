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
          className="h-10 w-10 rounded-2xl"
          onClick={event => event.stopPropagation()}
        >
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="rounded-2xl border-none p-2 shadow-2xl"
      >
        <DropdownMenuItem className="rounded-xl py-2.5 font-bold" asChild>
          <Link
            href={`/suppliers/${supplierId}`}
            onClick={event => event.stopPropagation()}
          >
            <TrendingUp className="mr-2 h-4 w-4" /> 察看合作详情
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem className="rounded-xl py-2.5 font-bold" asChild>
          <Link
            href={`/suppliers/${supplierId}/edit`}
            onClick={event => event.stopPropagation()}
          >
            <Edit className="mr-2 h-4 w-4" /> 修订档案
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="rounded-xl py-2.5 font-bold text-rose-600 focus:bg-rose-500 focus:text-white"
          onClick={event => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> 归档并中止
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

