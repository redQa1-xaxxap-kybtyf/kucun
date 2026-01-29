/**
 * Step 3: 用砖清单结果页
 */

import columnService from '../../../services/column.service';
import type {
  FaceTypeBrickList,
  GenerateSchemeResponse,
  SlotType,
} from '../../../types/column';
import { getSlotName } from '../../../utils/column-calculator';

const app = getApp<IAppOption>();

Page({
  data: {
    /** 方案结果 */
    scheme: null as GenerateSchemeResponse | null,
    /** 目标高度 */
    targetHeight: 0,
    /** 用砖高度 */
    buildHeight: 0,
    /** 高度差值 */
    delta: 0,
    /** 切割位置 */
    cutPosition: '' as string,
    /** 用砖清单 */
    brickList: [] as FaceTypeBrickList[],

    /** 是否显示切割位置弹层 */
    showCutPositionPicker: false,
    /** 可选的切割位置 */
    cuttableSlots: [] as { type: SlotType; name: string }[],

    /** 保存中 */
    saving: false,
  },

  onLoad() {
    // 从全局状态获取结果
    const scheme = app.globalData.columnSchemeResult;
    if (!scheme) {
      wx.showToast({ title: '请先生成方案', icon: 'none' });
      wx.navigateBack({ delta: 1 });
      return;
    }

    this.setData({
      scheme,
      targetHeight: scheme.targetHeight,
      buildHeight: scheme.buildHeight,
      delta: scheme.delta,
      cutPosition: scheme.cutPosition ? getSlotName(scheme.cutPosition) : '',
      brickList: scheme.brickList,
    });

    // 获取可切割位置
    this.loadCuttableSlots();
  },

  /**
   * 获取可切割位置列表
   */
  loadCuttableSlots() {
    // 目前支持柱身和底座切割
    this.setData({
      cuttableSlots: [
        { type: 'BODY', name: '柱身（推荐）' },
        { type: 'BASE', name: '底座' },
      ],
    });
  },

  /**
   * 打开切割位置选择
   */
  onChangeCutPosition() {
    const { delta } = this.data;
    if (delta <= 0) {
      wx.showToast({ title: '高度不足，无需切割', icon: 'none' });
      return;
    }
    this.setData({ showCutPositionPicker: true });
  },

  /**
   * 关闭切割位置选择
   */
  closeCutPositionPicker() {
    this.setData({ showCutPositionPicker: false });
  },

  /**
   * 选择新的切割位置
   */
  async onSelectCutPosition(e: WechatMiniprogram.TouchEvent) {
    const { slot } = e.currentTarget.dataset;
    const state = app.globalData.columnBuildState;

    if (!state) {
      wx.showToast({ title: '状态丢失，请返回重试', icon: 'none' });
      return;
    }

    this.setData({ showCutPositionPicker: false });
    wx.showLoading({ title: '重新计算中...' });

    try {
      const response = await columnService.changeCutPosition({
        targetHeight: state.targetHeight,
        faceTypes: state.faceTypes,
        cutPosition: slot,
      });

      // 更新结果
      app.globalData.columnSchemeResult = response;

      this.setData({
        scheme: response,
        targetHeight: response.targetHeight,
        buildHeight: response.buildHeight,
        delta: response.delta,
        cutPosition: response.cutPosition
          ? getSlotName(response.cutPosition)
          : '',
        brickList: response.brickList,
      });

      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      console.error('修改切割位置失败:', error);
      wx.showToast({ title: '修改失败，请重试', icon: 'none' });
    }
  },

  /**
   * 保存方案
   */
  async onSaveScheme() {
    const { scheme } = this.data;
    const state = app.globalData.columnBuildState;

    if (!scheme || !state) {
      wx.showToast({ title: '方案数据丢失', icon: 'none' });
      return;
    }

    this.setData({ saving: true });

    try {
      await columnService.saveScheme({
        name: `罗马柱方案 ${new Date().toLocaleDateString()}`,
        targetHeight: state.targetHeight,
        faceTypes: state.faceTypes,
        brickList: scheme.brickList,
      });

      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (error) {
      console.error('保存方案失败:', error);
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  /**
   * 分享方案
   */
  onShareScheme() {
    // 触发小程序分享
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline'],
    });
  },

  /**
   * 返回首页
   */
  onBackHome() {
    // 清理全局状态
    app.globalData.columnBuildState = undefined;
    app.globalData.columnSchemeResult = undefined;

    wx.navigateBack({
      delta: 3, // 返回到罗马柱首页
      fail: () => {
        wx.reLaunch({ url: '/pages/column/index/index' });
      },
    });
  },

  /**
   * 重新拼柱
   */
  onRebuild() {
    wx.navigateBack({ delta: 1 });
  },

  /**
   * 分享给好友
   */
  onShareAppMessage() {
    const { targetHeight } = this.data;
    return {
      title: `罗马柱用砖清单 - ${targetHeight}mm`,
      path: '/pages/column/index/index',
    };
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    const { targetHeight } = this.data;
    return {
      title: `罗马柱用砖清单 - ${targetHeight}mm`,
    };
  },
});
