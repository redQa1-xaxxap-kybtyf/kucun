import { z } from 'zod';

import { inboundDamageHandlingSchema } from './inbound';

export const purchaseDamageLedgerStatusSchema = z.enum([
  'pending_claim',
  'claim_submitted',
  'compensated',
  'internal_closed',
]);

export const purchaseDamageLedgerQuerySchema = z.object({
  search: z.string().trim().optional(),
  damageHandling: inboundDamageHandlingSchema.optional(),
  status: purchaseDamageLedgerStatusSchema.optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
});

export const updatePurchaseDamageLedgerSchema = z.object({
  status: purchaseDamageLedgerStatusSchema,
  remarks: z
    .string()
    .trim()
    .max(500, '跟进备注不能超过 500 个字')
    .optional(),
});
