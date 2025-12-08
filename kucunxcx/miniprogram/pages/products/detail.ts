// products/detail.ts
// 产品详情页

import authService from '../../services/auth.service';
import productService from '../../services/product.service';
import userService from '../../services/user.service';
import type { ProductDetail } from '../../types/product';

Page({
  data: {
    productId: '',
    product: null as ProductDetail | null,
    loading: false,
    // 是否允许查看数字库存（仅 admin / sales）
    canViewNumericInventory: false,
  },

  onLoad(options: any) {
    if (options.id) {
      const canView = authService.canViewNumericInventory();
      this.setData({ productId: options.id, canViewNumericInventory: canView });
      this.loadProductDetail();
    } else {
      wx.showToast({
        title: '产品ID缺失',
        icon: 'none',
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 加载产品详情
  async loadProductDetail() {
    this.setData({ loading: true });

    try {
      // 调用产品详情API
      const product = await productService.getProductDetail(
        this.data.productId
      );

      this.setData({ product });

      // 调用后端记录浏览历史（忽略失败，避免影响主流程）
      try {
        await userService.addHistory(product.id);
      } catch (historyError) {
        console.error('记录浏览历史失败:', historyError);
      }

      // 更新导航栏标题为产品名称
      wx.setNavigationBarTitle({
        title: product.name,
      });
    } catch (error) {
      console.error('加载产品详情失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
        duration: 2000,
      });

      // 失败后返回上一页
      setTimeout(() => {
        wx.navigateBack();
      }, 2000);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 预览图片
  previewImage(e: any) {
    const { url } = e.currentTarget.dataset;
    const product = this.data.product;
    if (product && product.images && product.images.length > 0) {
      wx.previewImage({
        current: url,
        urls: product.images,
      });
    }
  },

  // 联系客服
  onContactService() {
    wx.showToast({
      title: '客服功能开发中',
      icon: 'none',
    });
  },

  // 收藏（调用后端接口）
  async onFavorite() {
    const product = this.data.product;
    if (!product) {
      return;
    }

    try {
      const result = await userService.toggleFavorite(product.id);
      wx.showToast({
        title: result.isFavorite ? '收藏成功' : '已取消收藏',
        icon: result.isFavorite ? 'success' : 'none',
      });
    } catch (error) {
      console.error('更新收藏状态失败:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none',
      });
    }
  },

  // 查看库存详情
  navigateToInventory() {
    wx.navigateTo({
      url: `/pages/inventory/list?productId=${this.data.productId}`,
    });
  },

  // 分享
  onShareAppMessage() {
    const product = this.data.product;
    return {
      title: product?.name || '产品详情',
      path: `/pages/products/detail?id=${this.data.productId}`,
      imageUrl: product?.thumbnailUrl || '',
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    const product = this.data.product;
    return {
      title: product?.name || '产品详情',
      // 朋友圈只支持 query，不支持 path
      query: `id=${this.data.productId}`,
      imageUrl: product?.thumbnailUrl || '',
    };
  },
});
