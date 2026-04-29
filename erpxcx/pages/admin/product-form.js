const { requireAdminSession } = require('../../utils/admin');
const {
  createProduct,
  getCategories,
  getProduct,
  updateProduct,
} = require('../../utils/products');

function createEmptyForm() {
  return {
    categoryId: '',
    code: '',
    description: '',
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
    name: form.name.trim(),
    specification: form.specification.trim(),
    status: form.status,
    thumbnailUrl: form.thumbnailUrl.trim(),
  };
}

Page({
  data: {
    categories: [],
    categoryIndex: -1,
    form: createEmptyForm(),
    id: '',
    isEdit: false,
    loading: true,
    saving: false,
    selectedCategoryName: '请选择分类',
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

      this.setData({
        categories,
        categoryIndex: categories.findIndex(
          category => category.id === form.categoryId
        ),
        form,
        loading: false,
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
