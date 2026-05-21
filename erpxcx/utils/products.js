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
    requireAuth: true,
  });
}

function getProduct(id) {
  return request({
    url: `/api/products/${encodeURIComponent(id)}?includeInventory=true`,
    miniProgramHeader: false,
    requireAuth: true,
  });
}

function createProduct(data) {
  return request({
    url: '/api/products',
    method: 'POST',
    data,
    requireAuth: true,
  });
}

function updateProduct(id, data) {
  return request({
    url: `/api/products/${encodeURIComponent(id)}`,
    method: 'PUT',
    data,
    requireAuth: true,
  });
}

function updateProductStatus(id, status) {
  return request({
    url: `/api/products/${encodeURIComponent(id)}/status`,
    method: 'PATCH',
    data: { status },
    requireAuth: true,
  });
}

function deleteProduct(id) {
  return request({
    url: `/api/products/${encodeURIComponent(id)}`,
    method: 'DELETE',
    requireAuth: true,
  });
}

async function getCategories(params = {}) {
  const limit = 100;
  const categories = [];
  let page = 1;

  while (page <= 20) {
    const query = buildQuery({
      status: 'active',
      sortBy: 'name',
      sortOrder: 'asc',
      ...params,
      page,
      limit,
    });
    const list = await request({
      url: `/api/categories${query ? `?${query}` : ''}`,
      miniProgramHeader: false,
      requireAuth: true,
    });
    const normalizedList = Array.isArray(list) ? list : [];

    categories.push(...normalizedList);

    if (normalizedList.length < limit) {
      break;
    }

    page += 1;
  }

  return categories;
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
