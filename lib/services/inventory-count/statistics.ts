import { prisma } from '@/lib/db';
import type {
  CountStatus,
  InventoryCount,
  InventoryCountStatistics,
} from '@/lib/types/inventory-count';

import { buildSearchFilter } from './queries';

export async function getCountStatistics(params: {
  startDate?: string;
  endDate?: string;
  status?: CountStatus;
}): Promise<InventoryCountStatistics> {
  const where = buildStatisticsFilter(params);

  const aggregateResult = await prisma.inventoryCount.aggregate({
    where,
    _sum: {
      totalItems: true,
      completedItems: true,
      differenceItems: true,
      totalDifference: true,
    },
    _count: {
      id: true,
    },
  });

  const totalCounts = aggregateResult._count.id || 0;
  const totalItems = aggregateResult._sum.totalItems || 0;
  const completedItems = aggregateResult._sum.completedItems || 0;
  const differenceItems = aggregateResult._sum.differenceItems || 0;
  const totalDifference = aggregateResult._sum.totalDifference || 0;

  const statusSummary = await prisma.inventoryCount.groupBy({
    by: ['status'],
    where,
    _count: { id: true },
  });

  const typeSummary = await prisma.inventoryCount.groupBy({
    by: ['countType'],
    where,
    _count: { id: true },
  });

  const totalDifferenceCost = await prisma.inventoryCountItem.aggregate({
    where: { count: where },
    _sum: { totalCost: true },
  });

  return {
    totalCounts,
    draftCounts: findCount(statusSummary, 'draft'),
    inProgressCounts: findCount(statusSummary, 'in_progress'),
    completedCounts: findCount(statusSummary, 'completed'),
    totalItems,
    completedItems,
    differenceItems,
    totalDifference,
    totalDifferenceCost: totalDifferenceCost._sum.totalCost || 0,
    byType: typeSummary.map(entry => ({
      countType: entry.countType as InventoryCount['countType'],
      countTypeName: entry.countType,
      count: entry._count.id,
      percentage:
        totalCounts > 0
          ? Math.round((entry._count.id / totalCounts) * 10000) / 100
          : 0,
    })),
    startDate: params.startDate,
    endDate: params.endDate,
  };
}

function buildStatisticsFilter(params: {
  startDate?: string;
  endDate?: string;
  status?: CountStatus;
}) {
  const { status, startDate, endDate } = params;
  const where = buildSearchFilter({ status, startDate, endDate });
  return where;
}

function findCount(
  entries: Array<{ status: string; _count: { id: number } }>,
  status: string
): number {
  return entries.find(entry => entry.status === status)?._count.id || 0;
}
