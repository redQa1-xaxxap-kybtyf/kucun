const { requireAdminSession } = require('../../utils/admin');
const {
  createProduct,
  getCategories,
  getProduct,
  updateProduct,
} = require('../../utils/products');
const { uploadProductImage } = require('../../utils/upload');

function createEmptyForm() {
  return {
    categoryId: '',
    code: '',
    description: '',
    images: [],
    name: '',
    specification: '',
    status: 'active',
    thumbnailUrl: '',
  };
}

function trimForm(form) {
  return {
    categoryId: form.categoryId,
    code: form.code.trim(),
    description: form.description.trim(),
    images: form.images || [],
    name: form.name.trim(),
    specification: form.specification.trim(),
    status: form.status,
    thumbnailUrl: form.thumbnailUrl.trim(),
  };
}

function splitProductImages(images) {
  const list = Array.isArray(images) ? images : [];
  return {
    effectImages: list.filter(image => image.type === 'effect'),
    mainImages: list.filter(image => image.type === 'main'),
  };
}

function chooseImageFiles(count) {
  return new Promise((resolve, reject) => {
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success(result) {
          resolve((result.tempFiles || []).map(file => file.tempFilePath));
        },
        fail(error) {
          reject(error);
        },
      });
      return;
    }

    wx.chooseImage({
      count,
      sourceType: ['album', 'camera'],
      success(result) {
        resolve(result.tempFilePaths || []);
      },
      fail(error) {
        reject(error);
      },
    });
  });
}

Page({
  data: {
    categories: [],
    categoryIndex: -1,
    form: createEmptyForm(),
    id: '',
    isEdit: false,
    isUploading: false,
    effectImages: [],
    loading: true,
    mainImages: [],
    saving: false,
    selectedCategoryName: '请选择分类',
    uploadingKind: '',
  },

  onLoad(options) {
    const session = requireAdminSession();
    if (!session) return;

    const id = options.id || '';
    this.setData({
      id,
      isEdit: Boolean(id),
    });
    this.initForm(id);
  },

  async initForm(id) {
    this.setData({ loading: true });

    try {
      const categories = await getCategories();
      let form = createEmptyForm();

      if (id) {
        const product = await getProduct(id);
        form = {
          categoryId: product.categoryId || '',
          code: product.code || '',
          description: product.description || '',
          images: Array.isArray(product.images) ? product.images : [],
          name: product.name || '',
          specification: product.specification || '',
          status: product.status || 'active',
          thumbnailUrl: product.thumbnailUrl || '',
        };

        if (
          product.category &&
          !categories.some(category => category.id === product.category.id)
        ) {
          categories.unshift(product.category);
        }
      }

      const selectedCategory = categories.find(
        category => category.id === form.categoryId
      );
      const splitImages = splitProductImages(form.images);

      this.setData({
        categories,
        categoryIndex: categories.findIndex(
          category => category.id === form.categoryId
        ),
        effectImages: splitImages.effectImages,
        form,
        loading: false,
        mainImages: splitImages.mainImages,
        selectedCategoryName: selectedCategory
          ? selectedCategory.name
          : '请选择分类',
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none',
      });
      this.setData({ loading: false });
    }
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`form.${field}`]: event.detail.value,
    });
  },

  onCategoryChange(event) {
    const index = Number(event.detail.value);
    const category = this.data.categories[index];
    this.setData({
      categoryIndex: index,
      'form.categoryId': category ? category.id : '',
      selectedCategoryName: category ? category.name : '请选择分类',
    });
  },

  onStatusChange(event) {
    this.setData({
      'form.status': event.detail.value ? 'active' : 'inactive',
    });
  },

  validateForm(payload) {
    if (!payload.code) return '请输入产品编码';
    if (!payload.name) return '请输入产品名称';
    if (!payload.specification) return '请输入规格';
    if (!payload.categoryId) return '请选择分类';
    return '';
  },

  syncImages(images) {
    const normalizedImages = images.map((image, index) => ({
      ...image,
      order: index,
    }));
    const splitImages = splitProductImages(normalizedImages);
    this.setData({
      'form.images': normalizedImages,
      effectImages: splitImages.effectImages,
      mainImages: splitImages.mainImages,
    });
  },

  async onUploadThumbnail() {
    await this.uploadImages('thumbnail', 1);
  },

  async onUploadMainImage() {
    await this.uploadImages('main', 6);
  },

  async onUploadEffectImage() {
    await this.uploadImages('effect', 6);
  },

  async uploadImages(kind, maxCount) {
    if (this.data.uploadingKind) return;

    try {
      const paths = await chooseImageFiles(maxCount);
      if (!paths.length) return;

      this.setData({ isUploading: true, uploadingKind: kind });

      if (kind === 'thumbnail') {
        const url = await uploadProductImage(paths[0], 'thumbnail');
        this.setData({ 'form.thumbnailUrl': url });
        wx.showToast({ title: '封面已上传' });
        return;
      }

      const currentImages = this.data.form.images || [];
      const uploadedImages = [];
      for (let i = 0; i < paths.length; i += 1) {
        const url = await uploadProductImage(paths[i], kind);
        uploadedImages.push({
          url,
          type: kind,
          alt: kind === 'main' ? '产品主图' : '效果案例',
          order: currentImages.length + uploadedImages.length,
        });
      }

      this.syncImages(currentImages.concat(uploadedImages));
      wx.showToast({ title: '图片已上传' });
    } catch (error) {
      if (error && error.errMsg && error.errMsg.includes('cancel')) {
        return;
      }
      wx.showToast({
        title: error.message || '上传失败',
        icon: 'none',
      });
    } finally {
      this.setData({ isUploading: false, uploadingKind: '' });
    }
  },

  onRemoveImage(event) {
    const index = Number(event.currentTarget.dataset.index);
    const type = event.currentTarget.dataset.type;
    const typeImages = (this.data.form.images || []).filter(
      image => image.type === type
    );
    const target = typeImages[index];
    if (!target) return;

    const nextImages = (this.data.form.images || []).filter(
      image => image !== target
    );
    this.syncImages(nextImages);
  },

  async onSubmit() {
    const payload = trimForm(this.data.form);
    const message = this.validateForm(payload);

    if (message) {
      wx.showToast({ title: message, icon: 'none' });
      return;
    }

    this.setData({ saving: true });

    try {
      if (this.data.isEdit) {
        await updateProduct(this.data.id, payload);
        wx.showToast({ title: '已保存' });
      } else {
        await createProduct(payload);
        wx.showToast({ title: '已新增' });
      }

      wx.navigateBack();
    } catch (error) {
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none',
      });
    } finally {
      this.setData({ saving: false });
    }
  },
});
