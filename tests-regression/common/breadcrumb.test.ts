import { buildBreadcrumbItemsForPath } from '@/components/common/Breadcrumb';

function titles(pathname: string, options = {}) {
  return buildBreadcrumbItemsForPath({ pathname, ...options }).map(
    item => item.title
  );
}

describe('buildBreadcrumbItemsForPath', () => {
  it('maps settings and print designer routes to Chinese titles', () => {
    expect(titles('/settings/print-designer')).toEqual([
      '首页',
      '系统设置',
      '模板设计',
    ]);
    expect(titles('/settings/data-management')).toEqual([
      '首页',
      '系统设置',
      '数据管理',
    ]);
    expect(titles('/settings/shipping-sites/selector-helper')).toEqual([
      '首页',
      '系统设置',
      '运输站点管理',
      '识别规则设置',
    ]);
  });

  it('uses dynamic document titles on detail pages', () => {
    expect(
      titles('/sales-orders/74fdead6-19fe-4987-afd6-513e8c33536d', {
        dynamicTitle: '订单 SO202604090029',
      })
    ).toEqual(['首页', '销售订单', '订单 SO202604090029']);
  });

  it('does not expose non-uuid business numbers as raw breadcrumb text', () => {
    expect(titles('/inventory/inbound/IN202604090001')).toEqual([
      '首页',
      '库存管理',
      '入库记录',
      '入库详情',
    ]);
    expect(titles('/inventory/batch/BATCH-2026-001/history')).toEqual([
      '首页',
      '库存管理',
      '批次管理',
      '批次详情',
      '变动历史',
    ]);
  });

  it('builds edit and nested child titles from the parent business module', () => {
    expect(
      titles('/finance/payments-out/74fdead6-19fe-4987-afd6-513e8c33536d/edit')
    ).toEqual(['首页', '财务管理', '付款单', '付款详情', '编辑付款']);

    expect(
      titles(
        '/finance/statements/74fdead6-19fe-4987-afd6-513e8c33536d/transactions'
      )
    ).toEqual(['首页', '财务管理', '往来对账', '对账详情', '流水明细']);
  });

  it('supports compact breadcrumb generation with the same title rules', () => {
    const compactItems = buildBreadcrumbItemsForPath({
      pathname: '/products/74fdead6-19fe-4987-afd6-513e8c33536d/tracking',
      showHome: false,
    }).slice(-2);

    expect(compactItems.map(item => item.title)).toEqual([
      '产品详情',
      '产品流向',
    ]);
  });

  it('keeps factory shipment mode labels consistent with the navigation', () => {
    expect(
      titles('/factory-shipments', { factoryShipmentMode: 'factory' })
    ).toEqual(['首页', '厂家直发']);
    expect(
      titles('/factory-shipments', { factoryShipmentMode: 'customer_direct' })
    ).toEqual(['首页', '客户直发']);
  });
});
