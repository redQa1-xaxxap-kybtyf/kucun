export type ManualDamageCategory =
  | 'damage'
  | 'scrap'
  | 'loss'
  | 'other';

export const MANUAL_DAMAGE_CATEGORY_LABELS: Record<
  ManualDamageCategory,
  string
> = {
  damage: '破损',
  scrap: '报废',
  loss: '丢失',
  other: '其他',
};

export const MANUAL_DAMAGE_CATEGORY_OPTIONS = Object.entries(
  MANUAL_DAMAGE_CATEGORY_LABELS
).map(([value, label]) => ({
  value: value as ManualDamageCategory,
  label,
}));

export type ManualDamageHandling =
  | 'pending_confirm'
  | 'supplier_claim'
  | 'internal_loss';

export const MANUAL_DAMAGE_HANDLING_LABELS: Record<
  ManualDamageHandling,
  string
> = {
  pending_confirm: '待确认',
  supplier_claim: '找工厂赔付',
  internal_loss: '内部承担',
};

export const MANUAL_DAMAGE_HANDLING_OPTIONS = Object.entries(
  MANUAL_DAMAGE_HANDLING_LABELS
).map(([value, label]) => ({
  value: value as ManualDamageHandling,
  label,
}));

export type ManualDamageLedgerStatus =
  | 'pending_review'
  | 'pending_claim'
  | 'claim_submitted'
  | 'compensated'
  | 'internal_closed';

export const MANUAL_DAMAGE_LEDGER_STATUS_LABELS: Record<
  ManualDamageLedgerStatus,
  string
> = {
  pending_review: '待补充处理',
  pending_claim: '待向工厂登记',
  claim_submitted: '已向工厂登记',
  compensated: '已完成赔付',
  internal_closed: '内部承担已结案',
};

export const MANUAL_DAMAGE_LEDGER_STATUS_OPTIONS = Object.entries(
  MANUAL_DAMAGE_LEDGER_STATUS_LABELS
).map(([value, label]) => ({
  value: value as ManualDamageLedgerStatus,
  label,
}));

export const MANUAL_DAMAGE_LEDGER_ALLOWED_TRANSITIONS: Record<
  ManualDamageLedgerStatus,
  ManualDamageLedgerStatus[]
> = {
  pending_review: [
    'pending_claim',
    'claim_submitted',
    'compensated',
    'internal_closed',
  ],
  pending_claim: ['claim_submitted', 'compensated', 'internal_closed'],
  claim_submitted: ['compensated', 'internal_closed'],
  compensated: [],
  internal_closed: [],
};

export interface ManualDamageLedger {
  id: string;
  ledgerNumber: string;
  adjustmentId: string;
  productId: string;
  variantId?: string;
  supplierId?: string;
  batchNumber?: string;
  batchPiecesPerUnit?: number;
  damagedQuantity: number;
  damageCategory: ManualDamageCategory;
  damageHandling: ManualDamageHandling;
  referenceAmount?: number;
  status: ManualDamageLedgerStatus;
  remarks?: string;
  createdById: string;
  lastHandledById?: string;
  claimedAt?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  adjustment?: {
    id: string;
    adjustmentNumber: string;
    createdAt: string;
    notes?: string;
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

export interface ManualDamageLedgerQueryParams {
  search?: string;
  damageCategory?: ManualDamageCategory;
  damageHandling?: ManualDamageHandling;
  status?: ManualDamageLedgerStatus;
  startDate?: string;
  endDate?: string;
}

export interface ManualDamageLedgerSummary {
  totalCount: number;
  pendingReviewCount: number;
  pendingClaimCount: number;
  claimSubmittedCount: number;
  compensatedCount: number;
  internalClosedCount: number;
  totalDamagedQuantity: number;
  totalReferenceAmount: number;
}
