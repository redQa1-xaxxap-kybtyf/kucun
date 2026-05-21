import { cn } from '@/lib/utils';

import { formatInventoryQuantity } from '../utils/product-search';

interface ProductBatchListProps {
  productId: string;
  batches: Array<{
    batchNumber: string;
    quantity: number;
    piecesPerUnit?: number | null;
  }>;
  piecesPerUnit: number;
  onSelectBatch: (productId: string, batchNumber: string) => void;
  variant?: 'desktop' | 'mobile';
}

function renderBatchNumber(batchNumber: string) {
  if (batchNumber.length <= 4) {
    return <span className="font-mono font-bold">{batchNumber}</span>;
  }
  return (
    <span className="font-mono">
      <span>{batchNumber.slice(0, -4)}</span>
      <span className="font-bold">{batchNumber.slice(-4)}</span>
    </span>
  );
}

export function ProductBatchList({
  productId,
  batches,
  piecesPerUnit,
  onSelectBatch,
  variant = 'desktop',
}: ProductBatchListProps) {
  const isMobile = variant === 'mobile';

  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-gray-600">
        点击批次进行选择：
      </div>
      <div
        className={cn(
          isMobile
            ? 'grid grid-cols-2 gap-2'
            : 'flex flex-wrap gap-2'
        )}
      >
        {batches.map(batch => {
          const effectivePieces =
            typeof batch.piecesPerUnit === 'number' && batch.piecesPerUnit > 0
              ? batch.piecesPerUnit
              : piecesPerUnit > 0
                ? piecesPerUnit
                : 0;

          return (
            <button
              key={`${productId}-${batch.batchNumber}`}
              type="button"
              onClick={event => {
                event.stopPropagation();
                onSelectBatch(productId, batch.batchNumber);
              }}
              className={cn(
                'rounded-md border-2 border-[hsl(var(--color-primary-light))] bg-[hsl(var(--color-primary-light))] hover:border-[hsl(var(--color-primary))] hover:shadow-sm',
                isMobile
                  ? 'flex min-h-11 w-full flex-col items-start justify-center gap-0.5 px-3 py-2 text-left'
                  : 'flex items-center gap-1.5 px-3 py-1.5 whitespace-nowrap'
              )}
            >
              {isMobile ? (
                <>
                  <span className="text-[hsl(var(--color-primary))] text-xs leading-tight">
                    批次 {renderBatchNumber(batch.batchNumber)}
                  </span>
                  <span className="text-sm font-semibold text-emerald-600 tabular-nums">
                    {formatInventoryQuantity(batch.quantity, effectivePieces)}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[hsl(var(--color-primary))] text-xs">
                    {renderBatchNumber(batch.batchNumber)}
                  </span>
                  <span className="text-gray-400">|</span>
                  <span className="text-xs font-medium text-green-600">
                    {formatInventoryQuantity(batch.quantity, effectivePieces)}
                  </span>
                  {effectivePieces > 0 && (
                    <>
                      <span className="text-gray-300">|</span>
                      <span className="text-[11px] text-gray-500">
                        每件{effectivePieces}片
                      </span>
                    </>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
