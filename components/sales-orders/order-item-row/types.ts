import type { UseFormReturn } from 'react-hook-form';

import type { SalesOrderCreateFormData } from '@/lib/validations/sales-order';

export type OrderFormInstance = UseFormReturn<SalesOrderCreateFormData>;
