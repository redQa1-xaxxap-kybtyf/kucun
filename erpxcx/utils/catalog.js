const { request } = require('./request');

function getCatalog(params = {}) {
  const query = Object.keys(params)
    .filter(key => params[key])
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');

  return request({
    url: `/api/miniprogram/catalog${query ? `?${query}` : ''}`,
  });
}

function getProductGroup(id) {
  return request({
    url: `/api/miniprogram/groups/${encodeURIComponent(id)}`,
  });
}

function getProduct(id) {
  return request({
    url: `/api/miniprogram/products/${id}`,
  });
}

module.exports = {
  getCatalog,
  getProductGroup,
  getProduct,
};
