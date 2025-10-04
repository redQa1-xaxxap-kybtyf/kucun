import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { SupplierDetailSkeleton } from '@/components/suppliers/supplier-detail-skeleton';
import { prisma } from '@/lib/db';
import { SupplierDetailPageClient } from './page-client';

/**
 * 供应商详情页面 - Server Component
 * 负责数据获取和 SEO 优化
 * 严格遵循前端架构规范：三级组件架构
 */
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

  return (
    <Suspense fallback={<SupplierDetailSkeleton />}>
      <SupplierDetailPageClient supplier={serializedSupplier} />
    </Suspense>
  );
}
