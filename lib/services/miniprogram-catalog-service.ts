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

type CatalogProductRecord = Prisma.ProductGetPayload<{
  select: typeof PRODUCT_SELECT;
}>;

export type MiniProgramComponentType =
  | 'roman_column'
  | 'corner_stone'
  | 'line'
  | 'facade_tile'
  | 'matching'
  | 'other';

type ColorSeriesConfig = {
  id: string;
  name: string;
  keywords: string[];
};

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
  { id: 'other', name: '其他', keywords: [] },
];

const COMPONENT_TYPES: Array<{
  id: MiniProgramComponentType;
  label: string;
  keywords: string[];
}> = [
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
  { id: 'other', label: '其他', keywords: [] },
];

const HOT_SERIES = {
  id: 'hot',
  name: '全部',
};

function buildSearchText(product: CatalogProductRecord) {
  const categoryText = [
    product.category?.name,
    product.category?.code,
    product.category?.parent?.name,
    product.category?.parent?.code,
  ]
    .filter(Boolean)
    .join(' ');
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

function resolveColorSeries(product: CatalogProductRecord) {
  const text = buildSearchText(product);
  const matched = COLOR_SERIES.find(
    series =>
      series.id !== 'other' &&
      series.keywords.some(keyword => text.includes(keyword.toLowerCase()))
  );

  return matched ?? COLOR_SERIES[COLOR_SERIES.length - 1];
}

function resolveComponentType(product: CatalogProductRecord) {
  const text = buildSearchText(product);
  const matched = COMPONENT_TYPES.find(
    component =>
      component.id !== 'other' &&
      component.keywords.some(keyword => text.includes(keyword.toLowerCase()))
  );

  return matched ?? COMPONENT_TYPES[COMPONENT_TYPES.length - 1];
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

function formatNumberText(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/\.?0+$/, '');
}

function getUnitLabel(unit: string) {
  return PRODUCT_UNIT_LABELS[unit as keyof typeof PRODUCT_UNIT_LABELS] ?? unit;
}

function getProductPackageText(product: CatalogProductRecord) {
  if (typeof product.piecesPerUnit === 'number' && product.piecesPerUnit > 1) {
    return `1件=${product.piecesPerUnit}片`;
  }

  return '';
}

function getProductWeightText(product: CatalogProductRecord) {
  const weight = product.weight === null ? null : Number(product.weight);
  if (!weight || !Number.isFinite(weight) || weight <= 0) return '';

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

function toPublicProduct(product: CatalogProductRecord) {
  const series = resolveColorSeries(product);
  const component = resolveComponentType(product);
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

  return {
    id: product.id,
    code: product.code,
    name: product.name,
    specification: product.specification,
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

function toPublicGroup<T extends { hasStock: boolean }>(group: T) {
  const publicGroup = { ...group };
  delete (publicGroup as Partial<T>).hasStock;
  return publicGroup as Omit<T, 'hasStock'>;
}

async function getActiveProducts() {
  return prisma.product.findMany({
    where: { status: 'active' },
    select: PRODUCT_SELECT,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: 600,
  });
}

function buildProductGroups(products: CatalogProductRecord[]) {
  const groupMap = new Map<
    string,
    {
      id: string;
      colorSeries: { id: string; name: string };
      componentType: { id: MiniProgramComponentType; label: string };
      hasStock: boolean;
      products: ReturnType<typeof toPublicProduct>[];
    }
  >();

  for (const product of products) {
    const item = toPublicProduct(product);
    const productHasStock = getProductStockStatus(product) !== 'out_of_stock';
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

    return {
      id: group.id,
      title: `${group.colorSeries.name}${group.componentType.label}`,
      colorSeries: group.colorSeries,
      componentType: group.componentType,
      coverUrl:
        group.products.find(product => product.thumbnailUrl)?.thumbnailUrl ??
        null,
      productCount,
      specificationCount,
      imageCount,
      effectImageCount,
      hasStock: group.hasStock,
      sampleProducts: group.products.slice(0, 4),
      updatedAt: group.products[0]?.updatedAt ?? null,
    };
  });
}

function buildSeriesSummary(products: CatalogProductRecord[]) {
  const publicProducts = products.map(toPublicProduct);
  const countBySeries = new Map<string, number>();
  const coverBySeries = new Map<string, string | null>();

  for (const product of publicProducts) {
    const seriesId = product.colorSeries.id;
    countBySeries.set(seriesId, (countBySeries.get(seriesId) ?? 0) + 1);
    if (!coverBySeries.has(seriesId)) {
      coverBySeries.set(seriesId, product.thumbnailUrl);
    }
  }

  const series = COLOR_SERIES.filter(item => countBySeries.has(item.id)).map(
    item => ({
      id: item.id,
      name: item.name,
      productCount: countBySeries.get(item.id) ?? 0,
      coverUrl: coverBySeries.get(item.id) ?? null,
    })
  );

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
  products: CatalogProductRecord[],
  params: { seriesId?: string; componentType?: string; search?: string }
) {
  return products.filter(product => {
    const publicProduct = toPublicProduct(product);
    const text = buildSearchText(product);
    const seriesMatched =
      !params.seriesId ||
      params.seriesId === HOT_SERIES.id ||
      publicProduct.colorSeries.id === params.seriesId;
    const componentMatched =
      !params.componentType ||
      params.componentType === 'all' ||
      publicProduct.componentType.id === params.componentType;
    const searchMatched =
      !params.search || text.includes(params.search.toLowerCase());

    return seriesMatched && componentMatched && searchMatched;
  });
}

function buildComponentSummary(products: CatalogProductRecord[]) {
  const countByComponent = new Map<string, number>();

  for (const product of products) {
    const publicProduct = toPublicProduct(product);
    countByComponent.set(
      publicProduct.componentType.id,
      (countByComponent.get(publicProduct.componentType.id) ?? 0) + 1
    );
  }

  return [
    { id: 'all', label: '全部', productCount: products.length },
    ...COMPONENT_TYPES.filter(item => countByComponent.has(item.id)).map(
      item => ({
        id: item.id,
        label: item.label,
        productCount: countByComponent.get(item.id) ?? 0,
      })
    ),
  ];
}

export async function getMiniProgramCatalog(params: {
  seriesId?: string;
  componentType?: string;
  search?: string;
}) {
  const products = await getActiveProducts();
  const currentSeriesProducts = filterProducts(products, {
    seriesId: params.seriesId,
  });
  const filteredProducts = filterProducts(products, params);
  const groups = buildProductGroups(filteredProducts).sort((a, b) => {
    if (a.hasStock !== b.hasStock) return a.hasStock ? -1 : 1;
    if (a.productCount !== b.productCount)
      return b.productCount - a.productCount;
    return a.title.localeCompare(b.title, 'zh-CN');
  });

  return {
    series: buildSeriesSummary(products),
    components: buildComponentSummary(currentSeriesProducts),
    groups: groups.map(toPublicGroup),
    products: filteredProducts.slice(0, 30).map(toPublicProduct),
  };
}

export async function getMiniProgramProductGroup(groupId: string) {
  const [seriesId, componentType] = groupId.split('__');
  const products = await getActiveProducts();
  const filteredProducts = filterProducts(products, {
    seriesId,
    componentType,
  });
  const group = buildProductGroups(filteredProducts)[0];

  if (!group) return null;

  const sameSeriesGroups = buildProductGroups(
    filterProducts(products, { seriesId })
  )
    .filter(item => item.id !== group.id)
    .slice(0, 6);

  return {
    ...toPublicGroup(group),
    products: filteredProducts.map(toPublicProduct),
    relatedGroups: sameSeriesGroups.map(toPublicGroup),
  };
}

export async function getMiniProgramProduct(productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, status: 'active' },
    select: PRODUCT_SELECT,
  });

  if (!product) return null;

  const publicProduct = toPublicProduct(product);
  const products = await getActiveProducts();
  const relatedGroups = buildProductGroups(
    filterProducts(products, {
      seriesId: publicProduct.colorSeries.id,
    })
  )
    .filter(item => item.componentType.id !== publicProduct.componentType.id)
    .slice(0, 6);

  return {
    ...publicProduct,
    relatedGroups: relatedGroups.map(toPublicGroup),
  };
}
