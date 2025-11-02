/**
 * 分类数据种子脚本
 * 为测试分类管理功能创建示例数据
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCategories() {
  console.log('开始创建分类数据...');

  try {
    // 创建顶级分类
    const ceramicTiles = await prisma.category.create({
      data: {
        name: '瓷砖',
        code: 'CERAMIC_TILES',
        description: '各种类型的瓷砖产品',
        sortOrder: 1,
        status: 'active',
      },
    });

    const floorTiles = await prisma.category.create({
      data: {
        name: '地砖',
        code: 'FLOOR_TILES',
        description: '用于地面铺设的瓷砖',
        parentId: ceramicTiles.id,
        sortOrder: 1,
        status: 'active',
      },
    });

    const wallTiles = await prisma.category.create({
      data: {
        name: '墙砖',
        code: 'WALL_TILES',
        description: '用于墙面装饰的瓷砖',
        parentId: ceramicTiles.id,
        sortOrder: 2,
        status: 'active',
      },
    });

    // 创建地砖子分类
    await prisma.category.createMany({
      data: [
        {
          name: '抛光砖',
          code: 'POLISHED_TILES',
          description: '表面经过抛光处理的地砖',
          parentId: floorTiles.id,
          sortOrder: 1,
          status: 'active',
        },
        {
          name: '仿古砖',
          code: 'ANTIQUE_TILES',
          description: '具有仿古效果的地砖',
          parentId: floorTiles.id,
          sortOrder: 2,
          status: 'active',
        },
        {
          name: '木纹砖',
          code: 'WOOD_GRAIN_TILES',
          description: '模仿木纹效果的地砖',
          parentId: floorTiles.id,
          sortOrder: 3,
          status: 'active',
        },
      ],
    });

    // 创建墙砖子分类
    await prisma.category.createMany({
      data: [
        {
          name: '釉面砖',
          code: 'GLAZED_TILES',
          description: '表面有釉层的墙砖',
          parentId: wallTiles.id,
          sortOrder: 1,
          status: 'active',
        },
        {
          name: '马赛克',
          code: 'MOSAIC_TILES',
          description: '小块拼接的装饰墙砖',
          parentId: wallTiles.id,
          sortOrder: 2,
          status: 'active',
        },
        {
          name: '文化砖',
          code: 'CULTURE_TILES',
          description: '具有文化特色的装饰墙砖',
          parentId: wallTiles.id,
          sortOrder: 3,
          status: 'active',
        },
      ],
    });

    // 创建其他顶级分类
    await prisma.category.createMany({
      data: [
        {
          name: '石材',
          code: 'STONE_MATERIALS',
          description: '天然石材和人造石材',
          sortOrder: 2,
          status: 'active',
        },
        {
          name: '辅材',
          code: 'AUXILIARY_MATERIALS',
          description: '瓷砖铺设辅助材料',
          sortOrder: 3,
          status: 'active',
        },
        {
          name: '工具',
          code: 'TOOLS',
          description: '施工工具和设备',
          sortOrder: 4,
          status: 'inactive', // 测试禁用状态
        },
      ],
    });

    console.log('分类数据创建完成！');

    // ✅ 优化: 使用 select 替代 include，只查询需要的字段
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        parentId: true,
        sortOrder: true,
        // 只选择父分类的名称，而不是完整对象
        parent: {
          select: {
            name: true,
          },
        },
        // 只计数子分类数量，而不是加载完整对象
        _count: {
          select: {
            children: true,
            products: true,
          },
        },
      },
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }],
    });

    console.log('\n创建的分类列表：');
    categories.forEach(category => {
      const level = category.parentId ? '  └─ ' : '';
      const parentInfo = category.parent
        ? ` (父分类: ${category.parent.name})`
        : '';
      console.log(
        `${level}${category.name} (${category.code}) - ${category.status}${parentInfo} - 子分类: ${category._count.children} - 产品数: ${category._count.products}`
      );
    });
  } catch (error) {
    console.error('创建分类数据失败:', error);
    throw error;
  }
}

async function main() {
  try {
    await seedCategories();
  } catch (error) {
    console.error('种子脚本执行失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
