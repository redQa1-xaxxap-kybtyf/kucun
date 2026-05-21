const CATALOG_DIRTY_KEY = 'mini_catalog_dirty_at';
const CATALOG_DIRTY_TTL_MS = 10 * 60 * 1000;
const CATALOG_RESPONSE_CACHE_VERSION = 'v1';
const CATALOG_RESPONSE_CACHE_PREFIX = 'mini_catalog_response_cache:';
const CATALOG_RESPONSE_CACHE_INDEX_KEY = 'mini_catalog_response_cache_keys';
const CATALOG_RESPONSE_CACHE_TTL_MS = 2 * 60 * 1000;
const CATALOG_RESPONSE_CACHE_MAX_ENTRIES = 24;

function getCatalogResponseStorageKey(key) {
  return `${CATALOG_RESPONSE_CACHE_PREFIX}${encodeURIComponent(key)}`;
}

function getCatalogResponseCacheKeys() {
  try {
    const keys = wx.getStorageSync(CATALOG_RESPONSE_CACHE_INDEX_KEY);
    return Array.isArray(keys) ? keys.filter(Boolean) : [];
  } catch (_error) {
    return [];
  }
}

function saveCatalogResponseCacheKeys(keys) {
  try {
    wx.setStorageSync(
      CATALOG_RESPONSE_CACHE_INDEX_KEY,
      keys.slice(0, CATALOG_RESPONSE_CACHE_MAX_ENTRIES)
    );
  } catch (_error) {
    // 缓存索引失败不影响正常接口读取。
  }
}

function removeCatalogResponseCache(key) {
  try {
    wx.removeStorageSync(getCatalogResponseStorageKey(key));
  } catch (_error) {
    // 单条缓存删除失败时交给后续 TTL 自然失效。
  }
}

function clearCatalogResponseCache() {
  const keys = getCatalogResponseCacheKeys();
  keys.forEach(removeCatalogResponseCache);

  try {
    wx.removeStorageSync(CATALOG_RESPONSE_CACHE_INDEX_KEY);
  } catch (_error) {
    // 本地缓存清理失败不影响服务端保存结果。
  }
}

function getCatalogDirtyAt() {
  try {
    const dirtyAt = Number(wx.getStorageSync(CATALOG_DIRTY_KEY) || 0) || 0;
    if (!dirtyAt) return 0;

    if (Date.now() - dirtyAt > CATALOG_DIRTY_TTL_MS) {
      wx.removeStorageSync(CATALOG_DIRTY_KEY);
      return 0;
    }

    return dirtyAt;
  } catch (_error) {
    return 0;
  }
}

function markCatalogDirty() {
  try {
    wx.setStorageSync(CATALOG_DIRTY_KEY, Date.now());
    clearCatalogResponseCache();
  } catch (_error) {
    // 本地脏标记只影响小程序端主动刷新，服务端保存结果不依赖它。
  }
}

function shouldRefreshCatalog(page) {
  const dirtyAt = getCatalogDirtyAt();
  if (!dirtyAt) return false;

  if (page && page.handledCatalogDirtyAt === dirtyAt) {
    return false;
  }

  if (page) {
    page.handledCatalogDirtyAt = dirtyAt;
  }
  return true;
}

function withCatalogCacheBuster(params = {}, enabled = false) {
  if (!enabled) return params;

  return {
    ...params,
    _t: Date.now(),
  };
}

function readCatalogResponseCache(key) {
  try {
    const cacheKey = getCatalogResponseStorageKey(key);
    const cached = wx.getStorageSync(cacheKey);
    if (!cached || cached.version !== CATALOG_RESPONSE_CACHE_VERSION) {
      return null;
    }

    const cachedAt = Number(cached.cachedAt || 0) || 0;
    if (!cachedAt || Date.now() - cachedAt > CATALOG_RESPONSE_CACHE_TTL_MS) {
      wx.removeStorageSync(cacheKey);
      return null;
    }

    const dirtyAt = getCatalogDirtyAt();
    if (dirtyAt && cachedAt < dirtyAt) {
      wx.removeStorageSync(cacheKey);
      return null;
    }

    return cached.data || null;
  } catch (_error) {
    return null;
  }
}

function writeCatalogResponseCache(key, data) {
  if (!key || data === undefined || data === null) return;

  try {
    const cacheKey = getCatalogResponseStorageKey(key);
    wx.setStorageSync(cacheKey, {
      version: CATALOG_RESPONSE_CACHE_VERSION,
      cachedAt: Date.now(),
      data,
    });

    const keys = getCatalogResponseCacheKeys().filter(item => item !== key);
    keys.unshift(key);
    const overflow = keys.slice(CATALOG_RESPONSE_CACHE_MAX_ENTRIES);
    overflow.forEach(removeCatalogResponseCache);
    saveCatalogResponseCacheKeys(keys);
  } catch (_error) {
    // Storage 容量不足时跳过缓存，接口结果已经返回给页面。
  }
}

module.exports = {
  CATALOG_RESPONSE_CACHE_TTL_MS,
  CATALOG_DIRTY_KEY,
  clearCatalogResponseCache,
  getCatalogDirtyAt,
  markCatalogDirty,
  readCatalogResponseCache,
  shouldRefreshCatalog,
  withCatalogCacheBuster,
  writeCatalogResponseCache,
};
