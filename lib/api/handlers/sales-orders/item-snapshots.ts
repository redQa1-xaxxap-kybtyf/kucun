import type { Tx } from './types';

export interface SalesOrderSnapshotSourceItem {
  productId?: string | null;
  variantId?: string | null;
  colorCode?: string | null;
  batchNumber?: string | null;
  isManualProduct?: boolean | null;
}

export interface SalesOrderResolvedItemSnapshot {
  resolvedVariantId: string | null;
  piecesPerUnit: number | null;
  weightSnapshot: number | null;
}

type ProductSnapshot = {
  piecesPerUnit: number | null;
  weight: number | null;
};

type BatchSpecificationSnapshot = {
  piecesPerUnit: number | null;
  weight: number | null;
};

const normalizeText = (value?: string | null) => (value ?? '').trim();

const normalizeNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const buildBatchSpecificationKey = (
  productId: string,
  batchNumber: string,
  variantKey: string
) => `${productId}|||${variantKey}|||${batchNumber}`;

const buildVariantLookupKey = (productId: string, colorCode: string) =>
  `${productId}|||${colorCode}`;

async function loadProductMap(
  tx: Tx,
  items: SalesOrderSnapshotSourceItem[]
): Promise<Map<string, ProductSnapshot>> {
  const productIds = Array.from(
    new Set(
      items
        .filter(item => !item.isManualProduct)
        .map(item => normalizeText(item.productId))
        .filter(Boolean)
    )
  );

  const productDelegate = (tx as Tx & {
    product?: {
      findMany?: (args: {
        where: { id: { in: string[] } };
        select: {
          id: true;
          piecesPerUnit: true;
          weight: true;
        };
      }) => Promise<
        Array<{
          id: string;
          piecesPerUnit: number | null;
          weight: unknown;
        }>
      >;
    };
  }).product;

  if (productIds.length === 0 || !productDelegate?.findMany) {
    return new Map();
  }

  const products = await productDelegate.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      piecesPerUnit: true,
      weight: true,
    },
  });

  return new Map(
    products.map(product => [
      product.id,
      {
        piecesPerUnit: product.piecesPerUnit,
        weight: normalizeNullableNumber(product.weight),
      },
    ])
  );
}

async function resolveVariantId(
  tx: Tx,
  item: SalesOrderSnapshotSourceItem
): Promise<string | null> {
  const explicitVariantId = normalizeText(item.variantId);
  if (explicitVariantId) {
    return explicitVariantId;
  }

  if (item.isManualProduct) {
    return null;
  }

  const productId = normalizeText(item.productId);
  const colorCode = normalizeText(item.colorCode);
  if (!productId || !colorCode) {
    return null;
  }

  const variantDelegate = (tx as Tx & {
    productVariant?: {
      findFirst?: (args: {
        where: {
          productId: string;
          colorCode: string;
        };
        select: {
          id: true;
        };
      }) => Promise<{ id: string } | null>;
    };
  }).productVariant;

  if (!variantDelegate?.findFirst) {
    return null;
  }

  const variant = await variantDelegate.findFirst({
    where: {
      productId,
      colorCode,
    },
    select: {
      id: true,
    },
  });

  return variant?.id ?? null;
}

async function loadResolvedVariantIds(
  tx: Tx,
  items: SalesOrderSnapshotSourceItem[]
) {
  const variantCache = new Map<string, string | null>();
  const resolvedVariantIds: Array<string | null> = [];

  for (const item of items) {
    const explicitVariantId = normalizeText(item.variantId);
    if (explicitVariantId) {
      resolvedVariantIds.push(explicitVariantId);
      continue;
    }

    const productId = normalizeText(item.productId);
    const colorCode = normalizeText(item.colorCode);
    if (!productId || !colorCode || item.isManualProduct) {
      resolvedVariantIds.push(null);
      continue;
    }

    const cacheKey = buildVariantLookupKey(productId, colorCode);
    if (!variantCache.has(cacheKey)) {
      variantCache.set(cacheKey, await resolveVariantId(tx, item));
    }

    resolvedVariantIds.push(variantCache.get(cacheKey) ?? null);
  }

  return resolvedVariantIds;
}

async function loadBatchSpecificationMap(
  tx: Tx,
  items: SalesOrderSnapshotSourceItem[],
  resolvedVariantIds: Array<string | null>
): Promise<Map<string, BatchSpecificationSnapshot>> {
  const conditions: Array<{
    productId: string;
    batchNumber: string;
    variantKey: string;
  }> = [];
  const seen = new Set<string>();

  items.forEach((item, index) => {
    if (item.isManualProduct) {
      return;
    }

    const productId = normalizeText(item.productId);
    const batchNumber = normalizeText(item.batchNumber);
    if (!productId || !batchNumber) {
      return;
    }

    const requestedVariantKey = normalizeText(resolvedVariantIds[index]);
    const candidateConditions = requestedVariantKey
      ? [
          {
            productId,
            batchNumber,
            variantKey: requestedVariantKey,
          },
          {
            productId,
            batchNumber,
            variantKey: '',
          },
        ]
      : [
          {
            productId,
            batchNumber,
            variantKey: '',
          },
        ];

    candidateConditions.forEach(condition => {
      const key = buildBatchSpecificationKey(
        condition.productId,
        condition.batchNumber,
        condition.variantKey
      );

      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      conditions.push(condition);
    });
  });

  const batchSpecificationDelegate = (tx as Tx & {
    batchSpecification?: {
      findMany?: (args: {
        where: {
          OR: Array<{
            productId: string;
            batchNumber: string;
            variantKey: string;
          }>;
        };
        select: {
          productId: true;
          batchNumber: true;
          variantKey: true;
          piecesPerUnit: true;
          weight: true;
        };
      }) => Promise<
        Array<{
          productId: string;
          batchNumber: string;
          variantKey: string | null;
          piecesPerUnit: number | null;
          weight: unknown;
        }>
      >;
    };
  }).batchSpecification;

  if (conditions.length === 0 || !batchSpecificationDelegate?.findMany) {
    return new Map();
  }

  const batchSpecifications = await batchSpecificationDelegate.findMany({
    where: {
      OR: conditions,
    },
    select: {
      productId: true,
      batchNumber: true,
      variantKey: true,
      piecesPerUnit: true,
      weight: true,
    },
  });

  return new Map(
    batchSpecifications.map(specification => [
      buildBatchSpecificationKey(
        specification.productId,
        specification.batchNumber,
        specification.variantKey ?? ''
      ),
      {
        piecesPerUnit: specification.piecesPerUnit,
        weight: normalizeNullableNumber(specification.weight),
      },
    ])
  );
}

function resolveBatchSpecification(
  productId: string,
  batchNumber: string,
  resolvedVariantId: string | null,
  batchSpecificationMap: Map<string, BatchSpecificationSnapshot>
) {
  const requestedVariantKey = normalizeText(resolvedVariantId);

  return (
    batchSpecificationMap.get(
      buildBatchSpecificationKey(productId, batchNumber, requestedVariantKey)
    ) ??
    batchSpecificationMap.get(
      buildBatchSpecificationKey(productId, batchNumber, '')
    )
  );
}

export async function resolveSalesOrderItemSnapshots(
  tx: Tx,
  items: SalesOrderSnapshotSourceItem[]
): Promise<SalesOrderResolvedItemSnapshot[]> {
  if (items.length === 0) {
    return [];
  }

  const [productMap, resolvedVariantIds] = await Promise.all([
    loadProductMap(tx, items),
    loadResolvedVariantIds(tx, items),
  ]);
  const batchSpecificationMap = await loadBatchSpecificationMap(
    tx,
    items,
    resolvedVariantIds
  );

  return items.map((item, index) => {
    if (item.isManualProduct) {
      return {
        resolvedVariantId: resolvedVariantIds[index] ?? null,
        piecesPerUnit: null,
        weightSnapshot: null,
      };
    }

    const productId = normalizeText(item.productId);
    if (!productId) {
      return {
        resolvedVariantId: resolvedVariantIds[index] ?? null,
        piecesPerUnit: null,
        weightSnapshot: null,
      };
    }

    const batchNumber = normalizeText(item.batchNumber);
    const resolvedVariantId = resolvedVariantIds[index] ?? null;
    const productSnapshot = productMap.get(productId);
    const batchSnapshot = batchNumber
      ? resolveBatchSpecification(
          productId,
          batchNumber,
          resolvedVariantId,
          batchSpecificationMap
        )
      : undefined;

    return {
      resolvedVariantId,
      piecesPerUnit:
        batchSnapshot?.piecesPerUnit ?? productSnapshot?.piecesPerUnit ?? null,
      weightSnapshot:
        batchSnapshot?.weight ?? productSnapshot?.weight ?? null,
    };
  });
}

export async function resolveSalesOrderItemSnapshot(
  tx: Tx,
  item: SalesOrderSnapshotSourceItem
): Promise<SalesOrderResolvedItemSnapshot> {
  const [snapshot] = await resolveSalesOrderItemSnapshots(tx, [item]);

  return (
    snapshot ?? {
      resolvedVariantId: null,
      piecesPerUnit: null,
      weightSnapshot: null,
    }
  );
}

export function isSameNullableNumber(
  left: unknown,
  right: unknown
): boolean {
  return normalizeNullableNumber(left) === normalizeNullableNumber(right);
}
