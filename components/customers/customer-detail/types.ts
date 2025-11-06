export interface CustomerExtendedInfo {
  contactPerson?: string;
  email?: string;
  fax?: string;
  website?: string;
  businessLicense?: string;
  taxNumber?: string;
  bankAccount?: string;
  creditLimit?: number;
  paymentTerms?: string;
  customerType?: 'company' | 'store' | 'individual';
  industry?: string;
  region?: string;
  level?: 'A' | 'B' | 'C' | 'D';
  notes?: string;
  tags?: string[];
}

export interface CustomerSalesOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  createdAt: string;
}

export interface CustomerReturnOrder {
  id: string;
  returnNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}

export interface CustomerDetail {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  extendedInfo?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    salesOrders: number;
    returnOrders: number;
  };
  salesOrders: CustomerSalesOrder[];
  returnOrders: CustomerReturnOrder[];
}
