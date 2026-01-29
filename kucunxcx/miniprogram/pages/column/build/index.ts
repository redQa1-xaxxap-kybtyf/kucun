/**
 * Step 2: 拼柱页面
 * 选择柱身、底座、盖帽素材
 */

import columnService from '../../../services/column.service';
import type {
    FaceType,
    Material,
    SlotType
} from '../../../types/column';
import {
    areAllFaceTypesComplete,
    calculateDelta,
    calculateRecommendedBodySegments,
    calculateTotalHeight,
    createDefaultFaceType,
    getDeltaStatus,
    getSlotName
} from '../../../utils/column-calculator';

const app = getApp<IAppOption>();

/** 默认面型配置 */
const DEFAULT_FACE_TYPES: FaceType[] = [
  createDefaultFaceType('front', '正面', 400, 1),
];

Page({
  data: {
    /** 目标高度（mm） */
    targetHeight: 0,
    /** 当前用砖高度（mm） */
    buildHeight: 0,
    /** 高度差值（mm） */
    delta: 0,
    /** 差值状态 */
    deltaStatus: { status: 'empty', message: '请选择素材以开始拼柱' } as ReturnType<typeof getDeltaStatus>,

    /** 面型配置列表 */
    faceTypes: [] as FaceType[],
    /** 当前编辑的面型索引 */
    currentFaceTypeIndex: 0,
    /** 当前选择的位置 */
    currentSlot: 'BODY' as SlotType,

    /** 是否显示素材选择弹层 */
    showMaterialPicker: false,
    /** 当前位置可选素材 */
    availableMaterials: [] as Material[],
    /** 素材加载中 */
    loadingMaterials: false,

    /** 位置列表 */
    slots: [
      { type: 'CAP' as SlotType, name: '盖帽', icon: '🔝' },
      { type: 'HEAD' as SlotType, name: '柱头', icon: '🏛️' },
      { type: 'BODY' as SlotType, name: '柱身', icon: '📦' },
      { type: 'BASE' as SlotType, name: '底座', icon: '🔻' },
    ],

    /** 是否可以生成清单 */
    canGenerate: false,
  },

  onLoad() {
    // 从全局状态恢复
    const state = app.globalData.columnBuildState;
    if (!state || state.targetHeight <= 0) {
      wx.showToast({ title: '请先输入高度', icon: 'none' });
      wx.navigateBack({ delta: 1 });
      return;
    }

    // 初始化面型配置
    const faceTypes = state.faceTypes.length > 0 ? state.faceTypes : DEFAULT_FACE_TYPES;

    // 自动计算推荐的柱身段数
    if (faceTypes[0].materials.BODY.segments === 0) {
      const recommendedSegments = calculateRecommendedBodySegments(state.targetHeight);
      faceTypes[0].materials.BODY.segments = recommendedSegments;
    }

    this.setData({
      targetHeight: state.targetHeight,
      faceTypes,
      currentFaceTypeIndex: state.currentFaceTypeIndex,
      currentSlot: state.currentSlot || 'BODY',
    });

    this.recalculateHeight();
  },

  /**
   * 重新计算高度
   */
  recalculateHeight() {
    const { faceTypes, targetHeight } = this.data;
    const buildHeight = calculateTotalHeight(faceTypes);
    const delta = calculateDelta(targetHeight, buildHeight);
    const deltaStatus = getDeltaStatus(delta, buildHeight);
    const canGenerate = areAllFaceTypesComplete(faceTypes);

    this.setData({
      buildHeight,
      delta,
      deltaStatus,
      canGenerate,
    });
  },

  /**
   * 点击位置选择器
   */
  onSlotTap(e: WechatMiniprogram.TouchEvent) {
    const { slot } = e.currentTarget.dataset;
    this.setData({ currentSlot: slot });
    this.openMaterialPicker(slot);
  },

  /**
   * 打开素材选择弹层
   */
  async openMaterialPicker(slot: SlotType) {
    this.setData({
      showMaterialPicker: true,
      loadingMaterials: true,
      availableMaterials: [],
    });

    try {
      const { faceTypes, currentFaceTypeIndex } = this.data;
      const currentFaceType = faceTypes[currentFaceTypeIndex];
      const materials = await columnService.getMaterialsBySlot(slot, currentFaceType.width);

      this.setData({
        availableMaterials: materials,
        loadingMaterials: false,
      });
    } catch (error) {
      console.error('加载素材失败:', error);
      wx.showToast({ title: '加载素材失败', icon: 'none' });
      this.setData({
        showMaterialPicker: false,
        loadingMaterials: false,
      });
    }
  },

  /**
   * 关闭素材选择弹层
   */
  closeMaterialPicker() {
    this.setData({ showMaterialPicker: false });
  },

  /**
   * 选择素材
   */
  onMaterialSelect(e: WechatMiniprogram.TouchEvent) {
    const { material } = e.currentTarget.dataset as { material: Material };
    const { faceTypes, currentFaceTypeIndex, currentSlot } = this.data;

    // 更新当前面型的素材选择
    const updatedFaceTypes = [...faceTypes];
    const faceType = { ...updatedFaceTypes[currentFaceTypeIndex] };
    faceType.materials = { ...faceType.materials };
    faceType.materials[currentSlot] = {
      code: material.code,
      id: material.id,
      segments: faceType.materials[currentSlot].segments || 1,
      height: material.height,
    };
    updatedFaceTypes[currentFaceTypeIndex] = faceType;

    this.setData({
      faceTypes: updatedFaceTypes,
      showMaterialPicker: false,
    });

    this.recalculateHeight();
  },

  /**
   * 调整段数
   */
  onSegmentChange(e: WechatMiniprogram.TouchEvent) {
    const { slot, action } = e.currentTarget.dataset;
    const { faceTypes, currentFaceTypeIndex } = this.data;

    const updatedFaceTypes = [...faceTypes];
    const faceType = { ...updatedFaceTypes[currentFaceTypeIndex] };
    faceType.materials = { ...faceType.materials };

    const current = faceType.materials[slot as SlotType];
    let newSegments = current.segments;

    if (action === 'add') {
      newSegments = Math.min(newSegments + 1, 20);
    } else if (action === 'minus') {
      newSegments = Math.max(newSegments - 1, slot === 'BODY' ? 1 : 1);
    }

    faceType.materials[slot as SlotType] = { ...current, segments: newSegments };
    updatedFaceTypes[currentFaceTypeIndex] = faceType;

    this.setData({ faceTypes: updatedFaceTypes });
    this.recalculateHeight();
  },

  /**
   * 生成用砖清单
   */
  async onGenerateScheme() {
    const { targetHeight, faceTypes, canGenerate } = this.data;

    if (!canGenerate) {
      wx.showToast({ title: '请完成所有素材选择', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '生成中...' });

    try {
      const response = await columnService.generateScheme({
        targetHeight,
        faceTypes,
      });

      // 保存结果到全局状态
      app.globalData.columnSchemeResult = response;

      wx.hideLoading();
      wx.navigateTo({
        url: '/pages/column/result/index',
      });
    } catch (error) {
      wx.hideLoading();
      console.error('生成方案失败:', error);
      wx.showToast({ title: '生成失败，请重试', icon: 'none' });
    }
  },

  /**
   * 返回上一步
   */
  onBack() {
    // 保存当前状态
    const { targetHeight, faceTypes, currentFaceTypeIndex, currentSlot, buildHeight, delta } = this.data;
    app.globalData.columnBuildState = {
      step: 2,
      targetHeight,
      faceTypes,
      currentFaceTypeIndex,
      currentSlot,
      buildHeight,
      delta,
    };

    wx.navigateBack({ delta: 1 });
  },

  /**
   * 获取位置中文名称
   */
  getSlotName(slot: SlotType): string {
    return getSlotName(slot);
  },
});
