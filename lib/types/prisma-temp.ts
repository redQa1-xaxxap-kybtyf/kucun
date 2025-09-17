/**
 * 临时Prisma类型定义
 * 用于解决Prisma客户端生成问题
 */

// 临时扩展Prisma客户端类型
declare module '@prisma/client' {
  interface PrismaClient {
    productVariant: {
      findMany: (args?: any) => Promise<any[]>;
      findUnique: (args?: any) => Promise<any | null>;
      findFirst: (args?: any) => Promise<any | null>;
      create: (args?: any) => Promise<any>;
      update: (args?: any) => Promise<any>;
      delete: (args?: any) => Promise<any>;
      deleteMany: (args?: any) => Promise<any>;
      updateMany: (args?: any) => Promise<any>;
      count: (args?: any) => Promise<number>;
    };
  }
}

// 临时类型定义
export interface TempProductVariant {
  id: string;
  productId: string;
  colorCode: string;
  colorName?: string;
  colorValue?: string;
  sku: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  product?: any;
  inventory?: any[];
}

export interface TempInventory {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  reservedQuantity: number;
  productionDate?: string;
  batchNumber?: string;
  location?: string;
  unitCost?: number;
  updatedAt: Date;
}
