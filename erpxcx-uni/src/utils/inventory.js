import { request } from './request';

function buildQuery(params = {}) {
  return Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== '')
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
}

export function getInventories(params = {}) {
  const query = buildQuery(params);
  return request({
    url: `/api/inventory${query ? `?${query}` : ''}`,
    miniProgramHeader: false,
  });
}
