import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

/**
 * GET /api/inventory/initial-stock/template
 * 下载期初库存导入模板 (Excel)
 */
export async function GET() {
  // 创建工作簿
  const workbook = XLSX.utils.book_new();

  // 示例数据（第一行可作为示例）
  const data = [
    {
      产品编码: 'P001',
      产品名称: '抛光砖800x800',
      规格: '800x800mm',
      色号: 'RED',
      批次号: '2024-10',
      数量: 100,
      单位成本: 12.5,
      成本来源: '2024年10月采购价',
      库位: 'A-01',
      备注: '期初库存示例，可删除',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, '期初库存');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="期初库存导入模板.xlsx"',
    },
  });
}
