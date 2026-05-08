const { request } = require('./request');

function getCatalogSettings() {
  return request({
    url: '/api/miniprogram/catalog-settings',
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

module.exports = {
  getCatalogSettings,
  updateCatalogSettings,
  updateProductCatalogDisplay,
};
