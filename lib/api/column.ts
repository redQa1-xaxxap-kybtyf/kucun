/**
 * 罗马柱（快速拼柱）服务
 * 封装罗马柱相关的业务逻辑
 */

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';

/** 位置类型 */
export type SlotType = 'BODY' | 'BASE' | 'CAP';

/**
 * 素材搜索参数
 */
export interface MaterialSearchParams {
  keyword?: string;
  slot?: SlotType | 'ALL';
  heightRange?: string;
  cuttable?: boolean;
  faceWidth?: number;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 素材响应类型
 */
export interface MaterialResponse {
  id: string;
  code: string;
  name: string;
  slot: SlotType;
  slotName: string;
  height: number;
  faceWidth: number;
  cuttable: boolean;
  cutRecommend?: boolean;
  image: string;
  images: string[];
  usageCount: number;
  isFavorite: boolean;
  scenarios: string[];
  material?: string;
}

/**
 * 生成方案请求
 */
export interface GenerateSchemeRequest {
  targetHeight: number;
  faceTypes: {
    id: string;
    name: string;
    width: number;
    faces: number;
    materials: {
      BODY: { code: string; segments: number; height?: number };
      BASE: { code: string; segments: number; height?: number };
      CAP: { code: string; segments: number; height?: number };
    };
  }[];
}

/**
 * 用砖清单项
 */
export interface BrickListItem {
  slot: SlotType;
  slotDesc: string;
  code: string;
  quantity: number;
  totalHeight?: number;
  cutHeight?: number;
  note?: string;
}

/**
 * 用砖清单（按面型分组）
 */
export interface FaceTypeBrickList {
  faceType: string;
  faceTypeDesc: string;
  items: BrickListItem[];
}

/**
 * 生成方案响应
 */
export interface GenerateSchemeResponse {
  targetHeight: number;
  buildHeight: number;
  delta: number;
  cutPosition: SlotType | null;
  brickList: FaceTypeBrickList[];
}

/**
 * 根据分类编号推断位置类型
 */
export function inferSlotFromCategory(
  categoryCode: string | null | undefined
): SlotType {
  if (!categoryCode) return 'BODY';
  const code = categoryCode.toUpperCase();

  if (code.includes('CAP') || code.includes('盖帽')) return 'CAP';
  if (code.includes('BASE') || code.includes('底座')) return 'BASE';
  return 'BODY';
}

/**
 * 获取位置中文名称
 */
export function getSlotName(slot: SlotType): string {
  const names: Record<SlotType, string> = {
    BODY: '柱身',
    BASE: '底座',
    CAP: '盖帽',
  };
  return names[slot] || slot;
}

/**
 * 解析产品图片字段
 */
function parseProductImages(images: string | null): string[] {
  if (!images) return [];
  try {
    const parsed = JSON.parse(images);
    if (Array.isArray(parsed)) {
      return parsed
        .map((img: unknown) => {
          if (typeof img === 'string') return img;
          if (img && typeof img === 'object' && 'url' in img) {
            return (img as { url: string }).url;
          }
          return '';
        })
        .filter(Boolean);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * 搜索素材（罗马柱产品）
 */
export async function searchMaterials(
  params: MaterialSearchParams,
  userId?: string
): Promise<{
  data: MaterialResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  const {
    keyword,
    slot,
    heightRange,
    page = 1,
    pageSize = 20,
    sortBy = 'code',
    sortOrder = 'asc',
  } = params;

  // 构建查询条件
  const where: Prisma.ProductWhereInput = {
    status: 'active',
  };

  // 关键词搜索
  if (keyword) {
    where.OR = [
      { code: { contains: keyword } },
      { name: { contains: keyword } },
    ];
  }

  // 位置筛选（通过分类）
  if (slot && slot !== 'ALL') {
    const slotKeywords: Record<SlotType, string[]> = {
      BODY: ['柱身', 'BODY', '柱'],
      BASE: ['底座', 'BASE', '底'],
      CAP: ['盖帽', 'CAP', '盖', '顶'],
    };
    const keywords = slotKeywords[slot];
    if (keywords) {
      where.category = {
        OR: keywords.map(k => ({
          OR: [{ code: { contains: k } }, { name: { contains: k } }],
        })),
      };
    }
  }

  // 高度筛选
  if (heightRange && heightRange !== 'ALL') {
    const heightValue = parseInt(heightRange, 10);
    if (!isNaN(heightValue)) {
      // thickness 字段存储高度（mm）
      where.thickness = {
        gte: heightValue - 50,
        lte: heightValue + 50,
      };
    }
  }

  // 查询总数
  const total = await prisma.product.count({ where });

  // 构建排序
  const orderBy: Prisma.ProductOrderByWithRelationInput = {};
  if (sortBy === 'height') {
    orderBy.thickness = sortOrder;
  } else if (sortBy === 'code') {
    orderBy.code = sortOrder;
  } else {
    orderBy.createdAt = sortOrder;
  }

  // 查询数据
  const products = await prisma.product.findMany({
    where,
    include: {
      category: {
        select: { id: true, code: true, name: true },
      },
    },
    orderBy,
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  // 查询用户收藏状态
  let favoriteProductIds = new Set<string>();
  if (userId) {
    const favorites = await prisma.productFavorite.findMany({
      where: { userId },
      select: { productId: true },
    });
    favoriteProductIds = new Set(favorites.map(f => f.productId));
  }

  // 转换为素材响应
  const data: MaterialResponse[] = products.map(product => {
    const slot = inferSlotFromCategory(product.category?.code);
    const images = parseProductImages(product.images);

    return {
      id: product.id,
      code: product.code,
      name: product.name,
      slot,
      slotName: getSlotName(slot),
      height: product.thickness ? Number(product.thickness) : 800,
      faceWidth: 400, // 默认面型宽度
      cuttable: true, // 默认可切
      cutRecommend: slot === 'BODY',
      image: product.thumbnailUrl || images[0] || '',
      images,
      usageCount: 0, // TODO: 从订单统计
      isFavorite: favoriteProductIds.has(product.id),
      scenarios: [],
    };
  });

  return {
    data,
    pagination: {
      page,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * 获取素材详情
 */
export async function getMaterialDetail(
  materialId: string,
  userId?: string
): Promise<MaterialResponse | null> {
  const product = await prisma.product.findUnique({
    where: { id: materialId },
    include: {
      category: {
        select: { id: true, code: true, name: true },
      },
    },
  });

  if (!product) return null;

  // 查询收藏状态
  let isFavorite = false;
  if (userId) {
    const favorite = await prisma.productFavorite.findUnique({
      where: {
        userId_productId: { userId, productId: materialId },
      },
    });
    isFavorite = !!favorite;
  }

  const slot = inferSlotFromCategory(product.category?.code);
  const images = parseProductImages(product.images);

  return {
    id: product.id,
    code: product.code,
    name: product.name,
    slot,
    slotName: getSlotName(slot),
    height: product.thickness ? Number(product.thickness) : 800,
    faceWidth: 400,
    cuttable: true,
    cutRecommend: slot === 'BODY',
    image: product.thumbnailUrl || images[0] || '',
    images,
    usageCount: 0,
    isFavorite,
    scenarios: [],
  };
}

/**
 * 生成用砖方案
 */
export async function generateScheme(
  request: GenerateSchemeRequest
): Promise<GenerateSchemeResponse> {
  const { targetHeight, faceTypes } = request;

  // 计算用砖高度
  let buildHeight = 0;
  const brickList: FaceTypeBrickList[] = [];

  for (const faceType of faceTypes) {
    const items: BrickListItem[] = [];
    let faceHeight = 0;

    // 处理每个位置
    for (const slotType of ['CAP', 'BODY', 'BASE'] as SlotType[]) {
      const material = faceType.materials[slotType];
      if (material.code && material.segments > 0) {
        const height =
          material.height ||
          (slotType === 'BODY' ? 800 : slotType === 'CAP' ? 300 : 200);
        const slotHeight = height * material.segments;
        faceHeight += slotHeight;

        items.push({
          slot: slotType,
          slotDesc: getSlotName(slotType),
          code: material.code,
          quantity: material.segments * faceType.faces,
          totalHeight: slotHeight,
        });
      }
    }

    buildHeight = Math.max(buildHeight, faceHeight);

    brickList.push({
      faceType: faceType.id,
      faceTypeDesc: faceType.name,
      items,
    });
  }

  // 计算差值
  const delta = buildHeight - targetHeight;

  // 确定切割位置（如果需要）
  let cutPosition: SlotType | null = null;
  if (delta > 0) {
    // 优先切割柱身
    cutPosition = 'BODY';

    // 更新用砖清单，添加切割说明
    for (const faceGroup of brickList) {
      const bodyItem = faceGroup.items.find(item => item.slot === 'BODY');
      if (bodyItem) {
        bodyItem.cutHeight = delta;
        bodyItem.note = `需切割 ${delta}mm`;
      }
    }
  }

  return {
    targetHeight,
    buildHeight,
    delta,
    cutPosition,
    brickList,
  };
}

/**
 * 修改切割位置
 */
export async function changeCutPosition(
  request: GenerateSchemeRequest & { cutPosition: SlotType }
): Promise<GenerateSchemeResponse> {
  const baseScheme = await generateScheme(request);

  if (baseScheme.delta <= 0) {
    return baseScheme;
  }

  // 清除原有切割说明
  for (const faceGroup of baseScheme.brickList) {
    for (const item of faceGroup.items) {
      item.cutHeight = undefined;
      item.note = undefined;
    }
  }

  // 更新新的切割位置
  baseScheme.cutPosition = request.cutPosition;
  for (const faceGroup of baseScheme.brickList) {
    const targetItem = faceGroup.items.find(
      item => item.slot === request.cutPosition
    );
    if (targetItem) {
      targetItem.cutHeight = baseScheme.delta;
      targetItem.note = `需切割 ${baseScheme.delta}mm`;
    }
  }

  return baseScheme;
}
