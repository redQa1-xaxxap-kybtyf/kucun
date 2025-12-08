// 库存相关类型定义

export interface InventoryItem {
  id: string;
  productId: string;
  batchNumber?: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  location?: string;
  unitCost?: number;
  updatedAt: string;
  batchPiecesPerUnit?: number;
  weight?: number;
  product: {
    id: string;
    code: string;
    name: string;
    specification?: string;
    unit: string;
    piecesPerUnit: number;
    status: string;
    categoryId?: string;
    category: {
      id: string;
      name: string;
      code: string;
    } | null;
  };
}

export interface InventoryListResponse {
  inventories: InventoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface InventoryQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  productId?: string;
  batchNumber?: string;
  location?: string;
  categoryId?: string;
  lowStock?: boolean;
  hasStock?: boolean;
  startDate?: string;
  endDate?: string;
}
