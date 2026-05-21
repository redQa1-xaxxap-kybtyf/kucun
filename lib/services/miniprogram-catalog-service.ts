import type { Prisma } from '@prisma/client';
import { encode } from 'next-auth/jwt';

import { computeStockStatusFromInventoryLike } from '@/lib/api/mini-program-sanitize';
import { PRODUCT_UNIT_LABELS } from '@/lib/config/product';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import {
  dedupeImageUrls,
  dedupeProductImages,
} from '@/lib/utils/product-image-dedupe';
import { parseProductImages } from '@/lib/utils/product-transforms';

const PRODUCT_SELECT = {
  id: true,
  code: true,
  name: true,
  specification: true,
  unit: true,
  piecesPerUnit: true,
  weight: true,
  description: true,
  thumbnailUrl: true,
  images: true,
  status: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      code: true,
      parent: {
        select: {
          id: true,
          name: true,
          code: true,
          parent: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
    },
  },
  variants: {
    where: { status: 'active' },
    select: {
      colorCode: true,
      colorName: true,
      colorValue: true,
    },
  },
  inventory: {
    select: {
      quantity: true,
      reservedQuantity: true,
    },
  },
} as const;

const TEMPORARY_PRODUCT_SELECT = {
  id: true,
  code: true,
  name: true,
  specification: true,
  weight: true,
  unit: true,
  piecesPerUnit: true,
  description: true,
  thumbnailUrl: true,
  images: true,
  showInMiniProgram: true,
  usageCount: true,
  lastUsedAt: true,
  updatedAt: true,
  supplier: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
} as const;

type CatalogProductRecord = Prisma.ProductGetPayload<{
  select: typeof PRODUCT_SELECT;
}>;

type ExternalCatalogProductRecord = Prisma.TemporaryProductGetPayload<{
  select: typeof TEMPORARY_PRODUCT_SELECT;
}>;

// 产品级的"装箱数"和"重量"在新业务里只用于兼容旧数据,真实值按批次维护在
// BatchSpecification 表中。小程序展示和报货时没有批次概念,因此用代表性批次的
// piecesPerUnit / weight 给产品级字段做展示兜底,客户才能看到"1件=N片"。
type ProductBatchFallback = {
  piecesPerUnit: number | null;
  weight: number | null;
};

type PublicMiniProgramProduct = {
  id: string;
  source: 'own' | 'external';
  sourceLabel: string;
  code: string;
  name: string;
  specification: string | null;
  unit: string;
  unitLabel: string;
  piecesPerUnit: number | null;
  weightKgPerUnit: number | null;
  packageText: string;
  weightText: string;
  shareTitle: string;
  description: string | null;
  stockLabel: string;
  thumbnailUrl: string | null;
  imageUrls: string[];
  mainImageUrls: string[];
  effectImageUrls: string[];
  imageCount: number;
  category: {
    id: string;
    name: string;
    code: string;
    fullPath: string;
  } | null;
  colorSeries: {
    id: string;
    name: string;
  };
  componentType: {
    id: MiniProgramComponentType;
    label: string;
  };
  displayGroupName: string;
  displayGroupOrder: number | null;
  updatedAt: string;
};

export type MiniProgramVisibleOwnProductSnapshot = Pick<
  PublicMiniProgramProduct,
  'id' | 'code' | 'name' | 'specification' | 'unit' | 'thumbnailUrl'
>;

type CatalogItem = {
  publicProduct: PublicMiniProgramProduct;
  searchText: string;
  hasStock: boolean;
};

type MiniProgramGroupSampleProduct = Pick<
  PublicMiniProgramProduct,
  'id' | 'code' | 'name' | 'specification' | 'thumbnailUrl'
>;

export type MiniProgramComponentType = string;

type ColorSeriesConfig = {
  id: string;
  name: string;
  keywords: string[];
};

type ComponentTypeConfig = {
  id: MiniProgramComponentType;
  label: string;
  keywords: string[];
};

export type MiniProgramColorSeriesSetting = ColorSeriesConfig & {
  builtIn: boolean;
  canDelete: boolean;
  coverUrl: string | null;
  sortOrder: number;
  visible: boolean;
};

export type MiniProgramComponentTypeSetting = ComponentTypeConfig & {
  builtIn: boolean;
  canDelete: boolean;
  coverUrl: string | null;
  sortOrder: number;
  visible: boolean;
};

export type MiniProgramProductDisplayOverride = {
  visible?: boolean;
  seriesId?: string;
  componentType?: MiniProgramComponentType;
  sortOrder?: number;
  displayGroupName?: string;
  displayGroupOrder?: number;
};

export type MiniProgramCatalogSettings = {
  colorSeries: MiniProgramColorSeriesSetting[];
  componentTypes: MiniProgramComponentTypeSetting[];
  productOverrides: Record<string, MiniProgramProductDisplayOverride>;
  note: string;
};

type StoredMiniProgramCatalogSettings = {
  colorSeries?: Array<
    Partial<Omit<MiniProgramColorSeriesSetting, 'id'>> & { id: string }
  >;
  componentTypes?: Array<
    Partial<Omit<MiniProgramComponentTypeSetting, 'id'>> & { id: string }
  >;
  productOverrides?: Record<string, MiniProgramProductDisplayOverride>;
};

// 小程序展示分类独立于 ERP 产品分类。ERP 负责产品资料与库存，
// 这里只负责客户打开小程序后看到的花色和品种入口。
const COLOR_SERIES: ColorSeriesConfig[] = [
  { id: 'yashi-white', name: '雅士白', keywords: ['雅士白', '亚士白'] },
  { id: 'jazz-white', name: '爵士白', keywords: ['爵士白'] },
  { id: 'fishbelly-white', name: '鱼肚白', keywords: ['鱼肚白'] },
  { id: 'snow-white', name: '雪花白', keywords: ['雪花白'] },
  { id: 'cream-yellow', name: '米黄', keywords: ['米黄', '米黄色'] },
  { id: 'gold-yellow', name: '金黄', keywords: ['金黄', '黄金', '黄锈'] },
  { id: 'stone-gray', name: '灰色', keywords: ['灰色', '灰', '深灰'] },
  { id: 'coffee', name: '咖啡', keywords: ['咖啡', '啡', '咖色'] },
  { id: 'red-brown', name: '红棕', keywords: ['红棕', '红色', '棕色'] },
  { id: 'blue-stone', name: '青石', keywords: ['青石', '青色', '青灰'] },
  { id: 'other', name: '其他花色', keywords: [] },
];

const COMPONENT_TYPES: ComponentTypeConfig[] = [
  {
    id: 'roman_column',
    label: '罗马柱',
    keywords: ['罗马柱', '柱头', '柱身', '柱脚', '柱子'],
  },
  {
    id: 'corner_stone',
    label: '转角石',
    keywords: ['转角石', '转角', '阳角', '阴角', '护角'],
  },
  { id: 'line', label: '线条', keywords: ['线条', '腰线', '横线', '压顶'] },
  {
    id: 'facade_tile',
    label: '外墙砖',
    keywords: ['外墙砖', '外墙', '墙砖', '瓷砖'],
  },
  {
    id: 'matching',
    label: '配套',
    keywords: ['配套', '窗套', '门套', '收口', '配件'],
  },
  { id: 'other', label: '其他品种', keywords: [] },
];

const HOT_SERIES = {
  id: 'hot',
  name: '全部',
};

const CATALOG_SETTINGS_KEY = 'miniProgramCatalogSettings';
const CATALOG_SETTINGS_CATEGORY = 'miniprogram';
const CATALOG_SETTINGS_NOTE =
  '小程序展示分类只决定客户前台怎么找货，不改变 ERP 原始产品分类和库存数据。';
const CATALOG_SETTINGS_CACHE_TTL = 30 * 1000;
const CATALOG_ITEMS_CACHE_TTL = 30 * 1000;
const LOCAL_UPLOAD_ACCESS_URL_CACHE_TTL = 55 * 60 * 1000;
const LOCAL_UPLOAD_ACCESS_URL_CACHE_MAX_ENTRIES = 2000;
const MINI_PROGRAM_DEFAULT_PAGE_SIZE = 24;
const MINI_PROGRAM_MAX_PAGE_SIZE = 60;

type MiniProgramImageUrlOptions = {
  publicBaseOrigin?: string | null;
  accessUrlCache?: Map<string, string>;
  forceFresh?: boolean;
};

type MiniProgramPaginationParams = {
  page?: number | string | null;
  pageSize?: number | string | null;
};

type MiniProgramProductListParams = MiniProgramPaginationParams & {
  search?: string | null;
  includeProducts?: boolean | string | null;
};

let catalogItemsCache: {
  key: string;
  expiresAt: number;
  items: CatalogItem[];
} | null = null;
let catalogItemsInFlight: {
  key: string;
  promise: Promise<CatalogItem[]>;
} | null = null;
let catalogSettingsCache: {
  expiresAt: number;
  settings: MiniProgramCatalogSettings;
} | null = null;
let catalogSettingsInFlight: Promise<MiniProgramCatalogSettings> | null = null;

const localUploadAccessUrlCache = new Map<
  string,
  {
    url: string;
    expiresAt: number;
  }
>();

function clearMiniProgramCatalogRuntimeCache() {
  catalogItemsCache = null;
  catalogItemsInFlight = null;
  catalogSettingsCache = null;
  catalogSettingsInFlight = null;
}

export function invalidateMiniProgramCatalogCache() {
  clearMiniProgramCatalogRuntimeCache();
}

function normalizePublicBaseOrigin(origin?: string | null) {
  return (origin || process.env.NEXTAUTH_URL || '').replace(/\/+$/, '');
}

function buildCatalogItemsCacheKey(settings: MiniProgramCatalogSettings) {
  return JSON.stringify({
    colorSeries: settings.colorSeries.map(item => ({
      id: item.id,
      keywords: item.keywords,
      visible: item.visible,
    })),
    componentTypes: settings.componentTypes.map(item => ({
      id: item.id,
      keywords: item.keywords,
      visible: item.visible,
    })),
    productOverrides: settings.productOverrides,
  });
}

function resolveImageUrl(rawUrl: string, options: MiniProgramImageUrlOptions) {
  const trimmed = rawUrl.trim();
  const publicBaseOrigin = normalizePublicBaseOrigin(options.publicBaseOrigin);

  if (!trimmed) return null;

  if (trimmed.startsWith('/')) {
    if (!publicBaseOrigin) return null;
    return new URL(trimmed, publicBaseOrigin);
  }

  try {
    return new URL(trimmed);
  } catch (_error) {
    return null;
  }
}

async function createLocalUploadAccessUrl(
  type: string,
  file: string,
  origin: string
) {
  const accessToken = await encode({
    token: {
      id: 'mini-program-image',
      username: '',
      role: '',
      status: '',
      path: `${type}/${file}`,
    },
    secret: env.NEXTAUTH_SECRET,
    salt: 'uploads',
    maxAge: 60 * 60,
  });

  return `${origin}/api/uploads/${encodeURIComponent(type)}/${encodeURIComponent(
    file
  )}?t=${encodeURIComponent(accessToken)}`;
}

function getCachedLocalUploadAccessUrl(cacheKey: string) {
  const cached = localUploadAccessUrlCache.get(cacheKey);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    localUploadAccessUrlCache.delete(cacheKey);
    return null;
  }

  return cached.url;
}

function setCachedLocalUploadAccessUrl(cacheKey: string, url: string) {
  const now = Date.now();
  localUploadAccessUrlCache.set(cacheKey, {
    url,
    expiresAt: now + LOCAL_UPLOAD_ACCESS_URL_CACHE_TTL,
  });

  if (
    localUploadAccessUrlCache.size <= LOCAL_UPLOAD_ACCESS_URL_CACHE_MAX_ENTRIES
  )
    return;

  for (const [key, value] of localUploadAccessUrlCache.entries()) {
    if (
      value.expiresAt <= now ||
      localUploadAccessUrlCache.size > LOCAL_UPLOAD_ACCESS_URL_CACHE_MAX_ENTRIES
    ) {
      localUploadAccessUrlCache.delete(key);
    }
    if (
      localUploadAccessUrlCache.size <=
      LOCAL_UPLOAD_ACCESS_URL_CACHE_MAX_ENTRIES
    )
      break;
  }
}

async function prepareMiniProgramImageUrl(
  rawUrl: string,
  options: MiniProgramImageUrlOptions
) {
  const trimmed = rawUrl.trim();
  const resolvedUrl = resolveImageUrl(trimmed, options);

  if (!resolvedUrl) {
    return trimmed;
  }

  const uploadPathMatch = resolvedUrl.pathname.match(
    /^\/api\/uploads\/([^/]+)\/([^/]+)$/
  );

  if (!uploadPathMatch) {
    return trimmed.startsWith('/') ? resolvedUrl.toString() : trimmed;
  }

  const cacheKey = resolvedUrl.toString();
  const cached = options.accessUrlCache?.get(cacheKey);
  if (cached) return cached;

  const sharedCached = getCachedLocalUploadAccessUrl(cacheKey);
  if (sharedCached) {
    options.accessUrlCache?.set(cacheKey, sharedCached);
    return sharedCached;
  }

  try {
    const type = decodeURIComponent(uploadPathMatch[1]);
    const file = decodeURIComponent(uploadPathMatch[2]);
    const accessUrl = await createLocalUploadAccessUrl(
      type,
      file,
      resolvedUrl.origin
    );
    options.accessUrlCache?.set(cacheKey, accessUrl);
    setCachedLocalUploadAccessUrl(cacheKey, accessUrl);
    return accessUrl;
  } catch (_error) {
    return trimmed.startsWith('/') ? resolvedUrl.toString() : trimmed;
  }
}

async function prepareMiniProgramImageUrls<T>(
  payload: T,
  options: MiniProgramImageUrlOptions
): Promise<T> {
  if (!payload || typeof payload !== 'object') return payload;

  const nextOptions = options.accessUrlCache
    ? options
    : { ...options, accessUrlCache: new Map<string, string>() };

  if (Array.isArray(payload)) {
    return Promise.all(
      payload.map(item => prepareMiniProgramImageUrls(item, nextOptions))
    ) as Promise<T>;
  }

  const entries = await Promise.all(
    Object.entries(payload as Record<string, unknown>).map(
      async ([key, value]) => {
        if (
          (key === 'thumbnailUrl' || key === 'coverUrl') &&
          typeof value === 'string'
        ) {
          return [key, await prepareMiniProgramImageUrl(value, nextOptions)];
        }

        if (
          (key === 'imageUrls' ||
            key === 'mainImageUrls' ||
            key === 'effectImageUrls') &&
          Array.isArray(value)
        ) {
          return [
            key,
            await Promise.all(
              value.map(item =>
                typeof item === 'string'
                  ? prepareMiniProgramImageUrl(item, nextOptions)
                  : item
              )
            ),
          ];
        }

        return [key, await prepareMiniProgramImageUrls(value, nextOptions)];
      }
    )
  );

  return Object.fromEntries(entries) as T;
}

function normalizeCatalogId(value: unknown, fallback: string) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return fallback;
  const normalized = raw
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return normalized || fallback;
}

function normalizeKeywords(value: unknown, fallback: string[]) {
  if (Array.isArray(value)) {
    const keywords = value
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .slice(0, 12);
    if (keywords.length > 0) return keywords;
  }

  return fallback;
}

function sortByCatalogOrder<T extends { sortOrder: number; id: string }>(
  items: T[]
) {
  return [...items].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id.localeCompare(b.id);
  });
}

function uniqueByCatalogId<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function getDefaultMiniProgramCatalogSettings(): MiniProgramCatalogSettings {
  return {
    colorSeries: COLOR_SERIES.map((item, index) => ({
      ...item,
      builtIn: true,
      canDelete: false,
      coverUrl: null,
      sortOrder: index + 1,
      visible: true,
    })),
    componentTypes: COMPONENT_TYPES.map((item, index) => ({
      ...item,
      builtIn: true,
      canDelete: false,
      coverUrl: null,
      sortOrder: index + 1,
      visible: true,
    })),
    productOverrides: {},
    note: CATALOG_SETTINGS_NOTE,
  };
}

function normalizeNullableUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeBooleanLike(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
  return fallback;
}

function normalizePositiveInteger(value: unknown, fallback: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return fallback;
  return Math.floor(numericValue);
}

function normalizeMiniProgramPagination(params: MiniProgramPaginationParams) {
  const page = normalizePositiveInteger(params.page, 1);
  const requestedPageSize = normalizePositiveInteger(
    params.pageSize,
    MINI_PROGRAM_DEFAULT_PAGE_SIZE
  );
  const pageSize = Math.min(requestedPageSize, MINI_PROGRAM_MAX_PAGE_SIZE);

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

function paginateMiniProgramItems<T>(
  items: T[],
  params: MiniProgramPaginationParams
) {
  const { page, pageSize, offset } = normalizeMiniProgramPagination(params);
  const total = items.length;
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

  return {
    items: items.slice(offset, offset + pageSize),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

function normalizeSortOrder(value: unknown, fallback: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(1, Math.round(numericValue));
}

function normalizeDisplayGroupName(value: unknown) {
  return String(value || '').trim().slice(0, 40);
}

function normalizeDisplayGroupOrder(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
  return Math.max(1, Math.min(99, Math.round(numericValue)));
}

function normalizeColorSeriesSetting(
  raw: Partial<MiniProgramColorSeriesSetting> & { id: string },
  fallback: MiniProgramColorSeriesSetting | null,
  index: number
): MiniProgramColorSeriesSetting | null {
  const builtIn = Boolean(fallback?.builtIn);
  const id =
    fallback && builtIn
      ? fallback.id
      : normalizeCatalogId(raw.id, `custom-series-${index + 1}`);
  const fallbackName = fallback?.name || '自定义花色';
  const name =
    typeof raw.name === 'string' && raw.name.trim()
      ? raw.name.trim()
      : fallbackName;

  if (!id || !name) return null;

  return {
    id,
    name,
    keywords: normalizeKeywords(raw.keywords, fallback?.keywords || [name]),
    builtIn,
    canDelete: !builtIn,
    coverUrl: normalizeNullableUrl(raw.coverUrl),
    sortOrder: normalizeSortOrder(
      raw.sortOrder,
      fallback?.sortOrder || index + 1
    ),
    visible: normalizeBoolean(raw.visible, fallback?.visible ?? true),
  };
}

function normalizeComponentTypeSetting(
  raw: Partial<MiniProgramComponentTypeSetting> & { id: string },
  fallback: MiniProgramComponentTypeSetting | null,
  index: number
): MiniProgramComponentTypeSetting | null {
  const builtIn = Boolean(fallback?.builtIn);
  const id =
    fallback && builtIn
      ? fallback.id
      : normalizeCatalogId(raw.id, `custom-component-${index + 1}`);
  const fallbackLabel = fallback?.label || '自定义品种';
  const label =
    typeof raw.label === 'string' && raw.label.trim()
      ? raw.label.trim()
      : fallbackLabel;

  if (!id || !label) return null;

  return {
    id,
    label,
    keywords: normalizeKeywords(raw.keywords, fallback?.keywords || [label]),
    builtIn,
    canDelete: !builtIn,
    coverUrl: normalizeNullableUrl(raw.coverUrl),
    sortOrder: normalizeSortOrder(
      raw.sortOrder,
      fallback?.sortOrder || index + 1
    ),
    visible: normalizeBoolean(raw.visible, fallback?.visible ?? true),
  };
}

function mergeCatalogSettings(
  saved: StoredMiniProgramCatalogSettings | null
): MiniProgramCatalogSettings {
  const defaults = getDefaultMiniProgramCatalogSettings();
  const defaultSeriesMap = new Map(
    defaults.colorSeries.map(item => [item.id, item])
  );
  const defaultComponentMap = new Map(
    defaults.componentTypes.map(item => [item.id, item])
  );
  const savedSeries = new Map(
    (Array.isArray(saved?.colorSeries) ? saved?.colorSeries : []).map(item => [
      item.id,
      item,
    ])
  );
  const savedComponents = new Map(
    (Array.isArray(saved?.componentTypes) ? saved?.componentTypes : []).map(
      item => [item.id, item]
    )
  );

  const colorSeries = sortByCatalogOrder(
    uniqueByCatalogId(
      [
        ...defaults.colorSeries.map((item, index) =>
          normalizeColorSeriesSetting(
            savedSeries.get(item.id) || item,
            item,
            index
          )
        ),
        ...(Array.isArray(saved?.colorSeries) ? saved.colorSeries : []).map(
          (item, index) =>
            defaultSeriesMap.has(item.id)
              ? null
              : normalizeColorSeriesSetting(
                  item,
                  null,
                  defaults.colorSeries.length + index
                )
        ),
      ].filter((item): item is MiniProgramColorSeriesSetting => Boolean(item))
    )
  );

  const componentTypes = sortByCatalogOrder(
    uniqueByCatalogId(
      [
        ...defaults.componentTypes.map((item, index) =>
          normalizeComponentTypeSetting(
            savedComponents.get(item.id) || item,
            item,
            index
          )
        ),
        ...(Array.isArray(saved?.componentTypes)
          ? saved.componentTypes
          : []
        ).map((item, index) =>
          defaultComponentMap.has(item.id)
            ? null
            : normalizeComponentTypeSetting(
                item,
                null,
                defaults.componentTypes.length + index
              )
        ),
      ].filter((item): item is MiniProgramComponentTypeSetting => Boolean(item))
    )
  );

  return {
    colorSeries,
    componentTypes,
    productOverrides:
      saved?.productOverrides && typeof saved.productOverrides === 'object'
        ? normalizeProductOverrides(
            saved.productOverrides,
            new Set(colorSeries.map(item => item.id)),
            new Set(componentTypes.map(item => item.id))
          )
        : {},
    note: CATALOG_SETTINGS_NOTE,
  };
}

function normalizeProductOverrides(
  raw: Record<string, MiniProgramProductDisplayOverride>,
  seriesIds: Set<string>,
  componentIds: Set<string>
) {
  const normalized: Record<string, MiniProgramProductDisplayOverride> = {};

  for (const [productId, value] of Object.entries(raw)) {
    if (!productId || !value || typeof value !== 'object') continue;

    const override: MiniProgramProductDisplayOverride = {};
    if (typeof value.visible === 'boolean') {
      override.visible = value.visible;
    }
    if (value.seriesId && seriesIds.has(value.seriesId)) {
      override.seriesId = value.seriesId;
    }
    if (value.componentType && componentIds.has(value.componentType)) {
      override.componentType = value.componentType;
    }
    if (value.sortOrder !== undefined) {
      override.sortOrder = normalizeSortOrder(value.sortOrder, 1);
    }
    const displayGroupName = normalizeDisplayGroupName(
      value.displayGroupName
    );
    if (displayGroupName) {
      override.displayGroupName = displayGroupName;
    }
    if (value.displayGroupOrder !== undefined) {
      const displayGroupOrder = normalizeDisplayGroupOrder(
        value.displayGroupOrder
      );
      if (displayGroupOrder !== null) {
        override.displayGroupOrder = displayGroupOrder;
      }
    }

    if (Object.keys(override).length > 0) {
      normalized[productId] = override;
    }
  }

  return normalized;
}

async function readStoredCatalogSettings() {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: CATALOG_SETTINGS_KEY },
    select: { value: true },
  });

  if (!setting?.value) return null;

  try {
    return JSON.parse(setting.value) as StoredMiniProgramCatalogSettings;
  } catch {
    return null;
  }
}

async function saveCatalogSettings(settings: MiniProgramCatalogSettings) {
  await prisma.systemSetting.upsert({
    where: { key: CATALOG_SETTINGS_KEY },
    update: {
      value: JSON.stringify(settings),
      dataType: 'json',
      category: CATALOG_SETTINGS_CATEGORY,
      description: '小程序花色、品种和产品展示设置',
      isPublic: false,
    },
    create: {
      key: CATALOG_SETTINGS_KEY,
      value: JSON.stringify(settings),
      category: CATALOG_SETTINGS_CATEGORY,
      dataType: 'json',
      description: '小程序花色、品种和产品展示设置',
      isPublic: false,
    },
  });
}

export async function getMiniProgramCatalogSettings(
  options: { forceFresh?: boolean } = {}
) {
  const now = Date.now();
  if (
    !options.forceFresh &&
    catalogSettingsCache &&
    catalogSettingsCache.expiresAt > now
  ) {
    return catalogSettingsCache.settings;
  }

  if (!options.forceFresh && catalogSettingsInFlight) {
    return catalogSettingsInFlight;
  }

  const promise = readStoredCatalogSettings().then(saved =>
    mergeCatalogSettings(saved)
  );
  catalogSettingsInFlight = promise;

  try {
    const settings = await promise;
    catalogSettingsCache = {
      settings,
      expiresAt: Date.now() + CATALOG_SETTINGS_CACHE_TTL,
    };
    return settings;
  } finally {
    if (catalogSettingsInFlight === promise) {
      catalogSettingsInFlight = null;
    }
  }
}

export async function updateMiniProgramCatalogSettings(
  input: StoredMiniProgramCatalogSettings
) {
  const current = await getMiniProgramCatalogSettings({ forceFresh: true });
  const next = mergeCatalogSettings({
    ...current,
    colorSeries: Array.isArray(input.colorSeries)
      ? input.colorSeries
      : current.colorSeries,
    componentTypes: Array.isArray(input.componentTypes)
      ? input.componentTypes
      : current.componentTypes,
    productOverrides: current.productOverrides,
  });

  await saveCatalogSettings(next);
  clearMiniProgramCatalogRuntimeCache();
  catalogSettingsCache = {
    settings: next,
    expiresAt: Date.now() + CATALOG_SETTINGS_CACHE_TTL,
  };
  return next;
}

export async function updateMiniProgramProductDisplayOverride(
  productId: string,
  override: MiniProgramProductDisplayOverride
) {
  const current = await getMiniProgramCatalogSettings({ forceFresh: true });
  const nextOverrides = normalizeProductOverrides(
    {
      ...current.productOverrides,
      [productId]: override,
    },
    new Set(current.colorSeries.map(item => item.id)),
    new Set(current.componentTypes.map(item => item.id))
  );
  const next = mergeCatalogSettings({
    ...current,
    productOverrides: nextOverrides,
  });

  await saveCatalogSettings(next);
  clearMiniProgramCatalogRuntimeCache();
  catalogSettingsCache = {
    settings: next,
    expiresAt: Date.now() + CATALOG_SETTINGS_CACHE_TTL,
  };
  return next.productOverrides[productId] ?? {};
}

export async function updateMiniProgramProductDisplayOverrides(
  productIds: string[],
  override: MiniProgramProductDisplayOverride
) {
  const ids = Array.from(
    new Set(productIds.map(id => String(id || '').trim()).filter(Boolean))
  );
  if (ids.length === 0) {
    return {
      updatedCount: 0,
      productOverrides: {},
    };
  }

  const current = await getMiniProgramCatalogSettings({ forceFresh: true });
  const nextOverrides = normalizeProductOverrides(
    {
      ...current.productOverrides,
      ...Object.fromEntries(
        ids.map(id => [
          id,
          {
            ...current.productOverrides[id],
            ...override,
          },
        ])
      ),
    },
    new Set(current.colorSeries.map(item => item.id)),
    new Set(current.componentTypes.map(item => item.id))
  );
  const next = mergeCatalogSettings({
    ...current,
    productOverrides: nextOverrides,
  });

  await saveCatalogSettings(next);
  clearMiniProgramCatalogRuntimeCache();
  catalogSettingsCache = {
    settings: next,
    expiresAt: Date.now() + CATALOG_SETTINGS_CACHE_TTL,
  };

  return {
    updatedCount: ids.length,
    productOverrides: Object.fromEntries(
      ids.map(id => [id, next.productOverrides[id] ?? {}])
    ),
  };
}

function normalizeLookupText(value?: string | null) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function buildNameSpecificationKey(input: {
  name?: string | null;
  specification?: string | null;
}) {
  const name = normalizeLookupText(input.name);
  const specification = normalizeLookupText(input.specification);

  if (!name) return '';
  return `${name}__${specification}`;
}

function getCategoryFullPath(category: CatalogProductRecord['category']) {
  if (!category) return '';

  return [category.parent?.parent?.name, category.parent?.name, category.name]
    .filter(Boolean)
    .join(' / ');
}

function buildOwnSearchText(product: CatalogProductRecord) {
  const categoryText = getCategoryFullPath(product.category);
  const variantText = product.variants
    .map(variant =>
      [variant.colorName, variant.colorCode, variant.colorValue]
        .filter(Boolean)
        .join(' ')
    )
    .join(' ');

  return [
    product.code,
    product.name,
    product.specification,
    product.description,
    categoryText,
    variantText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function buildExternalSearchText(product: ExternalCatalogProductRecord) {
  return [
    product.code,
    product.name,
    product.specification,
    '外采',
    '外采款',
    '调货',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function isInternalTestProduct(product: {
  code?: string | null;
  name?: string | null;
}) {
  const text = normalizeLookupText([product.code, product.name].join(' '));
  if (!text) return false;

  return [
    /测试/,
    /回归/,
    /上传产品/,
    /p1-upload/,
    /return-refund/,
    /\be2e[-\s]/,
    /fine2emo/,
    /\bdummy\b/,
    /\bmock\b/,
  ].some(pattern => pattern.test(text));
}

function getSeriesSetting(
  settings: MiniProgramCatalogSettings,
  id?: string | null
) {
  return settings.colorSeries.find(series => series.id === id) ?? null;
}

function getComponentSetting(
  settings: MiniProgramCatalogSettings,
  id?: string | null
) {
  return settings.componentTypes.find(component => component.id === id) ?? null;
}

function resolveColorSeries(
  searchText: string,
  settings: MiniProgramCatalogSettings,
  productId?: string
) {
  const overrideSeries = productId
    ? getSeriesSetting(settings, settings.productOverrides[productId]?.seriesId)
    : null;
  if (overrideSeries) {
    return overrideSeries;
  }

  const text = searchText.toLowerCase();
  const matched = settings.colorSeries.find(
    series =>
      series.id !== 'other' &&
      series.keywords.some(keyword => text.includes(keyword.toLowerCase()))
  );

  return (
    matched ??
    getSeriesSetting(settings, 'other') ??
    settings.colorSeries[0] ??
    getDefaultMiniProgramCatalogSettings().colorSeries[0]
  );
}

function resolveComponentType(
  searchText: string,
  settings: MiniProgramCatalogSettings,
  productId?: string
) {
  const overrideComponent = productId
    ? getComponentSetting(
        settings,
        settings.productOverrides[productId]?.componentType
      )
    : null;
  if (overrideComponent) {
    return overrideComponent;
  }

  const text = searchText.toLowerCase();
  const matched = settings.componentTypes.find(
    component =>
      component.id !== 'other' &&
      component.keywords.some(keyword => text.includes(keyword.toLowerCase()))
  );

  return (
    matched ??
    getComponentSetting(settings, 'other') ??
    settings.componentTypes[0] ??
    getDefaultMiniProgramCatalogSettings().componentTypes[0]
  );
}

function isOwnProductDisplayableInMiniProgram(
  product: CatalogProductRecord,
  settings: MiniProgramCatalogSettings
) {
  const override = settings.productOverrides[product.id];
  if (override?.visible === false) return false;

  return !isInternalTestProduct(product);
}

function isProductTaxonomyVisible(
  product: PublicMiniProgramProduct,
  settings: MiniProgramCatalogSettings
) {
  const series = getSeriesSetting(settings, product.colorSeries.id);
  const component = getComponentSetting(settings, product.componentType.id);

  return Boolean(series?.visible && component?.visible);
}

function getProductImages(product: { id: string; images: string | null }) {
  return dedupeProductImages(parseProductImages(product.images, product.id));
}

function getProductImageUrls(product: {
  id: string;
  images: string | null;
  thumbnailUrl: string | null;
}) {
  const imageUrls = getProductImages(product).map(image => image.url);

  return dedupeImageUrls([product.thumbnailUrl, ...imageUrls]);
}

function getTypedProductImageUrls(
  images: ReturnType<typeof getProductImages>,
  type: 'main' | 'effect',
  excludedUrls: Array<string | null | undefined>
) {
  return dedupeImageUrls(
    images.filter(image => image.type === type).map(image => image.url),
    excludedUrls
  );
}

function getProductStockStatus(product: CatalogProductRecord) {
  const totalQuantity = product.inventory.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
  const reservedQuantity = product.inventory.reduce(
    (sum, item) => sum + item.reservedQuantity,
    0
  );

  return computeStockStatusFromInventoryLike({
    totalQuantity,
    reservedQuantity,
  });
}

function getProductStockLabel(product: CatalogProductRecord) {
  return getProductStockStatus(product) === 'out_of_stock'
    ? '暂缺'
    : '仓库现货';
}

function formatNumberText(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.?0+$/, '');
}

function getUnitLabel(unit: string) {
  return PRODUCT_UNIT_LABELS[unit as keyof typeof PRODUCT_UNIT_LABELS] ?? unit;
}

function getProductWeightKg(product: {
  weight?: Prisma.Decimal | number | null;
}) {
  const weight = product.weight === null ? null : Number(product.weight);
  if (!weight || !Number.isFinite(weight) || weight <= 0) return null;

  return weight;
}

function getProductPackageText(product: { piecesPerUnit?: number | null }) {
  if (typeof product.piecesPerUnit === 'number' && product.piecesPerUnit > 1) {
    return `1件=${product.piecesPerUnit}片`;
  }

  return '';
}

function getProductWeightText(product: {
  weight?: Prisma.Decimal | number | null;
  unit: string;
  piecesPerUnit?: number | null;
}) {
  const weight = getProductWeightKg(product);
  if (!weight) return '';

  const unitLabel =
    typeof product.piecesPerUnit === 'number' && product.piecesPerUnit > 1
      ? '件'
      : getUnitLabel(product.unit);

  return `${formatNumberText(weight)}kg/${unitLabel}`;
}

function buildProductShareTitle(input: {
  code: string;
  name: string;
  specification?: string | null;
  packageText?: string;
  weightText?: string;
}) {
  return [
    input.code,
    input.name,
    input.specification,
    input.packageText,
    input.weightText,
  ]
    .filter(Boolean)
    .join('｜');
}

function toPublicOwnProduct(
  product: CatalogProductRecord,
  settings: MiniProgramCatalogSettings,
  batchFallback: ProductBatchFallback | null = null
) {
  const searchText = buildOwnSearchText(product);
  const override = settings.productOverrides[product.id] || {};
  const series = resolveColorSeries(searchText, settings, product.id);
  const component = resolveComponentType(searchText, settings, product.id);
  const productImages = getProductImages(product);
  const imageUrls = getProductImageUrls(product);
  const thumbnailUrl = imageUrls[0] ?? null;
  const mainImageUrls = getTypedProductImageUrls(productImages, 'main', [
    thumbnailUrl,
  ]);
  const effectImageUrls = getTypedProductImageUrls(productImages, 'effect', [
    thumbnailUrl,
    ...mainImageUrls,
  ]);

  // 小程序自有产品的包装和重量以入库批次规格为准,避免产品主档与实际批次混用。
  const piecesPerUnit = batchFallback?.piecesPerUnit ?? null;
  const weightKgPerUnit = batchFallback?.weight ?? null;

  // 用批次规格值再算 packageText / weightText,避免下游"数量"与"重量"漏显。
  const enrichedProduct = {
    ...product,
    piecesPerUnit,
    weight: weightKgPerUnit,
  };
  const packageText = getProductPackageText(enrichedProduct);
  const weightText = getProductWeightText(enrichedProduct);
  const unitLabel = getUnitLabel(product.unit);

  return {
    id: product.id,
    source: 'own' as const,
    sourceLabel: '本厂款',
    code: product.code,
    name: product.name,
    specification: product.specification,
    unit: product.unit,
    unitLabel,
    piecesPerUnit,
    weightKgPerUnit,
    packageText,
    weightText,
    shareTitle: buildProductShareTitle({
      code: product.code,
      name: product.name,
      specification: product.specification,
      packageText,
      weightText,
    }),
    description: product.description,
    stockLabel: getProductStockLabel(product),
    thumbnailUrl,
    imageUrls,
    mainImageUrls,
    effectImageUrls,
    imageCount: imageUrls.length,
    category: product.category
      ? {
          id: product.category.id,
          name: product.category.name,
          code: product.category.code,
          fullPath: getCategoryFullPath(product.category),
        }
      : null,
    colorSeries: {
      id: series.id,
      name: series.name,
    },
    componentType: {
      id: component.id,
      label: component.label,
    },
    displayGroupName: normalizeDisplayGroupName(override.displayGroupName),
    displayGroupOrder: normalizeDisplayGroupOrder(
      override.displayGroupOrder
    ),
    updatedAt: product.updatedAt.toISOString(),
  };
}

function toPublicExternalProduct(
  product: ExternalCatalogProductRecord,
  settings: MiniProgramCatalogSettings
) {
  const searchText = buildExternalSearchText(product);
  const override = settings.productOverrides[product.id] || {};
  const series = resolveColorSeries(searchText, settings, product.id);
  const component = resolveComponentType(searchText, settings, product.id);
  const packageText = getProductPackageText(product);
  const weightText = getProductWeightText(product);
  const productImages = getProductImages(product);
  const imageUrls = getProductImageUrls(product);
  const thumbnailUrl = imageUrls[0] ?? null;
  const mainImageUrls = getTypedProductImageUrls(productImages, 'main', [
    thumbnailUrl,
  ]);
  const effectImageUrls = getTypedProductImageUrls(productImages, 'effect', [
    thumbnailUrl,
    ...mainImageUrls,
  ]);
  const unitLabel = getUnitLabel(product.unit);
  const piecesPerUnit =
    typeof product.piecesPerUnit === 'number' && product.piecesPerUnit > 0
      ? product.piecesPerUnit
      : null;

  return {
    id: product.id,
    source: 'external' as const,
    sourceLabel: '外采款',
    code: product.code,
    name: product.name,
    specification: product.specification,
    unit: product.unit,
    unitLabel,
    piecesPerUnit,
    weightKgPerUnit: getProductWeightKg(product),
    packageText,
    weightText,
    shareTitle: buildProductShareTitle({
      code: product.code,
      name: product.name,
      specification: product.specification,
      packageText,
      weightText,
    }),
    description: product.description,
    stockLabel: product.showInMiniProgram ? '可调货' : '暂缺',
    thumbnailUrl,
    imageUrls,
    mainImageUrls,
    effectImageUrls,
    imageCount: imageUrls.length,
    category: null,
    colorSeries: {
      id: series.id,
      name: series.name,
    },
    componentType: {
      id: component.id,
      label: component.label,
    },
    displayGroupName: normalizeDisplayGroupName(override.displayGroupName),
    displayGroupOrder: normalizeDisplayGroupOrder(
      override.displayGroupOrder
    ),
    updatedAt: product.updatedAt.toISOString(),
  };
}

function buildGroupTitle(input: {
  colorSeries: { id: string; name: string };
  componentType: { id: MiniProgramComponentType; label: string };
}) {
  const isOtherSeries = input.colorSeries.id === 'other';
  const isOtherComponent = input.componentType.id === 'other';

  if (isOtherSeries && isOtherComponent) return '其他品种';
  if (isOtherSeries) return input.componentType.label;
  if (isOtherComponent) return `${input.colorSeries.name}系列`;
  return `${input.colorSeries.name}${input.componentType.label}`;
}

function toGroupSampleProducts(
  products: PublicMiniProgramProduct[]
): MiniProgramGroupSampleProduct[] {
  return products.map(product => ({
    id: product.id,
    code: product.code,
    name: product.name,
    specification: product.specification,
    thumbnailUrl: product.thumbnailUrl,
  }));
}

function toProductListItem(product: PublicMiniProgramProduct) {
  return {
    id: product.id,
    source: product.source,
    sourceLabel: product.sourceLabel,
    code: product.code,
    name: product.name,
    specification: product.specification,
    unit: product.unit,
    unitLabel: product.unitLabel,
    piecesPerUnit: product.piecesPerUnit,
    weightKgPerUnit: product.weightKgPerUnit,
    packageText: product.packageText,
    weightText: product.weightText,
    stockLabel: product.stockLabel,
    thumbnailUrl: product.thumbnailUrl,
    colorSeries: product.colorSeries,
    componentType: product.componentType,
    displayGroupName: product.displayGroupName,
    displayGroupOrder: product.displayGroupOrder,
    updatedAt: product.updatedAt,
  };
}

function toPublicGroup<
  T extends {
    hasStock: boolean;
    sampleProducts: PublicMiniProgramProduct[];
    seriesSortOrder?: number;
    componentSortOrder?: number;
  },
>(group: T) {
  const publicGroup = {
    ...group,
    sampleProducts: toGroupSampleProducts(group.sampleProducts),
  };
  const mutableGroup = publicGroup as Partial<T>;
  delete mutableGroup.hasStock;
  delete mutableGroup.seriesSortOrder;
  delete mutableGroup.componentSortOrder;
  return publicGroup as Omit<
    T,
    'hasStock' | 'sampleProducts' | 'seriesSortOrder' | 'componentSortOrder'
  > & {
    sampleProducts: MiniProgramGroupSampleProduct[];
  };
}

function compareProductGroups(
  a: {
    seriesSortOrder: number;
    componentSortOrder: number;
    colorSeries: { id: string; name: string };
    componentType: { id: MiniProgramComponentType; label: string };
    title: string;
  },
  b: {
    seriesSortOrder: number;
    componentSortOrder: number;
    colorSeries: { id: string; name: string };
    componentType: { id: MiniProgramComponentType; label: string };
    title: string;
  }
) {
  if (a.seriesSortOrder !== b.seriesSortOrder) {
    return a.seriesSortOrder - b.seriesSortOrder;
  }

  if (a.colorSeries.id !== b.colorSeries.id) {
    const seriesNameCompare = a.colorSeries.name.localeCompare(
      b.colorSeries.name,
      'zh-CN'
    );
    if (seriesNameCompare !== 0) return seriesNameCompare;
    return a.colorSeries.id.localeCompare(b.colorSeries.id);
  }

  if (a.componentSortOrder !== b.componentSortOrder) {
    return a.componentSortOrder - b.componentSortOrder;
  }

  if (a.componentType.id !== b.componentType.id) {
    const componentNameCompare = a.componentType.label.localeCompare(
      b.componentType.label,
      'zh-CN'
    );
    if (componentNameCompare !== 0) return componentNameCompare;
    return a.componentType.id.localeCompare(b.componentType.id);
  }

  return a.title.localeCompare(b.title, 'zh-CN');
}

function compareSeriesGroups(
  a: {
    seriesSortOrder: number;
    colorSeries: { id: string; name: string };
    title: string;
  },
  b: {
    seriesSortOrder: number;
    colorSeries: { id: string; name: string };
    title: string;
  }
) {
  if (a.seriesSortOrder !== b.seriesSortOrder) {
    return a.seriesSortOrder - b.seriesSortOrder;
  }

  const seriesNameCompare = a.colorSeries.name.localeCompare(
    b.colorSeries.name,
    'zh-CN'
  );
  if (seriesNameCompare !== 0) return seriesNameCompare;
  return a.colorSeries.id.localeCompare(b.colorSeries.id);
}

async function getActiveProducts(settings: MiniProgramCatalogSettings) {
  const products = await prisma.product.findMany({
    where: { status: 'active' },
    select: PRODUCT_SELECT,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  });

  return products.filter(product =>
    isOwnProductDisplayableInMiniProgram(product, settings)
  );
}

export async function getVisibleMiniProgramOwnProductSnapshots(
  productIds: string[],
  options: { forceFresh?: boolean } = {}
): Promise<Map<string, MiniProgramVisibleOwnProductSnapshot>> {
  const ids = Array.from(
    new Set(productIds.map(id => String(id || '').trim()).filter(Boolean))
  );
  if (ids.length === 0) return new Map();

  const settings = await getMiniProgramCatalogSettings({
    forceFresh: options.forceFresh,
  });
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, status: 'active' },
    select: PRODUCT_SELECT,
  });
  const batchFallbackMap = await loadLatestBatchSpecsByProductId(
    products.map(product => product.id)
  );
  const snapshots = new Map<string, MiniProgramVisibleOwnProductSnapshot>();

  for (const product of products) {
    if (!isOwnProductDisplayableInMiniProgram(product, settings)) continue;

    const publicProduct = toPublicOwnProduct(
      product,
      settings,
      batchFallbackMap.get(product.id) ?? null
    );
    if (!isProductTaxonomyVisible(publicProduct, settings)) continue;

    snapshots.set(product.id, {
      id: publicProduct.id,
      code: publicProduct.code,
      name: publicProduct.name,
      specification: publicProduct.specification,
      unit: publicProduct.unit,
      thumbnailUrl: publicProduct.thumbnailUrl,
    });
  }

  return snapshots;
}

type BatchSpecFallbackRecord = {
  productId: string;
  variantId: string | null;
  variantKey: string;
  batchNumber: string;
  piecesPerUnit: number;
  weight: Prisma.Decimal | null;
};

function normalizeVariantKey(value?: string | null) {
  return value || '';
}

function buildBatchSpecLookupKey(
  productId: string,
  batchNumber: string,
  variantId?: string | null
) {
  return [productId, normalizeVariantKey(variantId), batchNumber].join('__');
}

function resolveBatchSpecPiecesPerUnit(value: number) {
  return Number.isInteger(value) && value > 1 ? value : null;
}

function resolveBatchSpecWeight(value: Prisma.Decimal | number | null) {
  const weight = value === null ? null : Number(value);
  return weight && Number.isFinite(weight) && weight > 0 ? weight : null;
}

function mergeBatchFallback(
  current: ProductBatchFallback | undefined,
  spec: BatchSpecFallbackRecord | null | undefined
): ProductBatchFallback {
  const previous = current ?? {
    piecesPerUnit: null,
    weight: null,
  };
  if (!spec) return previous;

  return {
    piecesPerUnit:
      previous.piecesPerUnit ??
      resolveBatchSpecPiecesPerUnit(spec.piecesPerUnit),
    weight: previous.weight ?? resolveBatchSpecWeight(spec.weight),
  };
}

function isBatchFallbackComplete(value: ProductBatchFallback | undefined) {
  return Boolean(value?.piecesPerUnit && value.weight);
}

// 按 productId 取一条"代表性"批次规格的 piecesPerUnit / weight。
// 小程序列表没有批次选择,展示上优先取当前有库存的批次规格;没有库存批次时,
// 再回退到最近维护过的批次规格。真正出货时仍由订单按实际批次重新带值。
async function loadLatestBatchSpecsByProductId(
  productIds: string[]
): Promise<Map<string, ProductBatchFallback>> {
  const uniqueProductIds = Array.from(new Set(productIds));
  if (uniqueProductIds.length === 0) return new Map();

  const [inventories, specs] = await Promise.all([
    prisma.inventory.findMany({
      where: {
        productId: { in: uniqueProductIds },
        quantity: { gt: 0 },
        batchNumber: { not: null },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: {
        productId: true,
        variantId: true,
        batchNumber: true,
      },
    }),
    prisma.batchSpecification.findMany({
      where: { productId: { in: uniqueProductIds } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: {
        productId: true,
        variantId: true,
        variantKey: true,
        batchNumber: true,
        piecesPerUnit: true,
        weight: true,
      },
    }),
  ]);

  const map = new Map<string, ProductBatchFallback>();
  const specsByExactBatch = new Map<string, BatchSpecFallbackRecord>();
  const specsByDefaultBatch = new Map<string, BatchSpecFallbackRecord>();
  const specsByAnyBatch = new Map<string, BatchSpecFallbackRecord>();

  for (const spec of specs) {
    const variantKey = normalizeVariantKey(spec.variantId || spec.variantKey);
    const exactKey = buildBatchSpecLookupKey(
      spec.productId,
      spec.batchNumber,
      variantKey
    );
    const defaultKey = buildBatchSpecLookupKey(
      spec.productId,
      spec.batchNumber
    );
    const batchKey = [spec.productId, spec.batchNumber].join('__');

    if (!specsByExactBatch.has(exactKey)) {
      specsByExactBatch.set(exactKey, spec);
    }
    if (variantKey === '' && !specsByDefaultBatch.has(defaultKey)) {
      specsByDefaultBatch.set(defaultKey, spec);
    }
    if (!specsByAnyBatch.has(batchKey)) {
      specsByAnyBatch.set(batchKey, spec);
    }
  }

  for (const inventory of inventories) {
    if (!inventory.batchNumber) continue;
    if (isBatchFallbackComplete(map.get(inventory.productId))) continue;

    const exactSpec = specsByExactBatch.get(
      buildBatchSpecLookupKey(
        inventory.productId,
        inventory.batchNumber,
        inventory.variantId
      )
    );
    const defaultSpec = specsByDefaultBatch.get(
      buildBatchSpecLookupKey(inventory.productId, inventory.batchNumber)
    );
    const anySpec = specsByAnyBatch.get(
      [inventory.productId, inventory.batchNumber].join('__')
    );

    let fallback: ProductBatchFallback = map.get(inventory.productId) ?? {
      piecesPerUnit: null,
      weight: null,
    };
    for (const candidate of [exactSpec, defaultSpec, anySpec]) {
      fallback = mergeBatchFallback(fallback, candidate);
    }
    map.set(inventory.productId, fallback);
  }

  for (const spec of specs) {
    if (isBatchFallbackComplete(map.get(spec.productId))) continue;

    map.set(spec.productId, mergeBatchFallback(map.get(spec.productId), spec));
  }

  return map;
}

async function getPublicTemporaryProducts() {
  return prisma.temporaryProduct.findMany({
    where: {
      showInMiniProgram: true,
      supplier: {
        status: 'active',
      },
    },
    select: TEMPORARY_PRODUCT_SELECT,
    orderBy: [
      { usageCount: 'desc' },
      { lastUsedAt: 'desc' },
      { updatedAt: 'desc' },
      { id: 'desc' },
    ],
  });
}

function buildProductIdentityIndex(products: CatalogProductRecord[]) {
  const codes = new Set<string>();
  const nameSpecifications = new Set<string>();

  for (const product of products) {
    const code = normalizeLookupText(product.code);
    if (code) codes.add(code);

    const nameSpecificationKey = buildNameSpecificationKey(product);
    if (nameSpecificationKey) nameSpecifications.add(nameSpecificationKey);
  }

  return { codes, nameSpecifications };
}

function isDuplicateExternalProduct(
  product: ExternalCatalogProductRecord,
  identityIndex: ReturnType<typeof buildProductIdentityIndex>
) {
  const code = normalizeLookupText(product.code);
  if (code && identityIndex.codes.has(code)) return true;

  const nameSpecificationKey = buildNameSpecificationKey(product);
  return (
    Boolean(nameSpecificationKey) &&
    identityIndex.nameSpecifications.has(nameSpecificationKey)
  );
}

function dedupeExternalProducts(products: ExternalCatalogProductRecord[]) {
  const seen = new Set<string>();
  const result: ExternalCatalogProductRecord[] = [];

  for (const product of products) {
    const code = normalizeLookupText(product.code);
    const nameSpecificationKey = buildNameSpecificationKey(product);
    const key = code ? `code:${code}` : `name:${nameSpecificationKey}`;

    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(product);
  }

  return result;
}

function toOwnCatalogItem(
  product: CatalogProductRecord,
  settings: MiniProgramCatalogSettings,
  batchFallback: ProductBatchFallback | null = null
): CatalogItem {
  return {
    publicProduct: toPublicOwnProduct(product, settings, batchFallback),
    searchText: buildOwnSearchText(product),
    hasStock: getProductStockStatus(product) !== 'out_of_stock',
  };
}

function toExternalCatalogItem(
  product: ExternalCatalogProductRecord,
  settings: MiniProgramCatalogSettings
): CatalogItem {
  return {
    publicProduct: toPublicExternalProduct(product, settings),
    searchText: buildExternalSearchText(product),
    hasStock: false,
  };
}

async function getCatalogItems(
  settings: MiniProgramCatalogSettings,
  options: { forceFresh?: boolean } = {}
) {
  const cacheKey = buildCatalogItemsCacheKey(settings);
  const now = Date.now();
  if (
    !options.forceFresh &&
    catalogItemsCache &&
    catalogItemsCache.key === cacheKey &&
    catalogItemsCache.expiresAt > now
  ) {
    return catalogItemsCache.items;
  }

  if (!options.forceFresh && catalogItemsInFlight?.key === cacheKey) {
    return catalogItemsInFlight.promise;
  }

  const promise = buildFreshCatalogItems(settings, cacheKey);
  catalogItemsInFlight = { key: cacheKey, promise };

  try {
    return await promise;
  } finally {
    if (catalogItemsInFlight?.promise === promise) {
      catalogItemsInFlight = null;
    }
  }
}

async function buildFreshCatalogItems(
  settings: MiniProgramCatalogSettings,
  cacheKey: string
) {
  const [ownProducts, temporaryProducts] = await Promise.all([
    getActiveProducts(settings),
    getPublicTemporaryProducts(),
  ]);
  const identityIndex = buildProductIdentityIndex(ownProducts);
  const externalProducts = dedupeExternalProducts(
    temporaryProducts.filter(
      product => !isDuplicateExternalProduct(product, identityIndex)
    )
  );

  const batchFallbackMap = await loadLatestBatchSpecsByProductId(
    ownProducts.map(product => product.id)
  );

  const items = [
    ...ownProducts.map(product =>
      toOwnCatalogItem(
        product,
        settings,
        batchFallbackMap.get(product.id) ?? null
      )
    ),
    ...externalProducts.map(product =>
      toExternalCatalogItem(product, settings)
    ),
  ].filter(item => isProductTaxonomyVisible(item.publicProduct, settings));

  catalogItemsCache = {
    key: cacheKey,
    expiresAt: Date.now() + CATALOG_ITEMS_CACHE_TTL,
    items,
  };

  return items;
}

function buildProductGroups(
  products: CatalogItem[],
  settings: MiniProgramCatalogSettings
) {
  const groupMap = new Map<
    string,
    {
      id: string;
      colorSeries: { id: string; name: string };
      componentType: { id: MiniProgramComponentType; label: string };
      hasStock: boolean;
      products: PublicMiniProgramProduct[];
    }
  >();

  for (const product of products) {
    const item = product.publicProduct;
    const productHasStock = product.hasStock;
    const key = `${item.colorSeries.id}__${item.componentType.id}`;
    const existing = groupMap.get(key);

    if (existing) {
      existing.hasStock = existing.hasStock || productHasStock;
      existing.products.push(item);
      continue;
    }

    groupMap.set(key, {
      id: key,
      colorSeries: item.colorSeries,
      componentType: item.componentType,
      hasStock: productHasStock,
      products: [item],
    });
  }

  return Array.from(groupMap.values()).map(group => {
    const seriesSetting = getSeriesSetting(settings, group.colorSeries.id);
    const componentSetting = getComponentSetting(
      settings,
      group.componentType.id
    );
    const seriesSortOrder = seriesSetting?.sortOrder ?? 999;
    const componentSortOrder = componentSetting?.sortOrder ?? 999;
    const productCount = group.products.length;
    const specificationCount = new Set(
      group.products.map(product => product.specification).filter(Boolean)
    ).size;
    const imageCount = group.products.reduce(
      (sum, product) => sum + product.imageCount,
      0
    );
    const effectImageCount = group.products.reduce(
      (sum, product) => sum + product.effectImageUrls.length,
      0
    );
    const externalProductCount = group.products.filter(
      product => product.source === 'external'
    ).length;

    return {
      kind: 'component' as const,
      id: group.id,
      title: buildGroupTitle(group),
      colorSeries: group.colorSeries,
      componentType: group.componentType,
      coverUrl:
        group.products.find(product => product.thumbnailUrl)?.thumbnailUrl ??
        componentSetting?.coverUrl ??
        seriesSetting?.coverUrl ??
        null,
      sortOrder: componentSortOrder,
      seriesSortOrder,
      componentSortOrder,
      productCount,
      specificationCount,
      imageCount,
      effectImageCount,
      externalProductCount,
      hasStock: group.hasStock,
      sampleProducts: group.products.slice(0, 6),
      updatedAt: group.products[0]?.updatedAt ?? null,
    };
  });
}

function buildSeriesGroups(
  products: CatalogItem[],
  settings: MiniProgramCatalogSettings
) {
  const groupMap = new Map<
    string,
    {
      id: string;
      colorSeries: { id: string; name: string };
      hasStock: boolean;
      products: PublicMiniProgramProduct[];
      componentMap: Map<
        string,
        {
          id: MiniProgramComponentType;
          label: string;
          sortOrder: number;
          coverUrl: string | null;
          products: PublicMiniProgramProduct[];
        }
      >;
    }
  >();

  for (const product of products) {
    const item = product.publicProduct;
    const seriesId = item.colorSeries.id;
    const componentId = item.componentType.id;
    const componentSetting = getComponentSetting(settings, componentId);
    let group = groupMap.get(seriesId);

    if (!group) {
      group = {
        id: `series__${seriesId}`,
        colorSeries: item.colorSeries,
        hasStock: product.hasStock,
        products: [],
        componentMap: new Map(),
      };
      groupMap.set(seriesId, group);
    }

    group.hasStock = group.hasStock || product.hasStock;
    group.products.push(item);

    const component = group.componentMap.get(componentId);
    if (component) {
      component.products.push(item);
      continue;
    }

    group.componentMap.set(componentId, {
      id: componentId,
      label: item.componentType.label,
      sortOrder: componentSetting?.sortOrder ?? 999,
      coverUrl: componentSetting?.coverUrl ?? null,
      products: [item],
    });
  }

  return Array.from(groupMap.values()).map(group => {
    const seriesSetting = getSeriesSetting(settings, group.colorSeries.id);
    const seriesSortOrder = seriesSetting?.sortOrder ?? 999;
    const components = Array.from(group.componentMap.values())
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.label.localeCompare(b.label, 'zh-CN');
      })
      .map(component => ({
        id: component.id,
        label: component.label,
        coverUrl:
          component.products.find(product => product.thumbnailUrl)
            ?.thumbnailUrl ??
          component.coverUrl ??
          null,
        productCount: component.products.length,
        specificationCount: new Set(
          component.products
            .map(product => product.specification)
            .filter(Boolean)
        ).size,
      }));
    const productCount = group.products.length;
    const specificationCount = new Set(
      group.products.map(product => product.specification).filter(Boolean)
    ).size;
    const imageCount = group.products.reduce(
      (sum, product) => sum + product.imageCount,
      0
    );
    const effectImageCount = group.products.reduce(
      (sum, product) => sum + product.effectImageUrls.length,
      0
    );
    const externalProductCount = group.products.filter(
      product => product.source === 'external'
    ).length;

    return {
      kind: 'series' as const,
      id: group.id,
      title: group.colorSeries.name,
      colorSeries: group.colorSeries,
      componentType: {
        id: 'all',
        label: '全部品种',
      },
      coverUrl:
        group.products.find(product => product.thumbnailUrl)?.thumbnailUrl ??
        seriesSetting?.coverUrl ??
        components.find(component => component.coverUrl)?.coverUrl ??
        null,
      sortOrder: seriesSortOrder,
      seriesSortOrder,
      componentSortOrder: 0,
      componentCount: components.length,
      components,
      productCount,
      specificationCount,
      imageCount,
      effectImageCount,
      externalProductCount,
      hasStock: group.hasStock,
      sampleProducts: group.products.slice(0, 6),
      updatedAt: group.products[0]?.updatedAt ?? null,
    };
  });
}

function buildSeriesSummary(
  products: CatalogItem[],
  settings: MiniProgramCatalogSettings
) {
  const publicProducts = products.map(product => product.publicProduct);
  const countBySeries = new Map<string, number>();
  const coverBySeries = new Map<string, string | null>();

  for (const product of publicProducts) {
    const seriesId = product.colorSeries.id;
    countBySeries.set(seriesId, (countBySeries.get(seriesId) ?? 0) + 1);
    if (!coverBySeries.has(seriesId)) {
      coverBySeries.set(seriesId, product.thumbnailUrl);
    }
  }

  const series = settings.colorSeries
    .filter(item => item.visible)
    .map(item => ({
      id: item.id,
      name: item.name,
      productCount: countBySeries.get(item.id) ?? 0,
      coverUrl: item.coverUrl || coverBySeries.get(item.id) || null,
    }));

  return [
    {
      id: HOT_SERIES.id,
      name: HOT_SERIES.name,
      productCount: products.length,
      coverUrl:
        publicProducts.find(product => product.thumbnailUrl)?.thumbnailUrl ??
        null,
    },
    ...series,
  ];
}

function filterProducts(
  products: CatalogItem[],
  params: { seriesId?: string; componentType?: string; search?: string }
) {
  const search = normalizeLookupText(params.search);

  return products.filter(product => {
    const publicProduct = product.publicProduct;
    const seriesMatched =
      !params.seriesId ||
      params.seriesId === HOT_SERIES.id ||
      publicProduct.colorSeries.id === params.seriesId;
    const componentMatched =
      !params.componentType ||
      params.componentType === 'all' ||
      publicProduct.componentType.id === params.componentType;
    const searchMatched = !search || product.searchText.includes(search);

    return seriesMatched && componentMatched && searchMatched;
  });
}

function orderProductsForDisplay(products: CatalogItem[]) {
  return products
    .map((product, index) => ({ index, product }))
    .sort((a, b) => {
      const first = a.product.publicProduct;
      const second = b.product.publicProduct;
      const firstGroup = first.displayGroupName;
      const secondGroup = second.displayGroupName;

      if (firstGroup || secondGroup) {
        if (!firstGroup) return 1;
        if (!secondGroup) return -1;

        const groupCompare = firstGroup.localeCompare(secondGroup, 'zh-CN');
        if (groupCompare !== 0) return groupCompare;

        const firstOrder = first.displayGroupOrder ?? 999;
        const secondOrder = second.displayGroupOrder ?? 999;
        if (firstOrder !== secondOrder) return firstOrder - secondOrder;

        const codeCompare = first.code.localeCompare(second.code, 'zh-CN');
        if (codeCompare !== 0) return codeCompare;
      }

      return a.index - b.index;
    })
    .map(item => item.product);
}

function buildComponentSummary(
  products: CatalogItem[],
  settings: MiniProgramCatalogSettings
) {
  const countByComponent = new Map<string, number>();

  for (const product of products) {
    const publicProduct = product.publicProduct;
    countByComponent.set(
      publicProduct.componentType.id,
      (countByComponent.get(publicProduct.componentType.id) ?? 0) + 1
    );
  }

  return [
    { id: 'all', label: '全部', productCount: products.length },
    ...sortByCatalogOrder(
      settings.componentTypes.filter(item => item.visible)
    ).map(item => ({
      id: item.id,
      label: item.label,
      coverUrl: item.coverUrl,
      productCount: countByComponent.get(item.id) ?? 0,
    })),
  ];
}

export async function getMiniProgramCatalog(
  params: {
    seriesId?: string;
    componentType?: string;
    search?: string;
  } & MiniProgramProductListParams,
  options: MiniProgramImageUrlOptions = {}
) {
  const settings = await getMiniProgramCatalogSettings({
    forceFresh: options.forceFresh,
  });
  const products = await getCatalogItems(settings, options);
  const shouldIncludeProducts = normalizeBooleanLike(
    params.includeProducts,
    Boolean(params.search)
  );
  const currentSeriesProducts = filterProducts(products, {
    seriesId: params.seriesId,
  });
  const filteredProducts = filterProducts(products, params);
  const orderedProducts = orderProductsForDisplay(filteredProducts);
  const shouldGroupBySeries =
    !params.seriesId || params.seriesId === HOT_SERIES.id;
  const groups = shouldGroupBySeries
    ? buildSeriesGroups(filteredProducts, settings).sort(compareSeriesGroups)
    : buildProductGroups(filteredProducts, settings).sort(compareProductGroups);
  const paginatedProducts = paginateMiniProgramItems(orderedProducts, params);

  const response = {
    series: buildSeriesSummary(products, settings),
    components: buildComponentSummary(currentSeriesProducts, settings),
    groups: groups.map(toPublicGroup),
    products: shouldIncludeProducts
      ? paginatedProducts.items.map(product =>
          toProductListItem(product.publicProduct)
        )
      : [],
    pagination: paginatedProducts.pagination,
  };

  return prepareMiniProgramImageUrls(response, options);
}

export async function getMiniProgramProductGroup(
  groupId: string,
  params: MiniProgramProductListParams = {},
  options: MiniProgramImageUrlOptions = {}
) {
  const [seriesId, componentType] = groupId.split('__');
  const settings = await getMiniProgramCatalogSettings({
    forceFresh: options.forceFresh,
  });
  const products = await getCatalogItems(settings, options);
  const groupProducts = filterProducts(products, {
    seriesId,
    componentType,
  });
  const filteredProducts = filterProducts(products, {
    seriesId,
    componentType,
    search: params.search || undefined,
  });
  const orderedProducts = orderProductsForDisplay(filteredProducts);
  const group = buildProductGroups(groupProducts, settings)[0];

  if (!group) return null;

  const sameSeriesGroups = buildProductGroups(
    filterProducts(products, { seriesId }),
    settings
  )
    .sort(compareProductGroups)
    .filter(item => item.id !== group.id)
    .slice(0, 6);
  const paginatedProducts = paginateMiniProgramItems(orderedProducts, params);

  const response = {
    ...toPublicGroup(group),
    products: paginatedProducts.items.map(product =>
      toProductListItem(product.publicProduct)
    ),
    pagination: paginatedProducts.pagination,
    relatedGroups: sameSeriesGroups.map(toPublicGroup),
  };

  return prepareMiniProgramImageUrls(response, options);
}

async function findCanonicalProductForExternal(
  externalProduct: ExternalCatalogProductRecord
) {
  const product = await prisma.product.findFirst({
    where: {
      status: 'active',
      OR: [
        { code: externalProduct.code },
        {
          name: externalProduct.name,
          specification: externalProduct.specification,
        },
      ],
    },
    select: PRODUCT_SELECT,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  });

  return product;
}

async function buildProductDetailResponse(
  publicProduct: PublicMiniProgramProduct,
  settings: MiniProgramCatalogSettings,
  options: MiniProgramImageUrlOptions = {}
) {
  const products = await getCatalogItems(settings, options);
  const relatedGroups = buildProductGroups(
    filterProducts(products, {
      seriesId: publicProduct.colorSeries.id,
    }),
    settings
  )
    .sort(compareProductGroups)
    .filter(item => item.componentType.id !== publicProduct.componentType.id)
    .slice(0, 6);

  const response = {
    ...publicProduct,
    relatedGroups: relatedGroups.map(toPublicGroup),
  };

  return prepareMiniProgramImageUrls(response, options);
}

export async function getMiniProgramProduct(
  productId: string,
  options: MiniProgramImageUrlOptions = {}
) {
  const settings = await getMiniProgramCatalogSettings({
    forceFresh: options.forceFresh,
  });
  const product = await prisma.product.findFirst({
    where: { id: productId, status: 'active' },
    select: PRODUCT_SELECT,
  });

  if (product) {
    if (!isOwnProductDisplayableInMiniProgram(product, settings)) return null;
    const batchFallbackMap = await loadLatestBatchSpecsByProductId([
      product.id,
    ]);
    const publicProduct = toPublicOwnProduct(
      product,
      settings,
      batchFallbackMap.get(product.id) ?? null
    );
    if (!isProductTaxonomyVisible(publicProduct, settings)) return null;
    return buildProductDetailResponse(publicProduct, settings, options);
  }

  const temporaryProduct = await prisma.temporaryProduct.findFirst({
    where: {
      id: productId,
      supplier: {
        status: 'active',
      },
    },
    select: TEMPORARY_PRODUCT_SELECT,
  });

  if (!temporaryProduct) return null;

  const canonicalProduct =
    await findCanonicalProductForExternal(temporaryProduct);
  if (canonicalProduct) {
    if (!isOwnProductDisplayableInMiniProgram(canonicalProduct, settings))
      return null;
    const batchFallbackMap = await loadLatestBatchSpecsByProductId([
      canonicalProduct.id,
    ]);
    const publicProduct = toPublicOwnProduct(
      canonicalProduct,
      settings,
      batchFallbackMap.get(canonicalProduct.id) ?? null
    );
    if (!isProductTaxonomyVisible(publicProduct, settings)) return null;
    return buildProductDetailResponse(publicProduct, settings, options);
  }

  const publicProduct = toPublicExternalProduct(temporaryProduct, settings);
  if (!isProductTaxonomyVisible(publicProduct, settings)) return null;
  return buildProductDetailResponse(publicProduct, settings, options);
}
