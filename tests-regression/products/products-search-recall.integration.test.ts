import { loadEnvConfig } from '@next/env';
import { PrismaClient } from '@prisma/client';

import {
  buildProductSelect,
  buildProductWhereClause,
  queryProducts,
} from '@/lib/api/handlers/products-list';

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const INITIAL_PAGE_LIMIT = 20;
const BURY_FILLER_COUNT = 120;

function buildRunId(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`.toUpperCase();
}

describe('products search recall integration', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('旧产品不在初始产品池时，精确搜索仍应召回目标产品', async () => {
    const runId = buildRunId('PRODSEARCH');
    const fillerCodePrefix = `BURYPOOL-${buildRunId('POOL')}`;
    const targetCode = `${runId}-P`;
    const targetName = `${runId}搜索召回验证砖`;

    const targetProduct = await prisma.product.create({
      data: {
        code: targetCode,
        name: targetName,
        piecesPerUnit: 1,
        specification: '800x800mm',
        status: 'active',
        unit: 'sheet',
        weight: '5.000',
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
      },
      select: {
        id: true,
      },
    });

    try {
      await prisma.product.createMany({
        data: Array.from({ length: BURY_FILLER_COUNT }, (_, index) => ({
          code: `${fillerCodePrefix}-${String(index + 1).padStart(3, '0')}`,
          name: `初始池填充产品-${index + 1}`,
          piecesPerUnit: 1,
          specification: '600x600mm',
          status: 'active',
          unit: 'sheet',
          weight: '1.000',
        })),
      });

      const [initialProducts] = await queryProducts({
        where: buildProductWhereClause({
          filterUncategorized: false,
        }),
        select: buildProductSelect(false),
        sortBy: 'createdAt',
        sortOrder: 'desc',
        page: 1,
        limit: INITIAL_PAGE_LIMIT,
      });

      expect(initialProducts.some(product => product.code === targetCode)).toBe(
        false
      );

      const [searchedProducts] = await queryProducts({
        where: buildProductWhereClause({
          search: targetCode,
          filterUncategorized: false,
        }),
        select: buildProductSelect(false),
        sortBy: 'createdAt',
        sortOrder: 'desc',
        page: 1,
        limit: 50,
      });

      expect(searchedProducts.map(product => product.code)).toContain(targetCode);
    } finally {
      await prisma.product.deleteMany({
        where: {
          OR: [
            {
              id: targetProduct.id,
            },
            {
              code: {
                startsWith: fillerCodePrefix,
              },
            },
          ],
        },
      });
    }
  });
});
