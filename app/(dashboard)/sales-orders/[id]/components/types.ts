export interface PaymentRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  actualPaymentAmount: number;
  roundingAmount: number;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  remarks?: string;
  createdAt: string;
}

export interface SalesOrderDetail {
  id: string;
  orderNumber: string;
  customerId: string;
  userId: string;
  supplierId?: string;
  status: string;
  orderType: string;
  transferMode: string;
  itemsAmount: number;
  additionalFees: number;
  roundingAdjustment: number;
  totalAmount: number;
  costAmount: number;
  profitAmount: number;
  actualPaidAmount: number;
  paymentRounding: number;
  paidAmount: number;
  remainingAmount: number;
  remarks?: string;
  shippedAt?: string;
  createdAt: string;
  updatedAt: string;
  hasReturnOrder?: boolean;
  shippingAddress?: string;
  customer: { id: string; name: string; phone?: string; address?: string };
  user: { id: string; name: string };
  supplier?: { id: string; name: string };
  items: Array<{
    id: string;
    productId: string;
    productCode?: string;
    batchNumber?: string;
    colorCode?: string;
    productionDate?: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    unitCost?: number;
    costSubtotal?: number;
    profitAmount?: number;
    localQuantity?: number;
    transferQuantity?: number;
    isManualProduct: boolean;
    manualProductName?: string;
    manualSpecification?: string;
    manualWeight?: number;
    manualUnit?: string;
    displayUnit?: string;
    displayQuantity?: number;
    piecesPerUnit?: number;
    specification?: string;
    remarks?: string;
    product?: {
      id: string;
      code: string;
      name: string;
      unit: string;
      specification?: string;
      piecesPerUnit?: number;
      weight?: number;
    } | null;
  }>;
  feeItems: Array<{
    id: string;
    feeType: string;
    feeName: string;
    feeAmount: number;
    remarks?: string;
  }>;
  paymentRecords: PaymentRecord[];
  returnOrders: Array<{
    id: string;
    returnNumber: string;
    status: string;
    createdAt: string;
  }>;
}
