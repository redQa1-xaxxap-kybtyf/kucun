/**
 * PrintPreviewDialog - 打印预览对话框
 *
 * 功能：
 * - 打印预览
 * - 样式编辑
 * - 字段选择
 * - 打印/导出PDF
 *
 * 设计原则：
 * - 单一职责：负责打印预览和操作UI
 * - 组合优于继承：组合StyleEditor和FieldSelector
 */

'use client';

import React, { useState, useRef, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { PrintService } from '@/lib/services/print-service';
import { PrintTemplateService } from '@/lib/services/print-template-service';
import {
  getDefaultSelectedKeys,
  type DocumentType,
  type FieldSelection,
  type PrintConfig,
} from '@/lib/types/print-config';
import {
  createDefaultStyleConfig,
  type PrintStyleConfig,
} from '@/lib/types/print-style';
import { cn } from '@/lib/utils';

import { FieldSelector } from './FieldSelector';
import { StyleEditor } from './StyleEditor';

/**
 * PrintPreviewDialog 组件属性
 */
export interface PrintPreviewDialogProps {
  /**
   * 是否打开
   */
  open: boolean;

  /**
   * 关闭回调
   */
  onClose: () => void;

  /**
   * 文档类型
   */
  documentType: DocumentType;

  /**
   * 打印配置
   */
  printConfig: PrintConfig;

  /**
   * 渲染打印内容
   */
  renderContent: (
    styleConfig: PrintStyleConfig,
    fieldSelection: FieldSelection
  ) => React.ReactNode;

  /**
   * 对话框标题
   */
  title?: string;
}

/**
 * PrintPreviewDialog 组件
 *
 * @example
 * ```tsx
 * <PrintPreviewDialog
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   documentType="sales-order"
 *   printConfig={salesOrderPrintConfig}
 *   renderContent={(style, fields) => (
 *     <SalesOrderPrintContent order={order} style={style} fields={fields} />
 *   )}
 * />
 * ```
 */
export function PrintPreviewDialog({
  open,
  onClose,
  documentType,
  printConfig,
  renderContent,
  title = '打印预览',
}: PrintPreviewDialogProps) {
  const { toast } = useToast();
  const printContainerRef = useRef<HTMLDivElement>(null);

  // 样式配置状态
  const [styleConfig, setStyleConfig] = useState<PrintStyleConfig>(
    () =>
      PrintTemplateService.getDefaultTemplate(documentType) ||
      createDefaultStyleConfig(documentType)
  );

  // 字段选择状态
  const [fieldSelection, setFieldSelection] = useState<FieldSelection>(() =>
    getDefaultSelectedKeys(printConfig)
  );

  // 样式编辑器开关
  const [showStyleEditor, setShowStyleEditor] = useState(false);

  // 当前标签页
  const [activeTab, setActiveTab] = useState<'preview' | 'fields'>('preview');

  // 打印处理
  const handlePrint = useCallback(() => {
    try {
      PrintService.print();
      toast({
        title: '打印',
        description: '已发送到打印机',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: '打印失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // 导出PDF处理
  const handleExportPDF = useCallback(async () => {
    if (!printContainerRef.current) {
      toast({
        title: '导出失败',
        description: '未找到打印内容',
        variant: 'destructive',
      });
      return;
    }

    try {
      await PrintService.exportToPDF(printContainerRef.current, {
        orientation: styleConfig.page.orientation,
        format: styleConfig.page.size.toLowerCase() as 'a4' | 'a5' | 'letter',
        filename: `${printConfig.title}_${new Date().getTime()}.pdf`,
      });

      toast({
        title: '导出成功',
        description: 'PDF文件已下载',
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: '导出失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  }, [styleConfig, printConfig.title, toast]);

  // 样式保存回调
  const handleStyleSave = useCallback((newStyle: PrintStyleConfig) => {
    setStyleConfig(newStyle);
    setShowStyleEditor(false);
  }, []);

  return (
    <>
      <Dialog open={open} onOpenChange={isOpen => !isOpen && onClose()}>
        <DialogContent className={cn('flex h-[90vh] max-w-7xl flex-col')}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              调整打印样式和字段，预览后打印或导出PDF
            </DialogDescription>
          </DialogHeader>

          {/* 工具栏 */}
          <div className="flex items-center gap-4 border-b p-4">
            <Button variant="outline" onClick={() => setShowStyleEditor(true)}>
              样式设置
            </Button>

            <div className="flex-1" />

            <Button variant="outline" onClick={handleExportPDF}>
              导出PDF
            </Button>
            <Button onClick={handlePrint}>打印</Button>
            <Button variant="outline" onClick={onClose}>
              关闭
            </Button>
          </div>

          {/* 主内容区 */}
          <div className="flex flex-1 gap-4 overflow-hidden">
            {/* 左侧：字段选择 */}
            <div className="w-1/3 overflow-y-auto border-r">
              <Tabs
                value={activeTab}
                onValueChange={v => setActiveTab(v as 'preview' | 'fields')}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="preview" className="flex-1">
                    预览
                  </TabsTrigger>
                  <TabsTrigger value="fields" className="flex-1">
                    字段选择
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="preview" className="p-4">
                  <div className="space-y-4">
                    <h3 className="font-medium">预览说明</h3>
                    <ul className="text-muted-foreground space-y-2 text-sm">
                      <li>• 右侧显示实时预览效果</li>
                      <li>• 点击&ldquo;样式设置&rdquo;自定义样式</li>
                      <li>• 切换到&ldquo;字段选择&rdquo;选择打印字段</li>
                      <li>• 点击&ldquo;打印&rdquo;直接打印</li>
                      <li>• 点击&ldquo;导出PDF&rdquo;保存为PDF文件</li>
                    </ul>

                    <div className="bg-muted space-y-1 rounded-md p-3 text-sm">
                      <div className="font-medium">当前配置</div>
                      <div className="text-muted-foreground">
                        纸张：{styleConfig.page.size}{' '}
                        {styleConfig.page.orientation === 'landscape'
                          ? '横向'
                          : '纵向'}
                      </div>
                      <div className="text-muted-foreground">
                        模板：{styleConfig.name}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="fields" className="p-0">
                  <FieldSelector
                    config={printConfig}
                    selectedFields={fieldSelection}
                    onSelectionChange={setFieldSelection}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* 右侧：打印预览 */}
            <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
              <div className="mb-2 text-sm font-medium">打印预览</div>
              <div
                ref={printContainerRef}
                className="rounded-lg bg-white shadow-sm"
              >
                {renderContent(styleConfig, fieldSelection)}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 样式编辑器 */}
      {showStyleEditor && (
        <StyleEditor
          open={showStyleEditor}
          onClose={() => setShowStyleEditor(false)}
          documentType={documentType}
          initialConfig={styleConfig}
          onSave={handleStyleSave}
        />
      )}
    </>
  );
}
