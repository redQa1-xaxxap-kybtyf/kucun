// products/detail.ts
// 产品详情页

import authService from '../../services/auth.service';
import productService from '../../services/product.service';
import userService from '../../services/user.service';
import { categoryService } from '../../services/category.service';
import type { ProductDetail } from '../../types/product';
import { formatDateTime } from '../../utils/format';

Page({
  data: {
    productId: '',
    product: null as ProductDetail | null,
    loading: false,
    // 是否允许查看数字库存（仅 admin / sales）
    canViewNumericInventory: false,
    // 是否允许编辑产品（仅 admin / sales）
    canEditProduct: false,
    // 1级分类名称（用于标题和分享）
    rootCategoryName: '',
    // 图片轮播相关
    currentImageIndex: 0,
    totalImages: 0,
    // 展示用的图片数组（缩略图 + 主图）
    displayImages: [] as string[],
  },

  onLoad(options: any) {
    // 开启右上角分享菜单（好友 + 朋友圈）
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline'],
    });

    if (options.id) {
      const canView = authService.canViewNumericInventory();
      const canEdit = authService.canEditProduct();
      this.setData({
        productId: options.id,
        canViewNumericInventory: canView,
        canEditProduct: canEdit,
      });
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
      const product = await productService.getProductDetail(this.data.productId);

      // 统一格式化“最后更新”时间，避免直接展示 ISO 字符串
      const normalized: ProductDetail = {
        ...product,
        updatedAt: product.updatedAt
          ? formatDateTime(product.updatedAt)
          : product.updatedAt,
      };

      this.setData({ product: normalized });

      // 初始化图片轮播状态
      // 如果有缩略图，将缩略图作为第一张，然后跟主图
      // 如果没有缩略图，直接使用主图
      const mainImages = normalized.mainImages || normalized.images || [];
      const thumbnailUrl = normalized.thumbnailUrl;

      let displayImages: string[] = [];
      if (thumbnailUrl) {
        // 有缩略图：缩略图放第一位，然后是主图（排除与缩略图相同的图片）
        displayImages = [thumbnailUrl, ...mainImages.filter(img => img !== thumbnailUrl)];
      } else {
        // 没有缩略图：直接使用主图
        displayImages = mainImages;
      }

      this.setData({
        displayImages,
        totalImages: displayImages.length,
        currentImageIndex: 0,
      });

      // 解析 1 级分类名称（根据当前分类向上追溯 parentId）
      void this.resolveRootCategory(normalized);

      // 调用后端记录浏览历史（忽略失败，避免影响主流程）
      try {
        await userService.addHistory(product.id);
      } catch (historyError) {
        console.error('记录浏览历史失败:', historyError);
      }

      // 更新导航栏标题：产品分类 + 产品编码（无分类时仅显示编码，兜底为产品名称）
      const titleParts: string[] = [];
      const rootCategoryName = this.data.rootCategoryName;
      if (rootCategoryName) {
        titleParts.push(rootCategoryName);
      } else if (product.category?.name) {
        // 兜底：还没解析到 1 级分类时，暂时使用当前分类
        titleParts.push(product.category.name);
      }
      if (product.code) {
        titleParts.push(product.code);
      }

      wx.setNavigationBarTitle({
        title:
          titleParts.length > 0
            ? titleParts.join(' · ')
            : product.name || '产品详情',
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

  // 解析并缓存当前产品的 1 级分类名称
  async resolveRootCategory(product: ProductDetail) {
    try {
      const categoryId = product.category?.id || product.categoryId;
      if (!categoryId) {
        this.setData({ rootCategoryName: '' });
        return;
      }

      const categories = await categoryService.getCategories();
      if (!Array.isArray(categories) || categories.length === 0) {
        this.setData({ rootCategoryName: '' });
        return;
      }

      const map = new Map<string, { id: string; name: string; parentId?: string }>();
      categories.forEach(cat => {
        map.set(cat.id, {
          id: cat.id,
          name: cat.name,
          parentId: cat.parentId,
        });
      });

      let current = map.get(categoryId);
      // 向上追溯直到 parentId 为空，得到 1 级分类
      const guard = 10; // 最多追溯 10 层，防止异常环路
      let steps = 0;
      while (current && current.parentId && map.has(current.parentId) && steps < guard) {
        current = map.get(current.parentId);
        steps++;
      }

      this.setData({
        rootCategoryName: current ? current.name : '',
      });
    } catch (error) {
      console.error('解析1级分类失败:', error);
      this.setData({ rootCategoryName: '' });
    }
  },

  // 预览图片
  previewImage(e: any) {
    const { url } = e.currentTarget.dataset;
    const displayImages = this.data.displayImages;
    if (displayImages && displayImages.length > 0) {
      wx.previewImage({
        current: url,
        urls: displayImages,
      });
    }
  },

  // 监听轮播图变化
  onSwiperChange(e: any) {
    this.setData({
      currentImageIndex: e.detail.current,
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

  // 编辑产品（仅管理员 / 销售显示入口）
  navigateToEdit() {
    if (!this.data.productId) return;
    // 复用创建页面，约定通过id参数进入编辑模式
    wx.navigateTo({
      url: `/pages/products/create?id=${this.data.productId}`,
    });
  },

  // 分享
  onShareAppMessage() {
    const product = this.data.product;
    const titleParts: string[] = [];
    const rootCategoryName = this.data.rootCategoryName;
    if (rootCategoryName) {
      titleParts.push(rootCategoryName);
    } else if (product?.category?.name) {
      titleParts.push(product.category.name);
    }
    if (product?.code) {
      titleParts.push(product.code);
    }
    const title =
      titleParts.length > 0
        ? titleParts.join(' · ')
        : product?.name || '产品详情';

    return {
      title,
      path: `/pages/products/detail?id=${this.data.productId}`,
      imageUrl: product?.thumbnailUrl || '',
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    const product = this.data.product;
    const titleParts: string[] = [];
    const rootCategoryName = this.data.rootCategoryName;
    if (rootCategoryName) {
      titleParts.push(rootCategoryName);
    } else if (product?.category?.name) {
      titleParts.push(product.category.name);
    }
    if (product?.code) {
      titleParts.push(product.code);
    }
    const title =
      titleParts.length > 0
        ? titleParts.join(' · ')
        : product?.name || '产品详情';

    return {
      title,
      // 朋友圈只支持 query，不支持 path
      query: `id=${this.data.productId}`,
      imageUrl: product?.thumbnailUrl || '',
    };
  },
});
