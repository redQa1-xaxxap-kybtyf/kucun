import type { Prisma } from '@prisma/client';

import { computeStockStatusFromInventoryLike } from '@/lib/api/mini-program-sanitize';
import { PRODUCT_UNIT_LABELS } from '@/lib/config/product';
import { prisma } from '@/lib/db';
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
  updatedAt: string;
};

type CatalogItem = {
  publicProduct: PublicMiniProgramProduct;
  searchText: string;
  hasStock: boolean;
};

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
    id: 'corner_stone',
    label: '转角石',
    keywords: ['转角石', '转角', '阳角', '阴角', '护角'],
  },
  {
    id: 'roman_column',
    label: '罗马柱',
    keywords: ['罗马柱', '柱头', '柱身', '柱脚', '柱子'],
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

function normalizeSortOrder(value: unknown, fallback: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(1, Math.round(numericValue));
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
      isPublic: true,
    },
    create: {
      key: CATALOG_SETTINGS_KEY,
      value: JSON.stringify(settings),
      category: CATALOG_SETTINGS_CATEGORY,
      dataType: 'json',
      description: '小程序花色、品种和产品展示设置',
      isPublic: true,
    },
  });
}

export async function getMiniProgramCatalogSettings() {
  const saved = await readStoredCatalogSettings();
  return mergeCatalogSettings(saved);
}

export async function updateMiniProgramCatalogSettings(
  input: StoredMiniProgramCatalogSettings
) {
  const current = await getMiniProgramCatalogSettings();
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
  return next;
}

export async function updateMiniProgramProductDisplayOverride(
  productId: string,
  override: MiniProgramProductDisplayOverride
) {
  const current = await getMiniProgramCatalogSettings();
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
  return next.productOverrides[productId] ?? {};
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

  return [
    category.parent?.parent?.name,
    category.parent?.name,
    category.name,
  ]
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

function hasMiniProgramDisplaySignal(
  product: CatalogProductRecord,
  settings: MiniProgramCatalogSettings
) {
  const override = settings.productOverrides[product.id];
  if (override?.visible === false) return false;
  if (
    override?.visible === true &&
    override.seriesId &&
    override.componentType
  ) {
    return true;
  }

  const searchText = buildOwnSearchText(product);
  const component = resolveComponentType(searchText, settings, product.id);
  const hasImage = Boolean(product.thumbnailUrl || product.images);
  const hasColor =
    resolveColorSeries(searchText, settings, product.id)?.id !== 'other';
  const hasSpecificComponent =
    component.id !== 'other' && component.id !== 'facade_tile';

  return hasImage || hasColor || hasSpecificComponent;
}

function isOwnProductDisplayableInMiniProgram(
  product: CatalogProductRecord,
  settings: MiniProgramCatalogSettings
) {
  const override = settings.productOverrides[product.id];
  if (
    override?.visible === true &&
    override.seriesId &&
    override.componentType
  ) {
    return true;
  }

  return (
    !isInternalTestProduct(product) &&
    hasMiniProgramDisplaySignal(product, settings)
  );
}

function isProductTaxonomyVisible(
  product: PublicMiniProgramProduct,
  settings: MiniProgramCatalogSettings
) {
  const series = getSeriesSetting(settings, product.colorSeries.id);
  const component = getComponentSetting(settings, product.componentType.id);

  return Boolean(series?.visible && component?.visible);
}

function getProductImages(product: CatalogProductRecord) {
  return parseProductImages(product.images, product.id).filter(
    image => typeof image.url === 'string' && image.url.length > 0
  );
}

function getProductImageUrls(product: CatalogProductRecord) {
  const imageUrls = getProductImages(product).map(image => image.url);

  return product.thumbnailUrl
    ? [
        product.thumbnailUrl,
        ...imageUrls.filter(url => url !== product.thumbnailUrl),
      ]
    : imageUrls;
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
}) {
  const weight = getProductWeightKg(product);
  if (!weight) return '';

  return `${formatNumberText(weight)}kg/${getUnitLabel(product.unit)}`;
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
  settings: MiniProgramCatalogSettings
) {
  const searchText = buildOwnSearchText(product);
  const series = resolveColorSeries(searchText, settings, product.id);
  const component = resolveComponentType(searchText, settings, product.id);
  const productImages = getProductImages(product);
  const imageUrls = getProductImageUrls(product);
  const mainImageUrls = productImages
    .filter(image => image.type === 'main')
    .map(image => image.url);
  const effectImageUrls = productImages
    .filter(image => image.type === 'effect')
    .map(image => image.url);
  const packageText = getProductPackageText(product);
  const weightText = getProductWeightText(product);
  const unitLabel = getUnitLabel(product.unit);
  const piecesPerUnit =
    typeof product.piecesPerUnit === 'number' && product.piecesPerUnit > 0
      ? product.piecesPerUnit
      : null;

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
    stockLabel: getProductStockLabel(product),
    thumbnailUrl: imageUrls[0] ?? null,
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
    updatedAt: product.updatedAt.toISOString(),
  };
}

function toPublicExternalProduct(
  product: ExternalCatalogProductRecord,
  settings: MiniProgramCatalogSettings
) {
  const searchText = buildExternalSearchText(product);
  const series = resolveColorSeries(searchText, settings, product.id);
  const component = resolveComponentType(searchText, settings, product.id);
  const packageText = getProductPackageText(product);
  const weightText = getProductWeightText(product);
  const productImages = parseProductImages(product.images, product.id).filter(
    image => typeof image.url === 'string' && image.url.length > 0
  );
  const imageUrls = product.thumbnailUrl
    ? [
        product.thumbnailUrl,
        ...productImages
          .map(image => image.url)
          .filter(url => url !== product.thumbnailUrl),
      ]
    : productImages.map(image => image.url);
  const mainImageUrls = productImages
    .filter(image => image.type === 'main')
    .map(image => image.url);
  const effectImageUrls = productImages
    .filter(image => image.type === 'effect')
    .map(image => image.url);
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
    thumbnailUrl: imageUrls[0] ?? null,
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

function toPublicGroup<T extends { hasStock: boolean }>(group: T) {
  const publicGroup = { ...group };
  delete (publicGroup as Partial<T>).hasStock;
  return publicGroup as Omit<T, 'hasStock'>;
}

async function getActiveProducts(settings: MiniProgramCatalogSettings) {
  const products = await prisma.product.findMany({
    where: { status: 'active' },
    select: PRODUCT_SELECT,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: 600,
  });

  return products.filter(product =>
    isOwnProductDisplayableInMiniProgram(product, settings)
  );
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
    take: 600,
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
  settings: MiniProgramCatalogSettings
): CatalogItem {
  return {
    publicProduct: toPublicOwnProduct(product, settings),
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

async function getCatalogItems(settings: MiniProgramCatalogSettings) {
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

  return [
    ...ownProducts.map(product => toOwnCatalogItem(product, settings)),
    ...externalProducts.map(product =>
      toExternalCatalogItem(product, settings)
    ),
  ].filter(item => isProductTaxonomyVisible(item.publicProduct, settings));
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
      id: group.id,
      title: buildGroupTitle(group),
      colorSeries: group.colorSeries,
      componentType: group.componentType,
      coverUrl:
        group.products.find(product => product.thumbnailUrl)?.thumbnailUrl ??
        componentSetting?.coverUrl ??
        seriesSetting?.coverUrl ??
        null,
      sortOrder: componentSetting?.sortOrder ?? 999,
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
    ...settings.componentTypes
      .filter(item => item.visible)
      .map(item => ({
        id: item.id,
        label: item.label,
        coverUrl: item.coverUrl,
        productCount: countByComponent.get(item.id) ?? 0,
      })),
  ];
}

export async function getMiniProgramCatalog(params: {
  seriesId?: string;
  componentType?: string;
  search?: string;
}) {
  const settings = await getMiniProgramCatalogSettings();
  const products = await getCatalogItems(settings);
  const currentSeriesProducts = filterProducts(products, {
    seriesId: params.seriesId,
  });
  const filteredProducts = filterProducts(products, params);
  const groups = buildProductGroups(filteredProducts, settings).sort((a, b) => {
    if (a.hasStock !== b.hasStock) return a.hasStock ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    if (a.productCount !== b.productCount)
      return b.productCount - a.productCount;
    return a.title.localeCompare(b.title, 'zh-CN');
  });

  return {
    series: buildSeriesSummary(products, settings),
    components: buildComponentSummary(currentSeriesProducts, settings),
    groups: groups.map(toPublicGroup),
    products: filteredProducts
      .slice(0, 30)
      .map(product => product.publicProduct),
  };
}

export async function getMiniProgramProductGroup(groupId: string) {
  const [seriesId, componentType] = groupId.split('__');
  const settings = await getMiniProgramCatalogSettings();
  const products = await getCatalogItems(settings);
  const filteredProducts = filterProducts(products, {
    seriesId,
    componentType,
  });
  const group = buildProductGroups(filteredProducts, settings)[0];

  if (!group) return null;

  const sameSeriesGroups = buildProductGroups(
    filterProducts(products, { seriesId }),
    settings
  )
    .filter(item => item.id !== group.id)
    .slice(0, 6);

  return {
    ...toPublicGroup(group),
    products: filteredProducts.map(product => product.publicProduct),
    relatedGroups: sameSeriesGroups.map(toPublicGroup),
  };
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
  settings: MiniProgramCatalogSettings
) {
  const products = await getCatalogItems(settings);
  const relatedGroups = buildProductGroups(
    filterProducts(products, {
      seriesId: publicProduct.colorSeries.id,
    }),
    settings
  )
    .filter(item => item.componentType.id !== publicProduct.componentType.id)
    .slice(0, 6);

  return {
    ...publicProduct,
    relatedGroups: relatedGroups.map(toPublicGroup),
  };
}

export async function getMiniProgramProduct(productId: string) {
  const settings = await getMiniProgramCatalogSettings();
  const product = await prisma.product.findFirst({
    where: { id: productId, status: 'active' },
    select: PRODUCT_SELECT,
  });

  if (product) {
    if (!isOwnProductDisplayableInMiniProgram(product, settings)) return null;
    const publicProduct = toPublicOwnProduct(product, settings);
    if (!isProductTaxonomyVisible(publicProduct, settings)) return null;
    return buildProductDetailResponse(publicProduct, settings);
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
    const publicProduct = toPublicOwnProduct(canonicalProduct, settings);
    if (!isProductTaxonomyVisible(publicProduct, settings)) return null;
    return buildProductDetailResponse(publicProduct, settings);
  }

  const publicProduct = toPublicExternalProduct(temporaryProduct, settings);
  if (!isProductTaxonomyVisible(publicProduct, settings)) return null;
  return buildProductDetailResponse(publicProduct, settings);
}
