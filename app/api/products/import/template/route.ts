import { type NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import { withAuth } from '@/lib/auth/api-helpers';

function createInstructionSheet() {
  return XLSX.utils.aoa_to_sheet([
    ['字段', '是否必填', '说明'],
    ['产品编码', '是', '唯一，不可与系统现有产品重复'],
    ['产品名称', '是', '建议填写业务上使用的正式名称'],
    ['规格', '是', '如 800x800mm'],
    ['分类编码', '否', '填写分类管理中的编码；留空则导入为无分类'],
    ['厚度(mm)', '否', '数字，0-100'],
    ['状态', '否', '支持 active / inactive / 启用 / 停用；留空默认启用'],
    ['描述', '否', '最长 1000 个字符'],
  ]);
}

export const GET = withAuth(
  async (_request: NextRequest) => {
    const workbook = XLSX.utils.book_new();
    const sampleSheet = XLSX.utils.json_to_sheet([
      {
        产品编码: 'P-800-001',
        产品名称: '抛光砖',
        规格: '800x800mm',
        分类编码: 'tile-polished',
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
