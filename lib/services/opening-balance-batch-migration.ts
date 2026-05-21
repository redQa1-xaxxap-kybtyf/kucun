import type { Prisma } from '@prisma/client';

import { ApiError } from '@/lib/api/errors';

interface OpeningBalanceMigrationRecord {
  id: string;
  productId: string;
  variantId: string | null;
  batchNumber: string | null;
  quantity: number;
  unitCost: Prisma.Decimal | number | null;
}

interface OpeningBalanceMigrationInventory {
  id: string;
  quantity: number;
  reservedQuantity: number;
}

interface OpeningBalanceMigrationCostEntry {
  id: string;
  remainingQty: number;
}

export interface MigrateOpeningBalanceBatchArgs {
  record: OpeningBalanceMigrationRecord;
  inventory: OpeningBalanceMigrationInventory;
  costEntry: OpeningBalanceMigrationCostEntry | null;
  consumedQty: number;
  toBatchNumber: string;
}

export interface MigrateOpeningBalanceBatchResult {
  newInventoryId: string;
  newBatchSpecificationId: string | null;
}

/**
 * 期初批次号迁移：仅当数据未被使用时调用。
 * - 拒绝目标批次冲突
 * - 沿用原批次包装规格（piecesPerUnit/weight/thickness）
 */
export async function migrateOpeningBalanceBatch(
  tx: Prisma.TransactionClient,
  args: MigrateOpeningBalanceBatchArgs
): Promise<MigrateOpeningBalanceBatchResult> {
  validateMigrationPreconditions(args);

  const { record, inventory, costEntry, toBatchNumber } = args;

  await assertTargetBatchVacant(tx, {
    productId: record.productId,
    variantId: record.variantId,
    toBatchNumber,
  });

  const newBatchSpecificationId = await reuseBatchSpecification(tx, {
    productId: record.productId,
    variantId: record.variantId,
    fromBatchNumber: record.batchNumber,
    toBatchNumber,
  });

  await tx.inventory.delete({ where: { id: inventory.id } });

  const newInventory = await tx.inventory.create({
    data: {
      productId: record.productId,
      variantId: record.variantId,
      batchNumber: toBatchNumber,
      quantity: record.quantity,
      reservedQuantity: 0,
      unitCost: record.unitCost ?? undefined,
      updatedAt: new Date(),
    },
    select: { id: true },
  });

  if (costEntry) {
    await tx.inventoryCostQueue.update({
      where: { id: costEntry.id },
      data: { batchNumber: toBatchNumber },
    });
  }

  return {
    newInventoryId: newInventory.id,
    newBatchSpecificationId,
  };
}

function validateMigrationPreconditions(args: MigrateOpeningBalanceBatchArgs) {
  const { record, inventory, costEntry, consumedQty, toBatchNumber } = args;

  const trimmedTarget = toBatchNumber.trim();
  if (!trimmedTarget) {
    throw ApiError.badRequest('目标批次号不能为空');
  }
  if (trimmedTarget === record.batchNumber) {
    throw ApiError.badRequest('目标批次号与当前批次号一致，无需迁移');
  }

  if (consumedQty > 0) {
    throw ApiError.badRequest(
      `该期初记录已被后续业务消耗 ${consumedQty} 片，不能调整批次号`
    );
  }
  if (inventory.reservedQuantity > 0) {
    throw ApiError.badRequest(
      `该批次仍有 ${inventory.reservedQuantity} 片处于预留中，不能调整批次号`
    );
  }
  if (inventory.quantity !== record.quantity) {
    throw ApiError.badRequest(
      '该批次库存数量与原始期初数量不一致，可能存在其它入库或调整记录，无法安全迁移批次'
    );
  }
  if (costEntry && costEntry.remainingQty !== record.quantity) {
    throw ApiError.badRequest(
      'FIFO 队列剩余数量与原始期初数量不一致，无法安全迁移批次'
    );
  }
}

async function assertTargetBatchVacant(
  tx: Prisma.TransactionClient,
  args: {
    productId: string;
    variantId: string | null;
    toBatchNumber: string;
  }
) {
  const conflict = await tx.inventory.findFirst({
    where: {
      productId: args.productId,
      variantId: args.variantId,
      batchNumber: args.toBatchNumber,
    },
    select: { id: true },
  });

  if (conflict) {
    throw ApiError.badRequest(
      `目标批次号 ${args.toBatchNumber} 已存在库存，请先核对或选用其它批次号`
    );
  }
}

async function reuseBatchSpecification(
  tx: Prisma.TransactionClient,
  args: {
    productId: string;
    variantId: string | null;
    fromBatchNumber: string | null;
    toBatchNumber: string;
  }
): Promise<string | null> {
  const variantKey = args.variantId ?? '';

  const existingTarget = await tx.batchSpecification.findFirst({
    where: {
      productId: args.productId,
      variantKey,
      batchNumber: args.toBatchNumber,
    },
    select: { id: true },
  });

  if (existingTarget) {
    return existingTarget.id;
  }

  if (!args.fromBatchNumber) {
    return null;
  }

  const fromSpec = await tx.batchSpecification.findFirst({
    where: {
      productId: args.productId,
      variantKey,
      batchNumber: args.fromBatchNumber,
    },
    select: {
      piecesPerUnit: true,
      weight: true,
      thickness: true,
    },
  });

  if (!fromSpec) {
    return null;
  }

  const created = await tx.batchSpecification.create({
    data: {
      productId: args.productId,
      variantId: args.variantId,
      variantKey,
      batchNumber: args.toBatchNumber,
      piecesPerUnit: fromSpec.piecesPerUnit,
      weight: fromSpec.weight,
      thickness: fromSpec.thickness,
    },
    select: { id: true },
  });

  return created.id;
}
