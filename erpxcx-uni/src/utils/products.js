import { request } from './request';

function buildQuery(params = {}) {
  return Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== '')
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
}

export function getProducts(params = {}) {
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
