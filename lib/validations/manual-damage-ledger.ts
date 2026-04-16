import { z } from 'zod';

export const manualDamageCategorySchema = z.enum([
  'damage',
  'scrap',
  'loss',
  'other',
]);

export const manualDamageHandlingSchema = z.enum([
  'pending_confirm',
  'supplier_claim',
  'internal_loss',
]);

export const manualDamageLedgerStatusSchema = z.enum([
  'pending_review',
  'pending_claim',
  'claim_submitted',
  'compensated',
  'internal_closed',
]);

export const manualDamageLedgerQuerySchema = z.object({
  search: z.string().trim().optional(),
  damageCategory: manualDamageCategorySchema.optional(),
  damageHandling: manualDamageHandlingSchema.optional(),
  status: manualDamageLedgerStatusSchema.optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
});

export const updateManualDamageLedgerSchema = z.object({
  status: manualDamageLedgerStatusSchema,
  damageCategory: manualDamageCategorySchema,
  damageHandling: manualDamageHandlingSchema,
  remarks: z
    .string()
    .trim()
    .max(500, '跟进备注不能超过 500 个字')
    .optional(),
});
