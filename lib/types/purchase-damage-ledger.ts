import type { InboundDamageHandling } from './inbound';

export type PurchaseDamageLedgerStatus =
  | 'pending_claim'
  | 'claim_submitted'
  | 'compensated'
  | 'internal_closed';

export const PURCHASE_DAMAGE_LEDGER_STATUS_LABELS: Record<
  PurchaseDamageLedgerStatus,
  string
> = {
  pending_claim: '待向工厂登记',
  claim_submitted: '已向工厂登记',
  compensated: '已完成赔付',
  internal_closed: '内部承担已结案',
};

export const PURCHASE_DAMAGE_LEDGER_STATUS_OPTIONS = Object.entries(
  PURCHASE_DAMAGE_LEDGER_STATUS_LABELS
).map(([value, label]) => ({
  value: value as PurchaseDamageLedgerStatus,
  label,
}));

export const PURCHASE_DAMAGE_LEDGER_ALLOWED_TRANSITIONS: Record<
  PurchaseDamageLedgerStatus,
  PurchaseDamageLedgerStatus[]
> = {
  pending_claim: ['claim_submitted', 'compensated', 'internal_closed'],
  claim_submitted: ['compensated', 'internal_closed'],
  compensated: [],
  internal_closed: [],
};

export interface PurchaseDamageLedger {
  id: string;
  ledgerNumber: string;
  inboundRecordId: string;
  purchaseOrderId?: string;
  purchaseOrderItemId?: string;
  productId: string;
  supplierId?: string;
  batchNumber?: string;
  batchPiecesPerUnit?: number;
  damagedQuantity: number;
  damageHandling: InboundDamageHandling;
  referenceAmount?: number;
  status: PurchaseDamageLedgerStatus;
  remarks?: string;
  createdById: string;
  lastHandledById?: string;
  claimedAt?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  inboundRecord?: {
    id: string;
    recordNumber: string;
    createdAt: string;
  };
  purchaseOrder?: {
    id: string;
    orderNumber: string;
  };
  product?: {
    id: string;
    code: string;
    name: string;
    specification?: string;
    piecesPerUnit?: number;
  };
  supplier?: {
    id: string;
    name: string;
  };
  createdBy?: {
    id: string;
    name: string;
  };
  lastHandledBy?: {
    id: string;
    name: string;
  };
}

export interface PurchaseDamageLedgerQueryParams {
  search?: string;
  damageHandling?: InboundDamageHandling;
  status?: PurchaseDamageLedgerStatus;
  startDate?: string;
  endDate?: string;
}

export interface PurchaseDamageLedgerSummary {
  totalCount: number;
  pendingCount: number;
  claimSubmittedCount: number;
  compensatedCount: number;
  internalClosedCount: number;
  totalDamagedQuantity: number;
  totalReferenceAmount: number;
}
