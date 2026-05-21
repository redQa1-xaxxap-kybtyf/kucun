const { request } = require('./request');
const {
  readCatalogResponseCache,
  writeCatalogResponseCache,
} = require('./catalog-cache');

const catalogRefreshInFlight = Object.create(null);

function buildQuery(params = {}) {
  const query = Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');

  return query ? `?${query}` : '';
}

function buildCacheKey(scope, id, params = {}) {
  const entries = Object.keys(params)
    .filter(
      key =>
        key !== '_t' &&
        params[key] !== undefined &&
        params[key] !== null &&
        params[key] !== ''
    )
    .sort()
    .map(key => `${key}=${String(params[key])}`)
    .join('&');

  return [scope, id || '', entries].join('|');
}

function shouldSkipResponseCache(params = {}) {
  return params._t !== undefined && params._t !== null && params._t !== '';
}

async function requestWithCatalogCache(scope, id, url, params = {}) {
  const skipCache = shouldSkipResponseCache(params);
  const cacheKey = buildCacheKey(scope, id, params);

  if (!skipCache) {
    const cached = readCatalogResponseCache(cacheKey);
    if (cached) {
      refreshCatalogResponseCache(cacheKey, url);
      return cached;
    }
  }

  const data = await request({ url });
  if (!skipCache) {
    writeCatalogResponseCache(cacheKey, data);
  }
  return data;
}

function refreshCatalogResponseCache(cacheKey, url) {
  if (catalogRefreshInFlight[cacheKey]) {
    return;
  }

  catalogRefreshInFlight[cacheKey] = true;
  request({ url, retry: 0 })
    .then(data => {
      writeCatalogResponseCache(cacheKey, data);
    })
    .catch(() => {
      // 命中本地缓存时后台刷新失败不打扰用户当前浏览。
    })
    .then(() => {
      delete catalogRefreshInFlight[cacheKey];
    });
}

function getCatalog(params = {}) {
  return requestWithCatalogCache(
    'catalog',
    '',
    `/api/miniprogram/catalog${buildQuery(params)}`,
    params
  );
}

function getProductGroup(id, params = {}) {
  return requestWithCatalogCache(
    'group',
    id,
    `/api/miniprogram/groups/${encodeURIComponent(id)}${buildQuery(params)}`,
    params
  );
}

function getProduct(id, params = {}) {
  return requestWithCatalogCache(
    'product',
    id,
    `/api/miniprogram/products/${encodeURIComponent(id)}${buildQuery(params)}`,
    params
  );
}

module.exports = {
  getCatalog,
  getProductGroup,
  getProduct,
};
