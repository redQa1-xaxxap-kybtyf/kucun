/**
 * 打印设计器预览测试页面
 *
 * 用于开发时验证渲染器效果
 */

'use client';

import dynamic from 'next/dynamic';

import type { PrintTemplate } from '@/lib/print-designer/schemas';

const PrintCanvas = dynamic(
  () =>
    import('@/components/print-designer/renderer/PrintCanvas').then(
      mod => mod.PrintCanvas
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[70vh] w-full animate-pulse rounded-lg bg-white/60" />
    ),
  }
);

// 测试模板
const testTemplate: PrintTemplate = {
  id: 'test-001',
  version: 1,
  name: '测试销售发货单',
  type: 'sales-order',
  pageSettings: {
    size: 'A4',
    width: 210,
    height: 297,
    orientation: 'portrait',
    padding: [15, 15, 15, 15],
  },
  elements: [
    // 公司名称
    {
      id: 'el-001',
      type: 'text',
      position: { x: 0, y: 0 },
      size: { width: 180, height: 12 },
      rotation: 0,
      zIndex: 1,
      locked: false,
      visible: true,
      content: '天津豪星陶瓷发货单',
      style: {
        fontFamily: 'SimHei',
        fontSize: 24,
        fontWeight: 'bold',
        fontStyle: 'normal',
        color: '#000000',
        textAlign: 'center',
        lineHeight: 1.2,
        letterSpacing: 2,
      },
    },
    // 订单编号占位符
    {
      id: 'el-002',
      type: 'placeholder',
      position: { x: 0, y: 18 },
      size: { width: 90, height: 8 },
      rotation: 0,
      zIndex: 2,
      locked: false,
      visible: true,
      field: 'order.orderNumber',
      label: '订单编号',
      format: 'text',
      fallback: '-',
      style: {
        fontFamily: 'SimSun',
        fontSize: 12,
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: '#333333',
        textAlign: 'left',
        lineHeight: 1.2,
        letterSpacing: 0,
      },
    },
    // 客户名称占位符
    {
      id: 'el-003',
      type: 'placeholder',
      position: { x: 90, y: 18 },
      size: { width: 90, height: 8 },
      rotation: 0,
      zIndex: 2,
      locked: false,
      visible: true,
      field: 'customer.name',
      label: '客户名称',
      format: 'text',
      fallback: '-',
      style: {
        fontFamily: 'SimSun',
        fontSize: 12,
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: '#333333',
        textAlign: 'left',
        lineHeight: 1.2,
        letterSpacing: 0,
      },
    },
    // 明细表格
    {
      id: 'el-004',
      type: 'table',
      position: { x: 0, y: 32 },
      size: { width: 180, height: 80 },
      rotation: 0,
      zIndex: 3,
      locked: false,
      visible: true,
      dataSource: 'items',
      columns: [
        {
          key: 'name',
          label: '产品名称',
          width: 35,
          widthUnit: '%',
          align: 'left',
          format: 'text',
        },
        {
          key: 'spec',
          label: '规格',
          width: 20,
          widthUnit: '%',
          align: 'center',
          format: 'text',
        },
        {
          key: 'quantity',
          label: '数量',
          width: 15,
          widthUnit: '%',
          align: 'right',
          format: 'number',
        },
        {
          key: 'unitPrice',
          label: '单价',
          width: 15,
          widthUnit: '%',
          align: 'right',
          format: 'currency',
        },
        {
          key: 'subtotal',
          label: '金额',
          width: 15,
          widthUnit: '%',
          align: 'right',
          format: 'currency',
        },
      ],
      style: {
        headerBgColor: '#f0f0f0',
        headerTextColor: '#000000',
        headerFontSize: 11,
        bodyFontSize: 10,
        borderColor: '#000000',
        borderWidth: 1,
        rowHeight: 7,
        stripedRows: true,
        stripedColor: '#fafafa',
      },
      showSummary: true,
      summaryColumns: ['quantity', 'subtotal'],
    },
    // 大写金额
    {
      id: 'el-005',
      type: 'placeholder',
      position: { x: 0, y: 120 },
      size: { width: 180, height: 8 },
      rotation: 0,
      zIndex: 4,
      locked: false,
      visible: true,
      field: 'totalAmount',
      label: '大写金额',
      format: 'currency_cap',
      fallback: '-',
      style: {
        fontFamily: 'SimSun',
        fontSize: 12,
        fontWeight: 'bold',
        fontStyle: 'normal',
        color: '#cc0000',
        textAlign: 'right',
        lineHeight: 1.2,
        letterSpacing: 0,
      },
    },
  ],
};

// 测试数据
const testData = {
  order: {
    orderNumber: 'SO-2026-0001',
    createdAt: '2026-01-13',
  },
  customer: {
    name: '北京建材有限公司',
    phone: '010-12345678',
  },
  items: [
    {
      name: '800x800 抛光砖',
      spec: '800x800mm',
      quantity: 100,
      unitPrice: 45,
      subtotal: 4500,
    },
    {
      name: '600x600 仿古砖',
      spec: '600x600mm',
      quantity: 200,
      unitPrice: 35,
      subtotal: 7000,
    },
    {
      name: '300x300 马赛克',
      spec: '300x300mm',
      quantity: 50,
      unitPrice: 25,
      subtotal: 1250,
    },
  ],
  totalAmount: 12750,
};

export default function PrintPreviewTestPage() {
  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <h1 className="mb-6 text-2xl font-bold">打印设计器渲染器测试</h1>

      <div className="flex justify-center">
        <PrintCanvas
          template={testTemplate}
          data={testData}
          scale={1}
          showShadow
        />
      </div>

      <div className="mt-8 rounded-lg bg-white p-4">
        <h2 className="mb-2 font-bold">测试数据</h2>
        <pre className="overflow-auto rounded bg-slate-50 p-2 text-sm">
          {JSON.stringify(testData, null, 2)}
        </pre>
      </div>
    </div>
  );
}
