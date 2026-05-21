const { request } = require('./request');

function getCatalogSettings() {
  return request({
    url: '/api/miniprogram/catalog-settings',
    requireAuth: true,
  });
}

function updateCatalogSettings(data) {
  return request({
    url: '/api/miniprogram/catalog-settings',
    method: 'PUT',
    data,
    requireAuth: true,
  });
}

function updateProductCatalogDisplay(productId, display) {
  return request({
    url: '/api/miniprogram/catalog-settings',
    method: 'PATCH',
    data: {
      productId,
      display,
    },
    requireAuth: true,
  });
}

function updateProductCatalogDisplays(productIds, display) {
  return request({
    url: '/api/miniprogram/catalog-settings',
    method: 'PATCH',
    data: {
      productIds,
      display,
    },
    requireAuth: true,
  });
}

module.exports = {
  getCatalogSettings,
  updateCatalogSettings,
  updateProductCatalogDisplay,
  updateProductCatalogDisplays,
};
