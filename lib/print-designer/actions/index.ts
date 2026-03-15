/**
 * 打印设计器 - Server Actions 导出
 */

export {
  getRecentDocumentsForTemplate,
  getRecentSalesOrders,
  getSalesOrderForPrint,
  getPurchaseOrderForPrint,
  getFactoryShipmentForPrint,
  getInboundRecordForPrint,
  getReturnOrderForPrint,
  getPrintDataForTemplate,
} from './preview-data';
export type { RecentPrintDocumentOption } from './preview-data';

export {
  deleteTemplate,
  duplicateTemplate,
  getDefaultTemplate,
  getTemplate,
  getTemplates,
  saveTemplate,
  setDefaultTemplate,
} from './template-crud';
