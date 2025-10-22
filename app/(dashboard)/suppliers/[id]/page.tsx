import { notFound } from 'next/navigation';

import { prisma } from '@/lib/db';
import {
  countSupplierShipments,
  getRecentSupplierShipments,
} from '@/lib/services/supplier-service';

import { SupplierDetailPageClient } from './page-client';

/**
 * 供应商详情页面
 *
 * ✅ Next.js 15 最佳实践：
 * - Server Component 架构
 * - Route Segment Config 缓存控制
 * - 直接 Prisma 数据获取
 * - 数据序列化处理
 */

// ============================================
// Route Segment Config
// ============================================

// ✅ Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;
export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 服务器端获取供应商详情数据
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      supplierCode: true,
      phone: true,
      address: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          payableRecords: true,
        },
      },
      payableRecords: {
        select: {
          id: true,
          payableNumber: true,
          status: true,
          payableAmount: true,
          remainingAmount: true,
          dueDate: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      },
    },
  });

  if (!supplier) {
    notFound();
  }

  const [recentShipments, shipmentCount] = await Promise.all([
    getRecentSupplierShipments(id, 10),
    countSupplierShipments(id),
  ]);

  const factoryShipments = recentShipments.map(shipment => ({
    id: shipment.id,
    shipmentNumber: shipment.orderNumber,
    status: shipment.status,
    totalAmount: shipment.items.reduce(
      (sum, item) => sum + Number(item.totalPrice),
      0
    ),
    createdAt: shipment.createdAt.toISOString(),
  }));

  // 序列化数据（将 Date 转换为 string）
  const serializedSupplier = {
    ...supplier,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
    _count: {
      ...supplier._count,
      factoryShipments: shipmentCount,
    },
    factoryShipments,
    payableRecords: supplier.payableRecords.map(record => ({
      ...record,
      dueDate: record.dueDate ? record.dueDate.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
    })),
  };

  return <SupplierDetailPageClient supplier={serializedSupplier} />;
}
