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
}

export function ProductBatchList({
  productId,
  batches,
  piecesPerUnit,
  onSelectBatch,
}: ProductBatchListProps) {
  // 如果只有一个批次，自动选择，不显示批次列表
  if (batches.length === 1) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-medium text-gray-500">
          选择批次 ({batches.length}个)
        </span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {batches.map(batch => {
          const effectivePieces =
            typeof batch.piecesPerUnit === 'number' && batch.piecesPerUnit > 0
              ? batch.piecesPerUnit
              : piecesPerUnit > 0
                ? piecesPerUnit
                : 0;

          const stockDisplay = formatInventoryQuantity(
            batch.quantity,
            effectivePieces
          );

          return (
            <button
              key={`${productId}-${batch.batchNumber}`}
              type="button"
              onClick={event => {
                event.stopPropagation();
                onSelectBatch(productId, batch.batchNumber);
              }}
              className="group relative flex flex-col gap-1 rounded-lg border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-blue-500 hover:shadow-lg active:translate-y-0"
            >
              {/* 批次号 */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-blue-700 group-hover:text-blue-900">
                  {batch.batchNumber}
                </span>
                {effectivePieces > 0 && (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-700">
                    {effectivePieces}片/件
                  </span>
                )}
              </div>
              {/* 库存 */}
              <div className="text-sm font-semibold text-green-600 group-hover:text-green-700">
                {stockDisplay}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
