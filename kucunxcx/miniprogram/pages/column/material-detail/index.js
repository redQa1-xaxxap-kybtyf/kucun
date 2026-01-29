'use strict';
/**
 * 产品详情页面
 * 展示罗马柱素材的详细信息
 */
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const column_service_1 = __importDefault(
  require('../../../services/column.service')
);
const column_calculator_1 = require('../../../utils/column-calculator');
const app = getApp();
Page({
  data: {
    /** 素材 ID */
    materialId: '',
    /** 素材详情 */
    material: null,
    /** 加载中 */
    loading: true,
    /** 当前展示的图片索引 */
    currentImageIndex: 0,
    /** 是否已收藏 */
    isFavorite: false,
    /** 是否从拼柱页面跳转过来 */
    fromBuild: false,
    /** 选择的位置 */
    targetSlot: '',
  },
  onLoad(options) {
    const id = options.id;
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' });
      wx.navigateBack({ delta: 1 });
      return;
    }
    this.setData({ materialId: id });
    // 检查是否从拼柱页面跳转
    if (options.slot) {
      this.setData({
        fromBuild: true,
        targetSlot: options.slot,
      });
    }
    this.loadMaterialDetail(id);
  },
  /**
   * 加载素材详情
   */
  async loadMaterialDetail(id) {
    this.setData({ loading: true });
    try {
      const material = await column_service_1.default.getMaterialDetail(id);
      this.setData({
        material,
        isFavorite: material.isFavorite || false,
        loading: false,
      });
    } catch (error) {
      console.error('加载素材详情失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },
  /**
   * 图片轮播变化
   */
  onSwiperChange(e) {
    this.setData({ currentImageIndex: e.detail.current });
  },
  /**
   * 预览图片
   */
  onPreviewImage(e) {
    const { index } = e.currentTarget.dataset;
    const { material } = this.data;
    if (!material || !material.images?.length) return;
    wx.previewImage({
      current: material.images[index],
      urls: material.images,
    });
  },
  /**
   * 切换收藏
   */
  async toggleFavorite() {
    const { materialId, isFavorite } = this.data;
    try {
      if (isFavorite) {
        await column_service_1.default.removeFavorite(materialId);
        wx.showToast({ title: '已取消收藏', icon: 'success' });
      } else {
        await column_service_1.default.addFavorite(materialId);
        wx.showToast({ title: '已收藏', icon: 'success' });
      }
      this.setData({ isFavorite: !isFavorite });
    } catch (error) {
      console.error('收藏操作失败:', error);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },
  /**
   * 添加到拼柱方案
   */
  onAddToScheme() {
    const { material, fromBuild, targetSlot } = this.data;
    if (!material) return;
    if (fromBuild && targetSlot) {
      // 从拼柱页面跳转过来，更新状态并返回
      const state = app.globalData.columnBuildState;
      if (state) {
        const faceTypes = [...state.faceTypes];
        const faceType = { ...faceTypes[state.currentFaceTypeIndex] };
        faceType.materials = { ...faceType.materials };
        faceType.materials[targetSlot] = {
          code: material.code,
          id: material.id,
          segments: faceType.materials[targetSlot].segments || 1,
          height: material.height,
        };
        faceTypes[state.currentFaceTypeIndex] = faceType;
        app.globalData.columnBuildState = { ...state, faceTypes };
      }
      wx.navigateBack({ delta: 2 }); // 返回到拼柱页面
      wx.showToast({ title: '已添加', icon: 'success' });
    } else {
      // 普通浏览模式，显示选择弹窗
      wx.showActionSheet({
        itemList: ['添加为柱身', '添加为底座', '添加为盖帽'],
        success: async res => {
          const slots = ['BODY', 'BASE', 'CAP'];
          const selectedSlot = slots[res.tapIndex];
          // 检查素材位置是否匹配
          if (material.slot !== selectedSlot) {
            wx.showModal({
              title: '提示',
              content: `该素材是${material.slotName}，是否确认添加为${(0, column_calculator_1.getSlotName)(selectedSlot)}？`,
              success: modalRes => {
                if (modalRes.confirm) {
                  this.addToNewScheme(selectedSlot);
                }
              },
            });
          } else {
            this.addToNewScheme(selectedSlot);
          }
        },
      });
    }
  },
  /**
   * 添加到新方案
   */
  addToNewScheme(slot) {
    const { material } = this.data;
    if (!material) return;
    // 跳转到快速拼柱页面
    wx.navigateTo({
      url: `/pages/column/height/index?preset=${material.code}&slot=${slot}`,
    });
    wx.showToast({ title: '请继续完成拼柱', icon: 'none' });
  },
  /**
   * 分享
   */
  onShareAppMessage() {
    const { material } = this.data;
    return {
      title: material ? `${material.code} - ${material.name}` : '罗马柱素材',
      path: `/pages/column/material-detail/index?id=${this.data.materialId}`,
    };
  },
  /**
   * 查看相关产品
   */
  onViewRelated(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/column/material-detail/index?id=${id}`,
    });
  },
  /**
   * 返回
   */
  onBack() {
    wx.navigateBack({ delta: 1 });
  },
});
