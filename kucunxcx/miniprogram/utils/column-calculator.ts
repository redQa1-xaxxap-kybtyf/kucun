/**
 * 罗马柱高度/切割计算工具
 */

import type { DeltaStatus, FaceType, SlotType } from '../types/column';

/** 柱身标准高度（mm） */
export const BODY_UNIT_HEIGHT = 800;
/** 底座标准高度（mm） */
export const BASE_UNIT_HEIGHT = 200;
/** 盖帽标准高度（mm） */
export const CAP_UNIT_HEIGHT = 300;
/** 柱头标准高度（mm） */
export const HEAD_UNIT_HEIGHT = 300;

/** 最小高度（mm） */
export const MIN_HEIGHT = 500;
/** 最大高度（mm） */
export const MAX_HEIGHT = 6000;
/** 二次确认高度阈值（mm） */
export const CONFIRM_HEIGHT_THRESHOLD = 3600;

/**
 * 获取位置的标准单位高度
 */
export function getSlotUnitHeight(slot: SlotType): number {
  switch (slot) {
    case 'BODY':
      return BODY_UNIT_HEIGHT;
    case 'BASE':
      return BASE_UNIT_HEIGHT;
    case 'CAP':
      return CAP_UNIT_HEIGHT;
    case 'HEAD':
      return HEAD_UNIT_HEIGHT;
    default:
      return 0;
  }
}

/**
 * 计算单个位置的高度
 */
export function calculateSlotHeight(
  slot: SlotType,
  segments: number,
  customUnitHeight?: number
): number {
  const unitHeight = customUnitHeight ?? getSlotUnitHeight(slot);
  return segments * unitHeight;
}

/**
 * 计算单面用砖高度
 */
export function calculateFaceHeight(faceType: FaceType): number {
  const bodyHeight = calculateSlotHeight(
    'BODY',
    faceType.materials.BODY.segments,
    faceType.materials.BODY.height
  );
  const baseHeight = calculateSlotHeight(
    'BASE',
    faceType.materials.BASE.segments,
    faceType.materials.BASE.height
  );
  const capHeight = calculateSlotHeight(
    'CAP',
    faceType.materials.CAP.segments,
    faceType.materials.CAP.height
  );
  const headHeight = calculateSlotHeight(
    'HEAD',
    faceType.materials.HEAD.segments,
    faceType.materials.HEAD.height
  );

  return bodyHeight + baseHeight + capHeight + headHeight;
}

/**
 * 计算总用砖高度
 * 注意：所有面型高度应一致，取第一个面型的高度
 */
export function calculateTotalHeight(faceTypes: FaceType[]): number {
  if (faceTypes.length === 0) return 0;
  return calculateFaceHeight(faceTypes[0]);
}

/**
 * 计算高度差值
 */
export function calculateDelta(
  targetHeight: number,
  buildHeight: number
): number {
  return buildHeight - targetHeight;
}

/**
 * 获取高度差值状态描述
 */
export function getDeltaStatus(
  delta: number,
  buildHeight: number
): DeltaStatus {
  if (buildHeight === 0) {
    return { status: 'empty', message: '请选择素材以开始拼柱' };
  }
  if (delta === 0) {
    return { status: 'perfect', message: '高度完美匹配' };
  } else if (delta > 0) {
    return { status: 'cut', message: `超出 ${delta}mm（需切割）` };
  } else {
    return { status: 'insufficient', message: `不足 ${Math.abs(delta)}mm` };
  }
}

/**
 * 计算推荐的柱身段数
 */
export function calculateRecommendedBodySegments(
  targetHeight: number,
  baseHeight: number = BASE_UNIT_HEIGHT,
  capHeight: number = CAP_UNIT_HEIGHT,
  headHeight: number = HEAD_UNIT_HEIGHT,
  bodyUnitHeight: number = BODY_UNIT_HEIGHT
): number {
  const remaining = targetHeight - baseHeight - capHeight - headHeight;
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / bodyUnitHeight);
}

/**
 * 验证高度输入
 */
export function validateHeight(height: number): {
  valid: boolean;
  message?: string;
  needConfirm?: boolean;
} {
  if (isNaN(height) || height <= 0) {
    return { valid: false, message: '请输入有效的高度' };
  }
  if (height < MIN_HEIGHT) {
    return { valid: false, message: `高度不能低于 ${MIN_HEIGHT}mm` };
  }
  if (height > MAX_HEIGHT) {
    return { valid: false, message: `高度不能超过 ${MAX_HEIGHT}mm` };
  }
  if (height > CONFIRM_HEIGHT_THRESHOLD) {
    return {
      valid: true,
      needConfirm: true,
      message: `高度超过 ${CONFIRM_HEIGHT_THRESHOLD / 1000}m，建议分段制作，是否继续？`,
    };
  }
  return { valid: true };
}

/**
 * 创建默认面型配置
 */
export function createDefaultFaceType(
  id: string,
  name: string,
  width: number,
  faces: number = 1
): FaceType {
  return {
    id,
    name,
    width,
    faces,
    materials: {
      BODY: { code: '', segments: 0 },
      BASE: { code: '', segments: 1 },
      CAP: { code: '', segments: 1 },
      HEAD: { code: '', segments: 1 },
    },
  };
}

/**
 * 检查面型配置是否完整
 */
export function isFaceTypeComplete(faceType: FaceType): boolean {
  const { BODY, BASE, CAP, HEAD } = faceType.materials;
  return (
    BODY.code !== '' &&
    BODY.segments > 0 &&
    BASE.code !== '' &&
    BASE.segments > 0 &&
    BASE.segments > 0 &&
    CAP.code !== '' &&
    CAP.segments > 0 &&
    HEAD.code !== '' &&
    HEAD.segments > 0
  );
}

/**
 * 检查所有面型配置是否完整
 */
export function areAllFaceTypesComplete(faceTypes: FaceType[]): boolean {
  if (faceTypes.length === 0) return false;
  return faceTypes.every(isFaceTypeComplete);
}

/**
 * 获取位置中文名称
 */
export function getSlotName(slot: SlotType): string {
  const names: Record<SlotType, string> = {
    BODY: '柱身',
    BASE: '底座',
    CAP: '盖帽',
    HEAD: '柱头',
  };
  return names[slot] || slot;
}

/**
 * 格式化高度显示（mm → m）
 */
export function formatHeight(mm: number): string {
  if (mm >= 1000) {
    return `${(mm / 1000).toFixed(1)}m`;
  }
  return `${mm}mm`;
}
