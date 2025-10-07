import { notFound } from 'next/navigation';

import { prisma } from '@/lib/db';
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
          factoryShipmentOrderItems: true,
          payableRecords: true,
        },
      },
      factoryShipmentOrderItems: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
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

  // 序列化数据（将 Date 转换为 string）
  const serializedSupplier = {
    ...supplier,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
    factoryShipments: [], // 添加空数组满足类型要求
    _count: {
      ...supplier._count,
      factoryShipments: 0, // 添加缺失的 factoryShipments 计数
    },
    factoryShipmentOrderItems: supplier.factoryShipmentOrderItems.map(item => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
    payableRecords: supplier.payableRecords.map(record => ({
      ...record,
      dueDate: record.dueDate ? record.dueDate.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
    })),
  };

  return <SupplierDetailPageClient supplier={serializedSupplier} />;
}
