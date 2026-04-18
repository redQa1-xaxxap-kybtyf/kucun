import { type NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';

type InitialStockTemplateSource = 'blank' | 'products';
const ACTUAL_BATCH_WEIGHT_HEADER = '本批次实际每件重量(kg)';

type TemplateRow = {
  产品编码: string;
  产品名称: string;
  规格: string;
  色号: string;
  批次号: string;
  装箱数: number | string;
  '本批次实际每件重量(kg)': number | string;
  数量: number | string;
  数量单位: string;
  单位成本: number | string;
  供应商: string;
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

type SupplierReferenceRow = {
  供应商名称: string;
  供应商编码: string;
  联系电话: string;
  状态: string;
};

function readTemplateSource(request: NextRequest): InitialStockTemplateSource {
  const source = request.nextUrl.searchParams.get('source');
  return source === 'products' ? 'products' : 'blank';
}

function createInstructionSheet(source: InitialStockTemplateSource) {
  const sourceTip =
    source === 'products'
      ? '当前模板会自动预填产品编码、名称、规格和色号，建议直接填写批次号、数量、数量单位、单位成本、库位和备注。填“件”时，数量支持最多 3 位小数，且会按装箱数自动换算成片；单位成本按件价填写并自动折算成单片成本。填“片”时，单位成本按单片成本填写。旧模板里的“单片成本”列也继续兼容。'
      : '建议优先下载“产品库模板”，系统会自动预填产品基础信息，用户只需补充批次号、数量、数量单位、装箱数和单位成本。日常按件盘点时，数量单位请直接填“件”，数量支持最多 3 位小数，并在当前行填写装箱数；单位成本按件价填写后会自动折算成单片成本。若按“片”录入，则单位成本直接按单片成本填写。旧模板里的“单片成本”列也继续兼容。';

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
    [
      '装箱数',
      '否',
      '按“件”导入时必填，用于把件数换算成片数；按“片”导入时可留空',
    ],
    [
      ACTUAL_BATCH_WEIGHT_HEADER,
      '否',
      '填写后用于记录本次导入批次的实际每件重量；留空则本次不记录重量',
    ],
    [
      '数量',
      '是',
      '按“片”导入时必须填写大于 0 的整数片数；按“件”导入时支持最多 3 位小数，但换算后的片数必须是整数',
    ],
    [
      '数量单位',
      '建议填写',
      '支持“件”或“片”。填“件”时，系统会自动用装箱数换算成片；留空时会兼容旧模板并按“片”处理，不推荐',
    ],
    [
      '单位成本',
      '是',
      '新版模板中会跟随数量单位识别：填“件”时按件价填写并自动折算成单片成本；填“片”时按单片成本填写；最多保留 3 位小数。旧模板“单片成本”列仍兼容，并始终按单片成本处理',
    ],
    [
      '供应商',
      '否',
      '优先按供应商名称精确匹配，也支持填写供应商编码；建议直接从“供应商参考”工作表复制',
    ],
    ['库位', '否', '填写后会写入库存和入库记录'],
    ['备注', '否', '可填写期初说明、来源说明等'],
    [
      '导入规则',
      '说明',
      '正式导入时，只允许导入产品管理中已存在且通过校验的产品；数量单位填写“件”时，当前行必须填写装箱数，防止把件数错当片数',
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
            装箱数: '',
            [ACTUAL_BATCH_WEIGHT_HEADER]: '',
            数量: '',
            数量单位: '',
            单位成本: '',
            供应商: '',
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
        装箱数: '',
        [ACTUAL_BATCH_WEIGHT_HEADER]: '',
        数量: '',
        数量单位: '',
        单位成本: '',
        供应商: '',
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
      装箱数: 4,
      [ACTUAL_BATCH_WEIGHT_HEADER]: 32,
      数量: 100.5,
      数量单位: '件',
      单位成本: 50,
      供应商: '华南瓷砖供应商',
      库位: 'A-01',
      备注: '100.5件会自动按 4 片/件换算成 402 片；50元/件会自动折算成 12.5元/片',
    },
    {
      产品编码: 'P-800-001',
      产品名称: '抛光砖800x800',
      规格: '800x800mm',
      色号: 'A02',
      批次号: '2026-03',
      装箱数: 4,
      [ACTUAL_BATCH_WEIGHT_HEADER]: 32,
      数量: 80,
      数量单位: '件',
      单位成本: 50,
      供应商: '华南瓷砖供应商',
      库位: 'A-02',
      备注: '同编号不同色号示例',
    },
    {
      产品编码: 'P-800-001',
      产品名称: '抛光砖800x800',
      规格: '800x800mm',
      色号: 'A01',
      批次号: '2026-04',
      装箱数: 4,
      [ACTUAL_BATCH_WEIGHT_HEADER]: 32.5,
      数量: 60,
      数量单位: '件',
      单位成本: 51.2,
      供应商: '华南瓷砖供应商',
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

function buildSupplierReferenceRows(
  suppliers: Array<{
    name: string;
    supplierCode: string | null;
    phone: string | null;
    status: string;
  }>
): SupplierReferenceRow[] {
  if (suppliers.length === 0) {
    return [
      {
        供应商名称:
          '当前系统还没有供应商数据，请先在供应商管理中维护后再导入。',
        供应商编码: '',
        联系电话: '',
        状态: '',
      },
    ];
  }

  return suppliers.map(supplier => ({
    供应商名称: supplier.name,
    供应商编码: supplier.supplierCode ?? '',
    联系电话: supplier.phone ?? '',
    状态: supplier.status === 'active' ? '启用' : '停用',
  }));
}

export const GET = withAuth(
  async (request: NextRequest) => {
    const source = readTemplateSource(request);
    const [products, suppliers] = await Promise.all([
      prisma.product.findMany({
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
      }),
      prisma.supplier.findMany({
        select: {
          name: true,
          supplierCode: true,
          phone: true,
          status: true,
        },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
      }),
    ]);

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
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(buildSupplierReferenceRows(suppliers)),
      '供应商参考'
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
