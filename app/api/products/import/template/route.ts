import { type NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';

type CategoryTemplateRow = {
  产品分类: string;
  一级分类: string;
  二级分类: string;
  三级分类: string;
  分类编码: string;
};

function createInstructionSheet() {
  return XLSX.utils.aoa_to_sheet([
    ['字段', '是否必填', '说明'],
    ['产品编码', '是', '唯一，不可与系统现有产品重复'],
    ['产品名称', '是', '建议填写业务上使用的正式名称'],
    ['规格', '是', '如 800x800mm'],
    [
      '产品分类',
      '否',
      '推荐直接从“分类参考”工作表复制：一级分类填“瓷砖”，二级分类填“瓷砖/抛光砖”，三级分类填“瓷砖/抛光砖/柔抛”',
    ],
    ['厚度(mm)', '否', '数字，0-100'],
    ['状态', '否', '支持 active / inactive / 启用 / 停用；留空默认启用'],
    ['描述', '否', '最长 1000 个字符'],
  ]);
}

function buildCategoryReferenceRows(
  categories: Array<{
    id: string;
    name: string;
    code: string;
    status: string;
    parentId: string | null;
    sortOrder: number;
  }>
): CategoryTemplateRow[] {
  if (categories.length === 0) {
    return [];
  }

  const byParent = new Map<string | null, typeof categories>();
  categories.forEach(category => {
    const bucket = byParent.get(category.parentId) ?? [];
    bucket.push(category);
    byParent.set(category.parentId, bucket);
  });

  byParent.forEach(bucket => {
    bucket.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }

      return a.name.localeCompare(b.name, 'zh-CN');
    });
  });

  const rows: CategoryTemplateRow[] = [];

  const visit = (parentId: string | null, ancestors: string[] = []): void => {
    const children = byParent.get(parentId) ?? [];

    children.forEach(category => {
      const levels = [...ancestors, category.name];
      rows.push({
        产品分类: levels.join('/'),
        一级分类: levels[0] ?? '',
        二级分类: levels[1] ?? '',
        三级分类: levels[2] ?? '',
        分类编码: category.code,
      });

      visit(category.id, levels);
    });
  };

  visit(null);

  return rows;
}

function createCategoryReferenceSheet(rows: CategoryTemplateRow[]) {
  if (rows.length === 0) {
    return XLSX.utils.aoa_to_sheet([
      ['提示'],
      ['当前系统还没有分类数据，请先在分类管理中维护分类后再下载模板。'],
    ]);
  }

  return XLSX.utils.json_to_sheet(rows);
}

export const GET = withAuth(
  async (_request: NextRequest) => {
    const categories = await prisma.category.findMany({
      where: {
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        parentId: true,
        sortOrder: true,
      },
    });

    const workbook = XLSX.utils.book_new();
    const sampleSheet = XLSX.utils.json_to_sheet([
      {
        产品编码: 'P-800-001',
        产品名称: '抛光砖',
        规格: '800x800mm',
        产品分类: '瓷砖/抛光砖',
        '厚度(mm)': 10,
        状态: '启用',
        描述: '产品导入示例，可删除',
      },
    ]);

    XLSX.utils.book_append_sheet(workbook, sampleSheet, '产品导入模板');
    XLSX.utils.book_append_sheet(
      workbook,
      createInstructionSheet(),
      '填写说明'
    );
    XLSX.utils.book_append_sheet(
      workbook,
      createCategoryReferenceSheet(buildCategoryReferenceRows(categories)),
      '分类参考'
    );

    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    const filename = '产品基础信息导入模板.xlsx';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
          filename
        )}`,
      },
    });
  },
  { permissions: ['products:create'] }
);
