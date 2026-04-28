/**
 * StyleEditor - 打印样式编辑器主组件
 *
 * 功能：
 * - DIY 样式配置界面
 * - 实时预览
 * - 预设模板切换
 * - 模板保存/加载
 *
 * 设计原则：
 * - 单一职责：仅负责样式编辑界面
 * - 组合优于继承：通过子组件组合功能
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { factoryShipmentPrintConfig } from '@/lib/config/print-fields/factory-shipment-fields';
import { purchaseOrderPrintConfig } from '@/lib/config/print-fields/purchase-order-fields';
import { salesOrderPrintConfig } from '@/lib/config/print-fields/sales-order-fields';
import { PrintTemplateService } from '@/lib/services/print-template-service';
import type { DocumentType } from '@/lib/types/print-config';
import {
  createDefaultStyleConfig,
  type FooterSettings,
  getPresetStyle,
  type HeaderSettings,
  type InfoSectionSettings,
  type PageSettings,
  type PresetStyleType,
  type PrintStyleConfig,
  type SignatureSettings,
  type SummaryFieldColorOption,
  type SummarySettings,
  type TableSettings,
  validateStyleConfig,
} from '@/lib/types/print-style';
import { cn } from '@/lib/utils';

import { PrintLayout } from './PrintLayout';
import { HeaderSettings as HeaderSettingsPanel } from './style-panels/HeaderSettings';
import { OtherSettings as OtherSettingsPanel } from './style-panels/OtherSettings';
import { PageSettings as PageSettingsPanel } from './style-panels/PageSettings';
import { TableSettings as TableSettingsPanel } from './style-panels/TableSettings';

/**
 * StyleEditor 组件属性
 */
export interface StyleEditorProps {
  /**
   * 是否打开编辑器
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
   * 初始配置（可选）
   */
  initialConfig?: PrintStyleConfig;

  /**
   * 保存回调
   */
  onSave?: (config: PrintStyleConfig) => void;

  /**
   * 预览数据（可选，用于实时预览）
   */
  previewData?: {
    header?: Record<string, unknown>;
    items?: Record<string, unknown>[];
    summary?: Record<string, unknown>;
  };
}

/**
 * StyleEditor 主组件
 *
 * @example
 * ```tsx
 * <StyleEditor
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   documentType="sales-order"
 *   onSave={(config) => console.log('Saved:', config)}
 * />
 * ```
 */
export function StyleEditor({
  open,
  onClose,
  documentType,
  initialConfig,
  onSave,
  previewData: _previewData,
}: StyleEditorProps) {
  const getPrintConfigForDocumentType = useCallback(() => {
    switch (documentType) {
      case 'purchase-order':
        return purchaseOrderPrintConfig;
      case 'factory-shipment':
        return factoryShipmentPrintConfig;
      case 'sales-order':
      default:
        return salesOrderPrintConfig;
    }
  }, [documentType]);

  // 当前配置状态
  const [config, setConfig] = useState<PrintStyleConfig>(
    () =>
      initialConfig ||
      PrintTemplateService.getDefaultTemplate(documentType) ||
      createDefaultStyleConfig(documentType)
  );

  // 当前选择的预设
  const [selectedPreset, setSelectedPreset] =
    useState<PresetStyleType>('classic');

  // 当前激活的标签页
  const [activeTab, setActiveTab] = useState('page');

  // 预设切换处理
  const handlePresetChange = useCallback(
    (preset: PresetStyleType) => {
      setSelectedPreset(preset);
      const newConfig = getPresetStyle(
        preset,
        documentType,
        config.header.companyName
      );
      setConfig(newConfig);
    },
    [documentType, config.header.companyName]
  );

  // 页面设置更新
  const updatePageSettings = useCallback((updates: Partial<PageSettings>) => {
    setConfig(prev => ({
      ...prev,
      page: { ...prev.page, ...updates },
    }));
  }, []);

  // 表头设置更新
  const updateHeaderSettings = useCallback(
    (updates: Partial<HeaderSettings>) => {
      setConfig(prev => ({
        ...prev,
        header: { ...prev.header, ...updates },
      }));
    },
    []
  );

  // 信息区设置更新（预留用于未来扩展）
  const _updateInfoSectionSettings = useCallback(
    (updates: Partial<InfoSectionSettings>) => {
      setConfig(prev => ({
        ...prev,
        infoSection: { ...prev.infoSection, ...updates },
      }));
    },
    []
  );

  // 表格设置更新
  const updateTableSettings = useCallback((updates: Partial<TableSettings>) => {
    setConfig(prev => ({
      ...prev,
      table: { ...prev.table, ...updates },
    }));
  }, []);

  // 汇总区设置更新
  const updateSummarySettings = useCallback(
    (updates: Partial<SummarySettings>) => {
      setConfig(prev => ({
        ...prev,
        summary: { ...prev.summary, ...updates },
      }));
    },
    []
  );

  // 页脚设置更新
  const updateFooterSettings = useCallback(
    (updates: Partial<FooterSettings>) => {
      setConfig(prev => ({
        ...prev,
        footer: { ...prev.footer, ...updates },
      }));
    },
    []
  );

  // 签名区设置更新
  const updateSignatureSettings = useCallback(
    (updates: Partial<SignatureSettings>) => {
      setConfig(prev => ({
        ...prev,
        signature: { ...prev.signature, ...updates },
      }));
    },
    []
  );

  const summaryFieldOptions = useMemo<SummaryFieldColorOption[]>(
    () =>
      getPrintConfigForDocumentType().summaryFields.map(field => ({
        key: field.key,
        label: field.label,
      })),
    [getPrintConfigForDocumentType]
  );

  // 保存模板
  const handleSave = useCallback(() => {
    const validation = validateStyleConfig(config);
    if (!validation.valid) {
      alert(`配置验证失败：\n${validation.errors.join('\n')}`);
      return;
    }

    // 保存到 localStorage
    PrintTemplateService.saveTemplate(config);
    PrintTemplateService.setDefaultTemplate(documentType, config);

    // 回调
    onSave?.(config);
    onClose();
  }, [config, documentType, onSave, onClose]);

  // 重置为默认
  const handleReset = useCallback(() => {
    if (confirm('确定要重置为默认配置吗？')) {
      const defaultConfig = createDefaultStyleConfig(
        documentType,
        config.header.companyName
      );
      setConfig(defaultConfig);
    }
  }, [documentType, config.header.companyName]);

  // 预览内容
  const previewContent = useMemo(() => {
    const printConfig = getPrintConfigForDocumentType();
    const summarySampleValues: Record<string, unknown> = {
      totalQuantity: 300,
      totalWeight: 5.5,
      totalAmount: 3000,
      totalAmountChinese: '叁仟元整',
      customerOwnedAmount: 1800,
      selfOwnedAmount: 1200,
      costAmount: 2300,
      expenseAmount: 260,
      profitAmount: 440,
    };

    return (
      <PrintLayout
        size={config.page.size}
        orientation={config.page.orientation}
        margin={config.page.margin}
        borderColor={config.page.borderColor}
        borderWidth={config.page.borderWidth}
      >
        {/* 表头 */}
        <div
          className="print-header"
          style={{
            textAlign: config.header.alignment,
            borderBottom: config.header.showBorder
              ? `${config.header.borderWidth ?? 1}px solid ${config.header.borderColor}`
              : 'none',
            backgroundColor: config.header.backgroundColor,
            padding: `${config.header.padding}px`,
          }}
        >
          {config.header.showLogo && config.header.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.header.logoUrl}
              alt="Logo"
              style={{
                width: config.header.logoWidth,
                height: config.header.logoHeight,
                marginBottom: '8px',
              }}
            />
          )}
          <h1
            style={{
              fontSize: `${config.header.companyNameFontSize}px`,
              margin: '8px 0',
            }}
          >
            {config.header.companyName}
          </h1>
          {config.header.subtitle && (
            <h2
              style={{
                fontSize: `${config.header.subtitleFontSize}px`,
                margin: '4px 0',
              }}
            >
              {config.header.subtitle}
            </h2>
          )}
        </div>

        {/* 信息区示例 */}
        <div
          className="info-section"
          style={{
            margin: '16px 0',
            display: 'grid',
            gridTemplateColumns:
              config.infoSection.layout === 'single-column'
                ? '1fr'
                : config.infoSection.layout === 'two-column'
                  ? '1fr 1fr'
                  : '1fr 1fr 1fr',
            gap: `${config.infoSection.rowSpacing}px`,
          }}
        >
          <div>
            <span
              style={{
                color: config.infoSection.labelColor,
                fontSize: `${config.infoSection.labelFontSize}px`,
              }}
            >
              客户名称：
            </span>
            <span
              style={{
                color: config.infoSection.valueColor,
                fontSize: `${config.infoSection.valueFontSize}px`,
              }}
            >
              示例客户
            </span>
          </div>
          <div>
            <span
              style={{
                color: config.infoSection.labelColor,
                fontSize: `${config.infoSection.labelFontSize}px`,
              }}
            >
              订单编号：
            </span>
            <span
              style={{
                color: config.infoSection.valueColor,
                fontSize: `${config.infoSection.valueFontSize}px`,
              }}
            >
              SO-2025-001
            </span>
          </div>
        </div>

        {/* 表格示例 */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border:
              config.table.borderStyle !== 'none'
                ? `${config.table.borderWidth}px ${config.table.borderStyle} ${config.table.borderColor}`
                : 'none',
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: config.table.headerBgColor,
                color: config.table.headerTextColor,
                fontSize: `${config.table.headerFontSize}px`,
                fontWeight: config.table.headerFontWeight,
              }}
            >
              <th
                style={{
                  padding: `${config.table.cellPadding}px`,
                  border:
                    config.table.borderStyle !== 'none'
                      ? `${config.table.borderWidth}px ${config.table.borderStyle} ${config.table.borderColor}`
                      : 'none',
                }}
              >
                产品名称
              </th>
              <th
                style={{
                  padding: `${config.table.cellPadding}px`,
                  border:
                    config.table.borderStyle !== 'none'
                      ? `${config.table.borderWidth}px ${config.table.borderStyle} ${config.table.borderColor}`
                      : 'none',
                }}
              >
                数量
              </th>
              <th
                style={{
                  padding: `${config.table.cellPadding}px`,
                  border:
                    config.table.borderStyle !== 'none'
                      ? `${config.table.borderWidth}px ${config.table.borderStyle} ${config.table.borderColor}`
                      : 'none',
                }}
              >
                单价
              </th>
              <th
                style={{
                  padding: `${config.table.cellPadding}px`,
                  border:
                    config.table.borderStyle !== 'none'
                      ? `${config.table.borderWidth}px ${config.table.borderStyle} ${config.table.borderColor}`
                      : 'none',
                }}
              >
                金额
              </th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map(i => (
              <tr
                key={i}
                style={{
                  backgroundColor:
                    config.table.stripedRows && i % 2 === 0
                      ? config.table.stripedColor
                      : 'transparent',
                  fontSize: `${config.table.rowFontSize}px`,
                  height: `${config.table.rowHeight}px`,
                }}
              >
                <td
                  style={{
                    padding: `${config.table.cellPadding}px`,
                    border:
                      config.table.borderStyle !== 'none'
                        ? `${config.table.borderWidth}px ${config.table.borderStyle} ${config.table.borderColor}`
                        : 'none',
                  }}
                >
                  产品 {i}
                </td>
                <td
                  style={{
                    padding: `${config.table.cellPadding}px`,
                    border:
                      config.table.borderStyle !== 'none'
                        ? `${config.table.borderWidth}px ${config.table.borderStyle} ${config.table.borderColor}`
                        : 'none',
                  }}
                >
                  100
                </td>
                <td
                  style={{
                    padding: `${config.table.cellPadding}px`,
                    border:
                      config.table.borderStyle !== 'none'
                        ? `${config.table.borderWidth}px ${config.table.borderStyle} ${config.table.borderColor}`
                        : 'none',
                  }}
                >
                  ¥10.00
                </td>
                <td
                  style={{
                    padding: `${config.table.cellPadding}px`,
                    border:
                      config.table.borderStyle !== 'none'
                        ? `${config.table.borderWidth}px ${config.table.borderStyle} ${config.table.borderColor}`
                        : 'none',
                  }}
                >
                  ¥1,000.00
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 汇总区示例 */}
        <div
          className="summary-section"
          style={{
            marginTop: '16px',
            textAlign: config.summary.alignment,
            fontSize: `${config.summary.fontSize}px`,
            fontWeight: config.summary.fontWeight,
            padding: `${config.summary.padding}px`,
          }}
        >
          {printConfig.summaryFields.map(field => {
            if (
              !config.summary.showChineseAmount &&
              field.key === 'totalAmountChinese'
            ) {
              return null;
            }

            const rawValue = summarySampleValues[field.key];
            if (rawValue === undefined) {
              return null;
            }

            const fieldLabelColor =
              config.summary.fieldLabelColors?.[field.key];
            const fieldValueColor = config.summary.fieldColors?.[field.key];
            const shouldHighlight =
              config.summary.highlightTotal &&
              field.key.toLowerCase().includes('totalamount') &&
              !field.key.includes('Chinese');

            return (
              <div
                key={field.key}
                style={{
                  backgroundColor: shouldHighlight
                    ? config.summary.highlightColor
                    : 'transparent',
                  display: 'inline-block',
                  padding: '6px 12px',
                  margin: '2px 8px',
                }}
              >
                <span
                  style={{
                    color: fieldLabelColor || 'inherit',
                  }}
                >
                  {field.label}：
                </span>
                <span
                  style={{
                    color: fieldValueColor || 'inherit',
                    fontWeight: fieldValueColor ? 'bold' : 'inherit',
                  }}
                >
                  {field.format ? field.format(rawValue) : String(rawValue)}
                </span>
              </div>
            );
          })}
        </div>

        {/* 签名区示例 */}
        {config.signature.show && (
          <div
            className="signature-section"
            style={{
              marginTop: `${config.signature.spacing}px`,
              display: 'flex',
              justifyContent: 'space-around',
              fontSize: `${config.signature.fontSize}px`,
            }}
          >
            {config.signature.fields.map((field, index) => (
              <div key={index} style={{ textAlign: 'center' }}>
                <div>{field.label}：</div>
                <div
                  style={{
                    width: `${field.width}mm`,
                    borderBottom: `1px solid ${config.signature.lineColor}`,
                    marginTop: '32px',
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* 页脚示例 */}
        {config.footer.show && (
          <div
            className="footer-section"
            style={{
              marginTop: '32px',
              textAlign: config.footer.alignment,
              fontSize: `${config.footer.fontSize}px`,
              color: config.footer.textColor,
            }}
          >
            {config.footer.content
              .replace('{pageNumber}', '1')
              .replace('{totalPages}', '1')
              .replace('{date}', new Date().toLocaleDateString())
              .replace('{time}', new Date().toLocaleTimeString())}
          </div>
        )}
      </PrintLayout>
    );
  }, [config, getPrintConfigForDocumentType]);

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className={cn('flex h-[90vh] max-w-7xl flex-col')}>
        <DialogHeader>
          <DialogTitle>打印样式编辑器</DialogTitle>
          <DialogDescription>打印样式设置</DialogDescription>
        </DialogHeader>

        {/* 顶部工具栏 */}
        <div className="flex items-center gap-4 border-b p-4">
          {/* 预设模板选择 */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">预设模板：</label>
            <Select value={selectedPreset} onValueChange={handlePresetChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">经典样式</SelectItem>
                <SelectItem value="modern">现代样式</SelectItem>
                <SelectItem value="compact">紧凑样式</SelectItem>
                <SelectItem value="tianjin-haoxing">天津豪星发货单</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1" />

          {/* 操作按钮 */}
          <Button variant="outline" onClick={handleReset}>
            重置
          </Button>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </div>

        {/* 主内容区域 */}
        <div className="flex flex-1 gap-4 overflow-hidden">
          {/* 左侧：设置面板 */}
          <div className="w-1/2 overflow-y-auto border-r">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="page">页面</TabsTrigger>
                <TabsTrigger value="header">表头</TabsTrigger>
                <TabsTrigger value="table">表格</TabsTrigger>
                <TabsTrigger value="other">其他</TabsTrigger>
              </TabsList>

              <TabsContent value="page" className="p-4">
                <div className="space-y-4">
                  <h3 className="font-medium">页面设置</h3>
                  <p className="text-muted-foreground text-sm">
                    配置纸张大小、方向和边距
                  </p>
                  <PageSettingsPanel
                    value={config.page}
                    onChange={updatePageSettings}
                  />
                </div>
              </TabsContent>

              <TabsContent value="header" className="p-4">
                <div className="space-y-4">
                  <h3 className="font-medium">表头设置</h3>
                  <p className="text-muted-foreground text-sm">
                    配置公司Logo、名称和标题样式
                  </p>
                  <HeaderSettingsPanel
                    value={config.header}
                    onChange={updateHeaderSettings}
                  />
                </div>
              </TabsContent>

              <TabsContent value="table" className="p-4">
                <div className="space-y-4">
                  <h3 className="font-medium">表格设置</h3>
                  <p className="text-muted-foreground text-sm">
                    配置表格颜色、边框和字体
                  </p>
                  <TableSettingsPanel
                    value={config.table}
                    onChange={updateTableSettings}
                  />
                </div>
              </TabsContent>

              <TabsContent value="other" className="p-4">
                <div className="space-y-4">
                  <h3 className="font-medium">其他设置</h3>
                  <p className="text-muted-foreground text-sm">
                    配置签名区、页脚和汇总区样式
                  </p>
                  <OtherSettingsPanel
                    summary={config.summary}
                    footer={config.footer}
                    signature={config.signature}
                    summaryFields={summaryFieldOptions}
                    onSummaryChange={updateSummarySettings}
                    onFooterChange={updateFooterSettings}
                    onSignatureChange={updateSignatureSettings}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* 右侧：实时预览 */}
          <div className="w-1/2 overflow-y-auto bg-gray-100 p-4">
            <div className="mb-2 text-sm font-medium">实时预览</div>
            <div className="rounded-lg bg-white shadow-sm">
              {previewContent}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
