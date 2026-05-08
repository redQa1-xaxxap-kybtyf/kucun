const { request } = require('./request');

function buildQuery(params = {}) {
  return Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== '')
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
}

function getCustomers(params = {}) {
  const query = buildQuery({
    page: 1,
    limit: 12,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
    ...params,
  });

  return request({
    url: `/api/customers${query ? `?${query}` : ''}`,
    requireAuth: true,
  });
}

function createSalesOrder(data) {
  return request({
    url: '/api/sales-orders',
    method: 'POST',
    data,
    requireAuth: true,
  });
}

module.exports = {
  createSalesOrder,
  getCustomers,
};
