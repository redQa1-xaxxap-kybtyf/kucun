const { request } = require('./request');

function buildQuery(params = {}) {
  return Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== '')
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
}

function getReceivableOrders(params = {}) {
  const query = buildQuery({
    page: 1,
    limit: 20,
    sortBy: 'orderDate',
    sortOrder: 'desc',
    ...params,
  });

  return request({
    url: `/api/sales-orders${query ? `?${query}` : ''}`,
    requireAuth: true,
  });
}

function createPayment(data) {
  return request({
    url: '/api/payments',
    method: 'POST',
    data,
    requireAuth: true,
  });
}

module.exports = {
  createPayment,
  getReceivableOrders,
};
