'use strict';
/**
 * 罗马柱高度/切割计算工具
 */
Object.defineProperty(exports, '__esModule', { value: true });
exports.CONFIRM_HEIGHT_THRESHOLD =
  exports.MAX_HEIGHT =
  exports.MIN_HEIGHT =
  exports.HEAD_UNIT_HEIGHT =
  exports.CAP_UNIT_HEIGHT =
  exports.BASE_UNIT_HEIGHT =
  exports.BODY_UNIT_HEIGHT =
    void 0;
exports.getSlotUnitHeight = getSlotUnitHeight;
exports.calculateSlotHeight = calculateSlotHeight;
exports.calculateFaceHeight = calculateFaceHeight;
exports.calculateTotalHeight = calculateTotalHeight;
exports.calculateDelta = calculateDelta;
exports.getDeltaStatus = getDeltaStatus;
exports.calculateRecommendedBodySegments = calculateRecommendedBodySegments;
exports.validateHeight = validateHeight;
exports.createDefaultFaceType = createDefaultFaceType;
exports.isFaceTypeComplete = isFaceTypeComplete;
exports.areAllFaceTypesComplete = areAllFaceTypesComplete;
exports.getSlotName = getSlotName;
exports.formatHeight = formatHeight;
/** 柱身标准高度（mm） */
exports.BODY_UNIT_HEIGHT = 800;
/** 底座标准高度（mm） */
exports.BASE_UNIT_HEIGHT = 200;
/** 盖帽标准高度（mm） */
exports.CAP_UNIT_HEIGHT = 300;
/** 柱头标准高度（mm） */
exports.HEAD_UNIT_HEIGHT = 300;
/** 最小高度（mm） */
exports.MIN_HEIGHT = 500;
/** 最大高度（mm） */
exports.MAX_HEIGHT = 6000;
/** 二次确认高度阈值（mm） */
exports.CONFIRM_HEIGHT_THRESHOLD = 3600;
/**
 * 获取位置的标准单位高度
 */
function getSlotUnitHeight(slot) {
  switch (slot) {
    case 'BODY':
      return exports.BODY_UNIT_HEIGHT;
    case 'BASE':
      return exports.BASE_UNIT_HEIGHT;
    case 'CAP':
      return exports.CAP_UNIT_HEIGHT;
    case 'HEAD':
      return exports.HEAD_UNIT_HEIGHT;
    default:
      return 0;
  }
}
/**
 * 计算单个位置的高度
 */
function calculateSlotHeight(slot, segments, customUnitHeight) {
  const unitHeight = customUnitHeight ?? getSlotUnitHeight(slot);
  return segments * unitHeight;
}
/**
 * 计算单面用砖高度
 */
function calculateFaceHeight(faceType) {
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
function calculateTotalHeight(faceTypes) {
  if (faceTypes.length === 0) return 0;
  return calculateFaceHeight(faceTypes[0]);
}
/**
 * 计算高度差值
 */
function calculateDelta(targetHeight, buildHeight) {
  return buildHeight - targetHeight;
}
/**
 * 获取高度差值状态描述
 */
function getDeltaStatus(delta, buildHeight) {
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
function calculateRecommendedBodySegments(
  targetHeight,
  baseHeight = exports.BASE_UNIT_HEIGHT,
  capHeight = exports.CAP_UNIT_HEIGHT,
  headHeight = exports.HEAD_UNIT_HEIGHT,
  bodyUnitHeight = exports.BODY_UNIT_HEIGHT
) {
  const remaining = targetHeight - baseHeight - capHeight - headHeight;
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / bodyUnitHeight);
}
/**
 * 验证高度输入
 */
function validateHeight(height) {
  if (isNaN(height) || height <= 0) {
    return { valid: false, message: '请输入有效的高度' };
  }
  if (height < exports.MIN_HEIGHT) {
    return { valid: false, message: `高度不能低于 ${exports.MIN_HEIGHT}mm` };
  }
  if (height > exports.MAX_HEIGHT) {
    return { valid: false, message: `高度不能超过 ${exports.MAX_HEIGHT}mm` };
  }
  if (height > exports.CONFIRM_HEIGHT_THRESHOLD) {
    return {
      valid: true,
      needConfirm: true,
      message: `高度超过 ${exports.CONFIRM_HEIGHT_THRESHOLD / 1000}m，建议分段制作，是否继续？`,
    };
  }
  return { valid: true };
}
/**
 * 创建默认面型配置
 */
function createDefaultFaceType(id, name, width, faces = 1) {
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
function isFaceTypeComplete(faceType) {
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
function areAllFaceTypesComplete(faceTypes) {
  if (faceTypes.length === 0) return false;
  return faceTypes.every(isFaceTypeComplete);
}
/**
 * 获取位置中文名称
 */
function getSlotName(slot) {
  const names = {
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
function formatHeight(mm) {
  if (mm >= 1000) {
    return `${(mm / 1000).toFixed(1)}m`;
  }
  return `${mm}mm`;
}
