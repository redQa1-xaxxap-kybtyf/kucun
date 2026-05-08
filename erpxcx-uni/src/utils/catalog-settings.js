import { request } from './request';

export function getCatalogSettings() {
  return request({
    url: '/api/miniprogram/catalog-settings',
  });
}

export function updateCatalogSettings(data) {
  return request({
    url: '/api/miniprogram/catalog-settings',
    method: 'PUT',
    data,
  });
}

export function updateProductCatalogDisplay(productId, display) {
  return request({
    url: '/api/miniprogram/catalog-settings',
    method: 'PATCH',
    data: {
      productId,
      display,
    },
  });
}
