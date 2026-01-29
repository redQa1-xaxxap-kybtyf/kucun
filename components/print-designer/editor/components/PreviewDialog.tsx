/**
 * 打印设计器 - 预览对话框
 *
 * 支持模拟数据和真实订单数据预览
 */

'use client';

import { Eye, Loader2, Printer, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  getRecentSalesOrders,
  getSalesOrderForPrint,
} from '@/lib/print-designer/actions';
import type { PrintTemplate } from '@/lib/print-designer/schemas';

import { PrintCanvas } from '../../renderer';

interface PreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: PrintTemplate;
}

function getCssPageSize(settings: PrintTemplate['pageSettings']): string {
  if (settings.size === 'Custom') {
    return `${settings.width}mm ${settings.height}mm`;
  }
  return `${settings.size} ${settings.orientation}`;
}

// 模拟数据
const mockSalesOrderData = {
  order: {
    orderNumber: 'SO-2026-0001',
    createdAt: '2026-01-13',
    status: '待发货',
    remark: '请注意轻拿轻放',
    deliveryDate: '2026-01-15',
  },
  customer: {
    name: '北京建材有限公司',
    phone: '010-12345678',
    address: '北京市朝阳区建国路88号',
    contact: '张经理',
  },
  company: {
    name: '天津豪星陶瓷有限公司',
    phone: '022-88888888',
    address: '天津市西青区陶瓷产业园',
    fax: '022-88888889',
  },
  items: [
    {
      name: '800x800 抛光砖 - 米黄色',
      code: 'PG-800-001',
      spec: '800x800mm',
      productName: '800x800 抛光砖 - 米黄色',
      productCode: 'PG-800-001',
      specification: '800x800mm',
      unit: '片',
      quantity: 100,
      unitPrice: 45,
      subtotal: 4500,
      weight: 25,
      boxes: 5,
      remark: '',
    },
    {
      name: '600x600 仿古砖 - 灰色',
      code: 'FG-600-002',
      spec: '600x600mm',
      productName: '600x600 仿古砖 - 灰色',
      productCode: 'FG-600-002',
      specification: '600x600mm',
      unit: '片',
      quantity: 200,
      unitPrice: 35,
      subtotal: 7000,
      weight: 30,
      boxes: 8,
      remark: '需要切角',
    },
    {
      name: '300x300 马赛克 - 蓝色',
      code: 'MS-300-003',
      spec: '300x300mm',
      productName: '300x300 马赛克 - 蓝色',
      productCode: 'MS-300-003',
      specification: '300x300mm',
      unit: '片',
      quantity: 50,
      unitPrice: 25,
      subtotal: 1250,
      weight: 5,
      boxes: 2,
      remark: '',
    },
  ],
  totalAmount: 12750,
  totalQuantity: 350,
  totalWeight: 60,
  totalBoxes: 15,
  operator: { name: '李明' },
  printDate: new Date().toISOString().split('T')[0],
};

interface OrderOption {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerName: string;
}

export function PreviewDialog({
  open,
  onOpenChange,
  template,
}: PreviewDialogProps) {
  const [scale, setScale] = useState(1);
  const [dataSource, setDataSource] = useState<'mock' | 'real'>('mock');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [recentOrders, setRecentOrders] = useState<OrderOption[]>([]);
  const [previewData, setPreviewData] =
    useState<Record<string, unknown>>(mockSalesOrderData);
  const [isPending, startTransition] = useTransition();
  const printRef = useRef<HTMLDivElement>(null);

  // 加载最近订单列表
  useEffect(() => {
    if (open && dataSource === 'real' && recentOrders.length === 0) {
      startTransition(async () => {
        const orders = await getRecentSalesOrders(20);
        setRecentOrders(orders);
        if (orders.length > 0 && !selectedOrderId) {
          setSelectedOrderId(orders[0].id);
        }
      });
    }
  }, [open, dataSource, recentOrders.length, selectedOrderId]);

  // 加载选中订单数据
  useEffect(() => {
    if (dataSource === 'real' && selectedOrderId) {
      startTransition(async () => {
        const data = await getSalesOrderForPrint(selectedOrderId);
        if (data) {
          setPreviewData(data);
        }
      });
    } else if (dataSource === 'mock') {
      setPreviewData(mockSalesOrderData);
    }
  }, [dataSource, selectedOrderId]);

  const handlePrint = () => {
    if (!printRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = printRef.current.innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${template.name}</title>
          <style>
            @page {
              size: ${getCssPageSize(template.pageSettings)};
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const handleRefresh = () => {
    if (dataSource === 'real' && selectedOrderId) {
      startTransition(async () => {
        const data = await getSalesOrderForPrint(selectedOrderId);
        if (data) {
          setPreviewData(data);
        }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between border-b pb-3">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            预览: {template.name}
          </DialogTitle>
          <div className="flex items-center gap-2">
            {/* 数据源选择 */}
            <Select
              value={dataSource}
              onValueChange={v => setDataSource(v as 'mock' | 'real')}
            >
              <SelectTrigger className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mock">模拟数据</SelectItem>
                <SelectItem value="real">真实订单</SelectItem>
              </SelectContent>
            </Select>

            {/* 订单选择 (真实数据时) */}
            {dataSource === 'real' && (
              <Select
                value={selectedOrderId}
                onValueChange={setSelectedOrderId}
              >
                <SelectTrigger className="h-8 w-40">
                  <SelectValue placeholder="选择订单" />
                </SelectTrigger>
                <SelectContent>
                  {recentOrders.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.orderNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* 刷新按钮 */}
            {dataSource === 'real' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleRefresh}
                disabled={isPending}
              >
                <RefreshCw
                  className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`}
                />
              </Button>
            )}

            {/* 缩放 */}
            <Select
              value={String(scale)}
              onValueChange={v => setScale(parseFloat(v))}
            >
              <SelectTrigger className="h-8 w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">50%</SelectItem>
                <SelectItem value="0.75">75%</SelectItem>
                <SelectItem value="1">100%</SelectItem>
                <SelectItem value="1.25">125%</SelectItem>
                <SelectItem value="1.5">150%</SelectItem>
              </SelectContent>
            </Select>

            {/* 打印按钮 */}
            <Button onClick={handlePrint} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Printer className="mr-1.5 h-4 w-4" />
              )}
              打印
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-slate-100 p-8">
          <div className="flex justify-center" ref={printRef}>
            <PrintCanvas
              template={template}
              data={previewData}
              scale={scale}
              showShadow
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
