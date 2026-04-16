import { prisma } from '@/lib/db';

type BatchPiecesLookupItem = {
  productId?: string | null;
  variantId?: string | null;
  batchNumber?: string | null;
};

function buildBatchPiecesKey(
  productId: string,
  batchNumber: string,
  variantId?: string | null
) {
  return `${productId}::${variantId ?? ''}::${batchNumber}`;
}

export async function loadBatchPiecesPerUnitMap(
  items: BatchPiecesLookupItem[]
): Promise<Map<string, number>> {
  const pairs: Array<{
    productId: string;
    variantId: string | null;
    batchNumber: string;
  }> = [];

  for (const item of items) {
    if (
      typeof item.productId !== 'string' ||
      item.productId.trim().length === 0 ||
      typeof item.batchNumber !== 'string' ||
      item.batchNumber.trim().length === 0
    ) {
      continue;
    }

    pairs.push({
      productId: item.productId.trim(),
      variantId: item.variantId ?? null,
      batchNumber: item.batchNumber.trim(),
    });
  }

  if (!pairs.length) {
    return new Map();
  }

  const seenConditions = new Set<string>();
  const conditions = pairs.flatMap(pair => {
    const entries = [
      {
        productId: pair.productId,
        variantId: pair.variantId,
        batchNumber: pair.batchNumber,
      },
    ];

    if (pair.variantId) {
      entries.push({
        productId: pair.productId,
        variantId: null,
        batchNumber: pair.batchNumber,
      });
    }

    return entries.filter(condition => {
      const key = buildBatchPiecesKey(
        condition.productId,
        condition.batchNumber,
        condition.variantId
      );
      if (seenConditions.has(key)) {
        return false;
      }
      seenConditions.add(key);
      return true;
    });
  });

  const batchSpecifications = await prisma.batchSpecification.findMany({
    where: {
      OR: conditions,
    },
    select: {
      productId: true,
      variantId: true,
      batchNumber: true,
      piecesPerUnit: true,
    },
  });

  const map = new Map<string, number>();

  for (const specification of batchSpecifications) {
    if (
      typeof specification.piecesPerUnit !== 'number' ||
      specification.piecesPerUnit <= 0
    ) {
      continue;
    }

    map.set(
      buildBatchPiecesKey(
        specification.productId,
        specification.batchNumber,
        specification.variantId ?? null
      ),
      specification.piecesPerUnit
    );
  }

  return map;
}

export function getBatchPiecesPerUnitFromMap(
  map: Map<string, number>,
  item: BatchPiecesLookupItem
): number | undefined {
  const productId =
    typeof item.productId === 'string' ? item.productId.trim() : '';
  const batchNumber =
    typeof item.batchNumber === 'string' ? item.batchNumber.trim() : '';

  if (!productId || !batchNumber) {
    return undefined;
  }

  const exactKey = buildBatchPiecesKey(productId, batchNumber, item.variantId);
  const fallbackKey = buildBatchPiecesKey(productId, batchNumber, null);

  return map.get(exactKey) ?? map.get(fallbackKey);
}

export function getUniformPiecesPerUnit(
  values: Array<number | null | undefined>
): number | undefined {
  const normalized = values.filter(
    (value): value is number =>
      typeof value === 'number' && Number.isInteger(value) && value > 0
  );

  if (!normalized.length) {
    return undefined;
  }

  const uniqueValues = Array.from(new Set(normalized));
  return uniqueValues.length === 1 ? uniqueValues[0] : undefined;
}
