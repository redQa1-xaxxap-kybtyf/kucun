import { request } from './request';

function buildQuery(params = {}) {
  return Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== '')
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
}

export function getCatalog(params = {}) {
  const query = buildQuery(params);
  return request({
    url: `/api/miniprogram/catalog${query ? `?${query}` : ''}`,
  });
}

export function getProductGroup(id) {
  return request({
    url: `/api/miniprogram/groups/${encodeURIComponent(id)}`,
  });
}

export function getProduct(id) {
  return request({
    url: `/api/miniprogram/products/${encodeURIComponent(id)}`,
  });
}
