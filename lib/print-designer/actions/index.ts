/**
 * 打印设计器 - Server Actions 导出
 */

export {
    getRecentSalesOrders,
    getSalesOrderForPrint,
    getPurchaseOrderForPrint,
    getFactoryShipmentForPrint,
    getInboundRecordForPrint,
    getReturnOrderForPrint,
    getPrintDataForTemplate
} from './preview-data';

export {
    deleteTemplate,
    duplicateTemplate,
    getDefaultTemplate,
    getTemplate,
    getTemplates,
    saveTemplate,
    setDefaultTemplate
} from './template-crud';

