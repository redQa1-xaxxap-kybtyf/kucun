import { formatInventoryQuantity } from '../utils/product-search';

interface ProductBatchListProps {
  productId: string;
  batches: Array<{ batchNumber: string; quantity: number }>;
  piecesPerUnit: number;
  onSelectBatch: (productId: string, batchNumber: string) => void;
}

export function ProductBatchList({
  productId,
  batches,
  piecesPerUnit,
  onSelectBatch,
}: ProductBatchListProps) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-gray-600">
        点击批次进行选择：
      </div>
      <div className="flex flex-wrap gap-2">
        {batches.map(batch => (
          <button
            key={`${productId}-${batch.batchNumber}`}
            type="button"
            onClick={event => {
              event.stopPropagation();
              onSelectBatch(productId, batch.batchNumber);
            }}
            className="flex items-center gap-1.5 rounded-md border-2 border-blue-200 bg-blue-50 px-3 py-1.5 text-xs transition-all hover:border-blue-400 hover:bg-blue-100 hover:shadow-md active:scale-95"
          >
            <span className="font-mono font-semibold text-blue-700">
              {batch.batchNumber}
            </span>
            <span className="text-gray-400">|</span>
            <span className="font-medium text-green-600">
              {formatInventoryQuantity(batch.quantity, piecesPerUnit)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
