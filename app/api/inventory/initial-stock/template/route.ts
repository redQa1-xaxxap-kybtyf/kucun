import { type NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';

type InitialStockTemplateSource = 'blank' | 'products';

type TemplateRow = {
  产品编码: string;
  产品名称: string;
  规格: string;
  色号: string;
  批次号: string;
  数量: number | string;
  单位成本: number | string;
  库位: string;
  备注: string;
};

type ProductReferenceRow = {
  产品编码: string;
  产品名称: string;
  规格: string;
  色号: string;
  色号名称: string;
  产品状态: string;
};

function readTemplateSource(request: NextRequest): InitialStockTemplateSource {
  const source = request.nextUrl.searchParams.get('source');
  return source === 'products' ? 'products' : 'blank';
}

function createInstructionSheet(source: InitialStockTemplateSource) {
  const sourceTip =
    source === 'products'
      ? '当前模板已按产品库自动预填产品编码、名称、规格和色号，建议直接填写批次号、数量、单位成本、库位和备注。'
      : '建议优先下载“产品库模板”，系统会自动预填产品信息，用户只需填写数量和成本。';

  return XLSX.utils.aoa_to_sheet([
    ['字段', '是否必填', '说明'],
    [
      '填写粒度',
      '说明',
      '一行只表示一个“产品编码 + 色号 + 批次”组合；同一产品多个色号或多个批次，请拆成多行填写',
    ],
    [
      '产品编码',
      '条件必填',
      '优先按产品编码匹配；若留空，则必须填写“产品名称 + 规格”精确匹配产品库',
    ],
    [
      '产品名称',
      '条件必填',
      '未填写产品编码时必填；建议不要手改产品库模板中的预填内容',
    ],
    ['规格', '条件必填', '未填写产品编码时必填；需与产品管理中的规格完全一致'],
    [
      '色号',
      '视产品而定',
      '产品存在多个色号时必填；若产品只有一个色号，系统会自动识别',
    ],
    ['批次号', '是', '建议按实际批次填写；同一产品/色号/批次重复时会自动跳过'],
    ['数量', '是', '必须为大于 0 的整数'],
    ['单位成本', '是', '必须为大于等于 0 的数字'],
    ['库位', '否', '填写后会写入库存和入库记录'],
    ['备注', '否', '可填写期初说明、来源说明等'],
    [
      '导入规则',
      '说明',
      '正式导入时，只允许导入产品管理中已存在且通过校验的产品',
    ],
    ['推荐流程', '说明', sourceTip],
  ]);
}

function buildTemplateRows(
  products: Array<{
    code: string;
    name: string;
    specification: string | null;
    variants: Array<{
      colorCode: string;
      colorName: string | null;
      status: string;
    }>;
  }>,
  source: InitialStockTemplateSource
): TemplateRow[] {
  if (source === 'products') {
    const productRows = products.flatMap(product => {
      const activeVariants = product.variants.filter(
        variant => variant.status.toLowerCase() === 'active'
      );

      if (product.variants.length > 0 && activeVariants.length === 0) {
        return [];
      }

      if (activeVariants.length === 0) {
        return [
          {
            产品编码: product.code,
            产品名称: product.name,
            规格: product.specification ?? '',
            色号: '',
            批次号: '',
            数量: '',
            单位成本: '',
            库位: '',
            备注: '',
          },
        ];
      }

      return activeVariants.map(variant => ({
        产品编码: product.code,
        产品名称: product.name,
        规格: product.specification ?? '',
        色号: variant.colorCode,
        批次号: '',
        数量: '',
        单位成本: '',
        库位: '',
        备注: '',
      }));
    });

    if (productRows.length > 0) {
      return productRows;
    }
  }

  return [
    {
      产品编码: 'P-800-001',
      产品名称: '抛光砖800x800',
      规格: '800x800mm',
      色号: 'A01',
      批次号: '2026-03',
      数量: 100,
      单位成本: 12.5,
      库位: 'A-01',
      备注: '同编号不同色号，拆成多行',
    },
    {
      产品编码: 'P-800-001',
      产品名称: '抛光砖800x800',
      规格: '800x800mm',
      色号: 'A02',
      批次号: '2026-03',
      数量: 80,
      单位成本: 12.5,
      库位: 'A-02',
      备注: '同编号不同色号示例',
    },
    {
      产品编码: 'P-800-001',
      产品名称: '抛光砖800x800',
      规格: '800x800mm',
      色号: 'A01',
      批次号: '2026-04',
      数量: 60,
      单位成本: 12.8,
      库位: 'A-03',
      备注: '同编号同色号不同批次，也拆成多行',
    },
  ];
}

function buildProductReferenceRows(
  products: Array<{
    code: string;
    name: string;
    specification: string | null;
    status: string;
    variants: Array<{
      colorCode: string;
      colorName: string | null;
      status: string;
    }>;
  }>
): ProductReferenceRow[] {
  const rows = products.flatMap(product => {
    if (product.variants.length === 0) {
      return [
        {
          产品编码: product.code,
          产品名称: product.name,
          规格: product.specification ?? '',
          色号: '',
          色号名称: '',
          产品状态: product.status === 'active' ? '启用' : '停用',
        },
      ];
    }

    return product.variants.map(variant => ({
      产品编码: product.code,
      产品名称: product.name,
      规格: product.specification ?? '',
      色号: variant.colorCode,
      色号名称: variant.colorName ?? '',
      产品状态:
        product.status === 'active' && variant.status === 'active'
          ? '启用'
          : '停用',
    }));
  });

  if (rows.length > 0) {
    return rows;
  }

  return [
    {
      产品编码: '',
      产品名称:
        '当前产品库没有可用产品，请先在产品管理中维护产品后再下载模板。',
      规格: '',
      色号: '',
      色号名称: '',
      产品状态: '',
    },
  ];
}

export const GET = withAuth(
  async (request: NextRequest) => {
    const source = readTemplateSource(request);
    const products = await prisma.product.findMany({
      where: {
        status: 'active',
      },
      select: {
        code: true,
        name: true,
        specification: true,
        status: true,
        variants: {
          select: {
            colorCode: true,
            colorName: true,
            status: true,
          },
          orderBy: {
            colorCode: 'asc',
          },
        },
      },
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(buildTemplateRows(products, source)),
      '期初库存导入模板'
    );
    XLSX.utils.book_append_sheet(
      workbook,
      createInstructionSheet(source),
      '填写说明'
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(buildProductReferenceRows(products)),
      '产品参考'
    );

    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });
    const filename =
      source === 'products'
        ? '期初库存导入模板-产品库版.xlsx'
        : '期初库存导入模板.xlsx';

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
  { permissions: ['inventory:opening_balance'] }
);
