import type { Prisma } from '@prisma/client';

import type { SalesOrderCreateInput } from '@/lib/types/sales-order';

export type CreateInput = SalesOrderCreateInput;
export type OrderItemInput = CreateInput['items'][number];
export type Tx = Prisma.TransactionClient;
