const { request } = require('./request');

function buildQuery(params = {}) {
  return Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== '')
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
}

function getProducts(params = {}) {
  const query = buildQuery({
    page: 1,
    limit: 20,
    includeInventory: true,
    includeStatistics: true,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    ...params,
  });

  return request({
    url: `/api/products${query ? `?${query}` : ''}`,
    miniProgramHeader: false,
  });
}

function getProduct(id) {
  return request({
    url: `/api/products/${encodeURIComponent(id)}?includeInventory=true`,
    miniProgramHeader: false,
  });
}

function createProduct(data) {
  return request({
    url: '/api/products',
    method: 'POST',
    data,
    miniProgramHeader: false,
  });
}

function updateProduct(id, data) {
  return request({
    url: `/api/products/${encodeURIComponent(id)}`,
    method: 'PUT',
    data,
    miniProgramHeader: false,
  });
}

function updateProductStatus(id, status) {
  return request({
    url: `/api/products/${encodeURIComponent(id)}/status`,
    method: 'PATCH',
    data: { status },
    miniProgramHeader: false,
  });
}

function deleteProduct(id) {
  return request({
    url: `/api/products/${encodeURIComponent(id)}`,
    method: 'DELETE',
    miniProgramHeader: false,
  });
}

function getCategories() {
  return request({
    url: '/api/categories?page=1&limit=200&status=active&sortBy=name&sortOrder=asc',
    miniProgramHeader: false,
  });
}

module.exports = {
  createProduct,
  deleteProduct,
  getCategories,
  getProduct,
  getProducts,
  updateProduct,
  updateProductStatus,
};
