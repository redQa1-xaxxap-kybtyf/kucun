// products/create.ts
// 产品创建页

import authService from '../../services/auth.service';
import { categoryService } from '../../services/category.service';
import { productService } from '../../services/product.service';
import qiniuService from '../../services/qiniu-upload.service';
import type { Category } from '../../types/category';
import { getEnableBackdropBlur } from '../../utils/ui';

Page({
  data: {
    enableBackdropBlur: getEnableBackdropBlur(),
    // 是否为编辑模式
    isEditMode: false,
    productId: '',
    code: '',
    name: '',
    specification: '',
    description: '',
    thickness: '',
    categoryId: '',
    categoryName: '',
    categories: [] as Category[],
    submitting: false,
    // 图片相关
    thumbnailUrl: '',
    // backend 返回的上传记录（可选）
    uploadInfo: null as any,
    mainImages: [] as string[],
    effectImages: [] as string[],
    // 输入框焦点状态(用于浮动标签动画)
    focusStates: {
      code: false,
      name: false,
      specification: false,
      description: false,
      thickness: false,
    },
  },

  async onLoad(options: any) {
    // 未登录时跳转到登录页
    if (!authService.isLoggedIn()) {
      wx.reLaunch({
        url: '/pages/auth/login',
      });
      return;
    }

    // 必须是管理员或销售才可以创建 / 编辑产品
    if (!authService.canEditProduct()) {
      wx.showToast({
        title: '无权编辑产品',
        icon: 'none',
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    const isEditMode = !!options?.id;
    if (isEditMode) {
      this.setData({
        isEditMode: true,
        productId: options.id,
      });
      wx.setNavigationBarTitle({
        title: '编辑产品',
      });
      await this.loadCategories();
      await this.loadProductDetail(options.id);
    } else {
      wx.setNavigationBarTitle({
        title: '创建产品',
      });
      await this.loadCategories();
    }
  },

  async loadProductDetail(id: string) {
    try {
      const product = await productService.getProductDetail(id);

      // 回填表单数据
      this.setData({
        code: product.code,
        name: product.name,
        specification: product.specification || '',
        description: product.description || '',
        thickness: product.thickness ? String(product.thickness) : '',
        categoryId: product.category?.id || product.categoryId || '',
        categoryName: product.category?.name || '',
        thumbnailUrl: product.thumbnailUrl || '',
        mainImages: product.mainImages || product.images || [],
        effectImages: product.effectImages || [],
      });
    } catch (error) {
      console.error('加载产品详情失败(编辑模式):', error);
      wx.showToast({
        title: '加载产品信息失败',
        icon: 'none',
      });
    }
  },

  async loadCategories() {
    try {
      const categories = await categoryService.getCategories();
      this.setData({ categories });
    } catch (error) {
      console.error('加载分类失败:', error);
      wx.showToast({
        title: '加载分类失败',
        icon: 'none',
      });
    }
  },

  // 输入事件
  onCodeInput(e: any) {
    this.setData({ code: e.detail.value });
  },

  onNameInput(e: any) {
    this.setData({ name: e.detail.value });
  },

  onSpecInput(e: any) {
    this.setData({ specification: e.detail.value });
  },

  onDescInput(e: any) {
    this.setData({ description: e.detail.value });
  },

  onThicknessInput(e: any) {
    this.setData({ thickness: e.detail.value });
  },

  // 焦点管理 - 用于浮动标签动画
  onInputFocus(e: any) {
    const field = e.currentTarget.dataset.field;
    if (field) {
      this.setData({
        [`focusStates.${field}`]: true,
      });
    }
  },

  onInputBlur(e: any) {
    const field = e.currentTarget.dataset.field;
    if (field) {
      this.setData({
        [`focusStates.${field}`]: false,
      });
    }
  },

  // 分类选择
  onCategoryChange(e: any) {
    const index = Number(e.detail.value);
    const categories = this.data.categories || [];

    if (!categories.length || index < 0 || index >= categories.length) {
      return;
    }

    const category = categories[index];
    this.setData({
      categoryId: category.id,
      categoryName: category.name,
    });
  },

  // 通用图片选择入口
  chooseImageAndUpload(kind: 'thumbnail' | 'main' | 'effect') {
    const that = this;
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success(res) {
        if (!res.tempFilePaths || !res.tempFilePaths.length) {
          return;
        }
        const filePath = res.tempFilePaths[0];

        // 根据类型限制大小（缩略图/主图 1MB，效果图 2MB）
        const maxSizeMb = kind === 'effect' ? 2 : 1;
        const fileInfo = res.tempFiles && res.tempFiles[0];
        if (fileInfo && typeof fileInfo.size === 'number') {
          const sizeMb = fileInfo.size / (1024 * 1024);
          if (sizeMb > maxSizeMb) {
            // 尝试压缩后继续上传（避免用户来回选择）
            wx.showToast({
              title: '图片较大，正在压缩…',
              icon: 'none',
              duration: 1200,
            });

            wx.compressImage({
              src: filePath,
              quality: kind === 'effect' ? 80 : 75,
              success: compRes => {
                const compressedPath =
                  (compRes as any)?.tempFilePath || filePath;

                // 压缩后再检查一次大小（部分机型压缩后仍可能超过限制）
                const fs = wx.getFileSystemManager();
                fs.getFileInfo({
                  filePath: compressedPath,
                  success: info => {
                    const mb = (info.size || 0) / (1024 * 1024);
                    if (mb > maxSizeMb) {
                      wx.showToast({
                        title: `${kind === 'effect' ? '效果图' : '图片'}不能超过 ${maxSizeMb}MB`,
                        icon: 'none',
                      });
                      return;
                    }
                    that.uploadImage(compressedPath, kind);
                  },
                  fail: () => {
                    // 取不到大小就直接尝试上传
                    that.uploadImage(compressedPath, kind);
                  },
                });
              },
              fail: () => {
                wx.showToast({
                  title: `${kind === 'effect' ? '效果图' : '图片'}不能超过 ${maxSizeMb}MB`,
                  icon: 'none',
                });
              },
            });

            return;
          }
        }

        that.uploadImage(filePath, kind);
      },
      fail(err) {
        const msg = String((err as any)?.errMsg || '');
        // 取消也给一个轻提示，避免用户误以为“没反应”
        if (msg.includes('cancel')) {
          wx.showToast({ title: '已取消', icon: 'none', duration: 1200 });
          return;
        }

        wx.showToast({
          title: '无法选择图片，请检查相册/相机权限',
          icon: 'none',
          duration: 2000,
        });
        console.error('选择图片失败:', err);
      },
    });
  },

  // 选择主图
  onChooseThumbnail() {
    this.chooseImageAndUpload('thumbnail');
  },

  // 添加主图（多张）
  onAddMainImage() {
    this.chooseImageAndUpload('main');
  },

  // 添加效果图
  onAddEffectImage() {
    this.chooseImageAndUpload('effect');
  },

  // 预览主图
  onPreviewThumbnail() {
    const url = this.data.thumbnailUrl;
    if (!url) return;
    wx.previewImage({
      current: url,
      urls: [url],
    });
  },

  // 缩略图点击：支持预览/更换/删除（编辑模式下更符合直觉）
  onThumbnailTap() {
    const url = this.data.thumbnailUrl;
    if (!url) {
      this.onChooseThumbnail();
      return;
    }

    wx.showActionSheet({
      itemList: ['预览', '更换', '删除'],
      success: res => {
        if (res.tapIndex === 0) {
          this.onPreviewThumbnail();
        } else if (res.tapIndex === 1) {
          this.onChooseThumbnail();
        } else if (res.tapIndex === 2) {
          this.setData({ thumbnailUrl: '', uploadInfo: null });
          wx.showToast({ title: '已删除缩略图', icon: 'none' });
        }
      },
      fail: err => {
        const msg = String((err as any)?.errMsg || '');
        if (msg && !msg.includes('cancel')) {
          wx.showToast({ title: '操作失败', icon: 'none' });
        }
      },
    });
  },

  // 预览主图/效果图
  onPreviewMainImage(e: any) {
    const idx = e.currentTarget.dataset.index;
    const list = this.data.mainImages || [];
    if (!list.length) return;
    wx.previewImage({
      current: list[idx] || list[0],
      urls: list,
    });
  },

  onPreviewEffectImage(e: any) {
    const idx = e.currentTarget.dataset.index;
    const list = this.data.effectImages || [];
    if (!list.length) return;
    wx.previewImage({
      current: list[idx] || list[0],
      urls: list,
    });
  },

  // 删除主图/效果图
  onRemoveMainImage(e: any) {
    const idx = e.currentTarget.dataset.index;
    const list = (this.data.mainImages || []).slice();
    if (idx >= 0 && idx < list.length) {
      list.splice(idx, 1);
      this.setData({ mainImages: list });
    }
  },

  onRemoveEffectImage(e: any) {
    const idx = e.currentTarget.dataset.index;
    const list = (this.data.effectImages || []).slice();
    if (idx >= 0 && idx < list.length) {
      list.splice(idx, 1);
      this.setData({ effectImages: list });
    }
  },

  // 上传图片（使用七牛云直传）
  async uploadImage(filePath: string, kind: 'thumbnail' | 'main' | 'effect') {
    try {
      // 使用七牛云服务上传
      const result = await qiniuService.uploadImage(filePath, kind);

      // 上传成功，更新对应的状态
      const url = result.url;

      if (kind === 'thumbnail') {
        this.setData({
          thumbnailUrl: url,
          uploadInfo: { url, key: result.key },
        });
      } else if (kind === 'main') {
        const list = (this.data.mainImages || []).slice();
        list.push(url);
        this.setData({ mainImages: list });
      } else if (kind === 'effect') {
        const list = (this.data.effectImages || []).slice();
        list.push(url);
        this.setData({ effectImages: list });
      }

      wx.showToast({
        title: '上传成功',
        icon: 'success',
        duration: 1500,
      });
    } catch (error) {
      console.error('上传失败:', error);
      wx.showToast({
        title: '上传失败，请重试',
        icon: 'none',
        duration: 2000,
      });
    }
  },

  // 提交创建/更新
  async onSubmit() {
    // 防抖：防止重复提交
    if (this.data.submitting) {
      wx.showToast({
        title: '提交中，请稍候',
        icon: 'none',
        duration: 1000,
      });
      return;
    }

    const code = this.data.code.trim();
    const name = this.data.name.trim();
    const specification = this.data.specification.trim();
    const categoryId = this.data.categoryId;

    if (!code) {
      wx.showToast({ title: '请输入产品编号', icon: 'none' });
      return;
    }
    if (!name) {
      wx.showToast({ title: '请输入产品名称', icon: 'none' });
      return;
    }
    if (!specification) {
      wx.showToast({ title: '请输入规格', icon: 'none' });
      return;
    }
    if (!categoryId) {
      wx.showToast({ title: '请选择分类', icon: 'none' });
      return;
    }

    let thicknessNumber: number | undefined;
    const thicknessRaw = this.data.thickness.trim();
    if (thicknessRaw) {
      const parsed = Number(thicknessRaw);
      if (Number.isNaN(parsed) || parsed < 0) {
        wx.showToast({ title: '厚度必须为数字', icon: 'none' });
        return;
      }
      thicknessNumber = parsed;
    }

    this.setData({ submitting: true });

    try {
      // 去重并清理图片列表（避免重复上传/重复保存同一 URL）
      const mainImages = Array.from(
        new Set(
          (this.data.mainImages || [])
            .map(u => (typeof u === 'string' ? u.trim() : ''))
            .filter(Boolean)
        )
      );
      const effectImages = Array.from(
        new Set(
          (this.data.effectImages || [])
            .map(u => (typeof u === 'string' ? u.trim() : ''))
            .filter(Boolean)
        )
      );

      // 如果缩略图没有选择，自动使用主图的第一张
      const thumbnailUrlRaw = (this.data.thumbnailUrl || '').trim();
      const thumbnailUrl = thumbnailUrlRaw || mainImages[0] || undefined;

      const payload = {
        code,
        name,
        specification,
        description: this.data.description.trim(),
        thickness: thicknessNumber,
        categoryId,
        thumbnailUrl,
        mainImages,
        effectImages,
      };

      let product;

      if (this.data.isEditMode && this.data.productId) {
        product = await productService.updateProduct(
          this.data.productId,
          payload
        );
        wx.showToast({
          title: '更新成功',
          icon: 'success',
          duration: 1500,
        });
      } else {
        product = await productService.createProduct(payload);
        wx.showToast({
          title: '创建成功',
          icon: 'success',
          duration: 1500,
        });
      }

      setTimeout(() => {
        // 编辑模式：返回上一页（通常是详情页），并通过 eventChannel 通知刷新，避免产生“详情页叠加”的历史栈问题
        if (this.data.isEditMode) {
          try {
            const channel = (this as any).getOpenerEventChannel?.();
            channel?.emit('productUpdated', {
              id: (product as any)?.id || this.data.productId,
            });
          } catch (_error) {
            // ignore
          }

          const pages = getCurrentPages();
          if (pages.length > 1) {
            wx.navigateBack();
            return;
          }
        }

        // 创建模式或兜底：跳转到详情/列表
        if (product && (product as any).id) {
          wx.redirectTo({
            url: `/pages/products/detail?id=${(product as any).id}`,
          });
          return;
        }

        wx.redirectTo({
          url: '/pages/products/list',
        });
      }, 1500);
    } catch (error) {
      console.error('创建产品失败:', error);
      // 具体错误提示已在 request.ts 中处理，这里只重置状态
    } finally {
      this.setData({ submitting: false });
    }
  },
});
