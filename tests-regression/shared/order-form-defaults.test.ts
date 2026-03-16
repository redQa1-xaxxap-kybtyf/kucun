import {
  createFactoryShipmentDraftItem,
  createPurchaseOrderDraftItem,
} from '@/lib/utils/order-form-defaults';

describe('order-form-defaults', () => {
  describe('createPurchaseOrderDraftItem', () => {
    it('优先使用用户选择的常用供应商', () => {
      const item = createPurchaseOrderDraftItem({
        items: [
          {
            supplierId: 'supplier-old',
            productCode: 'P-1',
            quantity: 1,
            unitPrice: 10,
            totalPrice: 10,
            displayName: '测试产品',
          },
        ] as any,
        preferredSupplierId: 'supplier-default',
      });

      expect(item.supplierId).toBe('supplier-default');
    });

    it('未指定常用供应商时继承最后一条已填写供应商', () => {
      const item = createPurchaseOrderDraftItem({
        items: [
          {
            supplierId: 'supplier-a',
            productCode: 'P-1',
            quantity: 1,
            unitPrice: 10,
            totalPrice: 10,
            displayName: '测试产品A',
          },
          {
            supplierId: '',
            productCode: 'P-2',
            quantity: 1,
            unitPrice: 12,
            totalPrice: 12,
            displayName: '测试产品B',
          },
          {
            supplierId: 'supplier-b',
            productCode: 'P-3',
            quantity: 1,
            unitPrice: 14,
            totalPrice: 14,
            displayName: '测试产品C',
          },
        ] as any,
      });

      expect(item.supplierId).toBe('supplier-b');
    });
  });

  describe('createFactoryShipmentDraftItem', () => {
    it('新增厂家直发明细时继承常用供应商', () => {
      const item = createFactoryShipmentDraftItem({
        preferredSupplierId: 'factory-supplier',
      });

      expect(item.supplierId).toBe('factory-supplier');
      expect(item.quantity).toBe(1);
      expect(item.ownership).toBe('customer');
    });

    it('未设置常用供应商时回退到最后一条已填写供应商', () => {
      const item = createFactoryShipmentDraftItem({
        items: [
          {
            supplierId: 'factory-a',
            productCode: 'F-1',
            quantity: 2,
            unitPrice: 20,
            ownership: 'customer',
            displayName: '厂家产品A',
          },
          {
            supplierId: 'factory-b',
            productCode: 'F-2',
            quantity: 3,
            unitPrice: 30,
            ownership: 'customer',
            displayName: '厂家产品B',
          },
        ] as any,
      });

      expect(item.supplierId).toBe('factory-b');
    });
  });
});
