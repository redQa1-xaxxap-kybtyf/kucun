// 罗马柱（快速拼柱）相关类型定义

import type { PaginationParams, SortParams } from './common';

/**
 * 位置类型
 * - BODY: 柱身
 * - BASE: 底座
 * - CAP: 盖帽
 * - HEAD: 柱头
 */
export type SlotType = 'BODY' | 'BASE' | 'CAP' | 'HEAD';

/**
 * 素材（罗马柱产品）
 */
export interface Material {
  id: string;
  /** 产品编号 */
  code: string;
  /** 产品名称 */
  name: string;
  /** 所属位置 */
  slot: SlotType;
  /** 位置名称（柱身/底座/盖帽） */
  slotName: string;
  /** 高度（mm） */
  height: number;
  /** 面型宽度（mm） */
  faceWidth: number;
  /** 是否可切 */
  cuttable: boolean;
  /** 是否推荐切割 */
  cutRecommend?: boolean;
  /** 缩略图 */
  image: string;
  /** 图片列表 */
  images?: string[];
  /** 使用次数 */
  usageCount?: number;
  /** 是否已收藏 */
  isFavorite?: boolean;
  /** 应用场景 */
  scenarios?: string[];
  /** 材质 */
  material?: string;
}

/**
 * 已选素材
 */
export interface SelectedMaterial {
  /** 素材编号 */
  code: string;
  /** 素材 ID */
  id?: string;
  /** 段数 */
  segments: number;
  /** 素材高度（mm） */
  height?: number;
}

/**
 * 面型配置
 */
export interface FaceType {
  /** 面型 ID */
  id: string;
  /** 面型名称（正面/侧面） */
  name: string;
  /** 宽度（mm） */
  width: number;
  /** 面数 */
  faces: number;
  /** 各位置选择的素材 */
  materials: {
    BODY: SelectedMaterial;
    BASE: SelectedMaterial;
    CAP: SelectedMaterial;
    HEAD: SelectedMaterial;
  };
}

/**
 * 生成方案请求参数
 */
export interface GenerateSchemeRequest {
  /** 目标高度（mm） */
  targetHeight: number;
  /** 面型配置列表 */
  faceTypes: FaceType[];
}

/**
 * 用砖清单项
 */
export interface BrickListItem {
  /** 位置 */
  slot: SlotType;
  /** 位置描述 */
  slotDesc: string;
  /** 素材编号 */
  code: string;
  /** 数量 */
  quantity: number;
  /** 总高度（mm） */
  totalHeight?: number;
  /** 切割高度（mm） */
  cutHeight?: number;
  /** 备注 */
  note?: string;
}

/**
 * 用砖清单（按面型分组）
 */
export interface FaceTypeBrickList {
  /** 面型 ID */
  faceType: string;
  /** 面型描述 */
  faceTypeDesc: string;
  /** 清单项 */
  items: BrickListItem[];
}

/**
 * 生成方案响应
 */
export interface GenerateSchemeResponse {
  /** 目标高度（mm） */
  targetHeight: number;
  /** 用砖高度（mm） */
  buildHeight: number;
  /** 高度差（mm），正数需切割，负数高度不足 */
  delta: number;
  /** 切割位置 */
  cutPosition: SlotType | null;
  /** 用砖清单 */
  brickList: FaceTypeBrickList[];
}

/**
 * 素材搜索参数
 */
export interface MaterialSearchParams
  extends Partial<PaginationParams>,
    Partial<SortParams> {
  /** 搜索关键词 */
  keyword?: string;
  /** 位置筛选 */
  slot?: SlotType | 'ALL';
  /** 高度区间 */
  heightRange?: string;
  /** 是否可切 */
  cuttable?: boolean | 'ALL';
  /** 面型宽度 */
  faceWidth?: number;
  /** 每页数量 */
  pageSize?: number;
  /** 排序字段 */
  sortField?: 'code' | 'height' | 'usageCount';
}

/**
 * 拼柱全局状态
 */
export interface ColumnBuildState {
  /** 当前步骤 */
  step: 1 | 2 | 3;
  /** 目标高度（mm） */
  targetHeight: number;
  /** 面型配置列表 */
  faceTypes: FaceType[];
  /** 当前编辑的面型索引 */
  currentFaceTypeIndex: number;
  /** 当前选择的位置 */
  currentSlot: SlotType;
  /** 当前用砖高度（mm） */
  buildHeight: number;
  /** 高度差值（mm） */
  delta: number;
}

/**
 * 高度差值状态
 */
export interface DeltaStatus {
  /** 状态：完美匹配/需切割/高度不足/未开始 */
  status: 'perfect' | 'cut' | 'insufficient' | 'empty';
  /** 状态描述 */
  message: string;
}

/**
 * 方案保存请求
 */
export interface SaveSchemeRequest {
  /** 方案名称 */
  name: string;
  /** 目标高度 */
  targetHeight: number;
  /** 面型配置 */
  faceTypes: FaceType[];
  /** 生成的用砖清单 */
  brickList: FaceTypeBrickList[];
}

/**
 * 已保存方案
 */
export interface SavedScheme {
  id: string;
  name: string;
  targetHeight: number;
  createdAt: string;
  updatedAt: string;
}
