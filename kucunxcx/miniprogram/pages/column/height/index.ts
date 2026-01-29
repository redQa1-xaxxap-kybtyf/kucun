/**
 * Step 1: 输入目标高度
 */

import type { ColumnBuildState } from '../../../types/column';
import {
  formatHeight,
  MAX_HEIGHT,
  MIN_HEIGHT,
  validateHeight,
} from '../../../utils/column-calculator';

const app = getApp<IAppOption>();

/** 预设高度选项（mm） */
const HEIGHT_PRESETS = [2800, 3000, 3200, 3600];

Page({
  data: {
    /** 目标高度（mm） */
    targetHeight: 3000,
    /** 高度输入字符串 */
    heightInput: '3000',
    /** 预设高度选项 */
    heightPresets: HEIGHT_PRESETS,
    /** 选中的预设索引 */
    selectedPresetIndex: 1, // 默认选中 3000
    /** 错误信息 */
    errorMessage: '',
    /** 是否显示确认弹窗 */
    showConfirmModal: false,
    /** 确认弹窗消息 */
    confirmMessage: '',
    /** 最小高度 */
    minHeight: MIN_HEIGHT,
    /** 最大高度 */
    maxHeight: MAX_HEIGHT,
  },

  onLoad() {
    // 恢复之前的状态（如果有）
    const state = app.globalData.columnBuildState;
    if (state && state.targetHeight > 0) {
      const presetIndex = HEIGHT_PRESETS.indexOf(state.targetHeight);
      this.setData({
        targetHeight: state.targetHeight,
        heightInput: String(state.targetHeight),
        selectedPresetIndex: presetIndex,
      });
    }
  },

  /**
   * 选择预设高度
   */
  onPresetTap(e: WechatMiniprogram.TouchEvent) {
    const { index, height } = e.currentTarget.dataset;
    this.setData({
      targetHeight: height,
      heightInput: String(height),
      selectedPresetIndex: index,
      errorMessage: '',
    });
  },

  /**
   * 高度输入变化
   */
  onHeightInput(e: WechatMiniprogram.Input) {
    const value = e.detail.value.replace(/[^\d]/g, '');
    const height = parseInt(value, 10) || 0;

    // 检查是否匹配预设
    const presetIndex = HEIGHT_PRESETS.indexOf(height);

    this.setData({
      heightInput: value,
      targetHeight: height,
      selectedPresetIndex: presetIndex,
      errorMessage: '',
    });
  },

  /**
   * 高度输入失焦时验证
   */
  onHeightBlur() {
    const { targetHeight } = this.data;

    if (targetHeight > 0) {
      const result = validateHeight(targetHeight);
      if (!result.valid) {
        this.setData({ errorMessage: result.message || '' });
      }
    }
  },

  /**
   * 点击下一步
   */
  onNextStep() {
    const { targetHeight } = this.data;

    // 验证高度
    const result = validateHeight(targetHeight);

    if (!result.valid) {
      this.setData({ errorMessage: result.message || '' });
      return;
    }

    // 需要二次确认
    if (result.needConfirm) {
      this.setData({
        showConfirmModal: true,
        confirmMessage: result.message || '',
      });
      return;
    }

    // 直接进入下一步
    this.navigateToNextStep();
  },

  /**
   * 确认继续
   */
  onConfirmContinue() {
    this.setData({ showConfirmModal: false });
    this.navigateToNextStep();
  },

  /**
   * 取消确认
   */
  onCancelConfirm() {
    this.setData({ showConfirmModal: false });
  },

  /**
   * 导航到下一步
   */
  navigateToNextStep() {
    const { targetHeight } = this.data;

    // 更新全局状态
    const state: ColumnBuildState = {
      step: 2,
      targetHeight,
      faceTypes: [],
      currentFaceTypeIndex: 0,
      currentSlot: 'BODY',
      buildHeight: 0,
      delta: -targetHeight, // 初始差值为负（高度不足）
    };
    app.globalData.columnBuildState = state;

    wx.navigateTo({
      url: '/pages/column/build/index',
    });
  },

  /**
   * 返回上一步
   */
  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  /**
   * 格式化高度显示
   */
  formatHeight(mm: number): string {
    return formatHeight(mm);
  },
});
