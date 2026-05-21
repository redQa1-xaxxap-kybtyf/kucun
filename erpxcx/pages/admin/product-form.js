const {
  hideAdminShareMenu,
  requireAdminSession,
} = require('../../utils/admin');
const { getProduct: getCatalogProduct } = require('../../utils/catalog');
const { markCatalogDirty } = require('../../utils/catalog-cache');
const {
  getCatalogSettings,
  updateProductCatalogDisplay,
} = require('../../utils/catalog-settings');
const {
  getCategories,
  getProduct,
} = require('../../utils/products');
const { uploadProductImage } = require('../../utils/upload');

const EDIT_READONLY_ERP_FIELDS = [
  'code',
  'description',
  'name',
  'specification',
  'thumbnailUrl',
];

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

function createEmptyMiniDisplay() {
  return {
    componentType: '',
    displayGroupName: '',
    displayGroupOrder: '',
    seriesId: '',
    visible: true,
  };
}

function settle(promise) {
  return promise.then(
    value => ({ ok: true, value }),
    error => ({ ok: false, error })
  );
}

function normalizeList(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.data)) return value.data;
  return [];
}

function normalizeCatalogSettings(settings) {
  const safeSettings = settings && typeof settings === 'object' ? settings : {};
  const productOverrides =
    safeSettings.productOverrides &&
    typeof safeSettings.productOverrides === 'object' &&
    !Array.isArray(safeSettings.productOverrides)
      ? safeSettings.productOverrides
      : {};

  return {
    colorSeries: normalizeList(safeSettings.colorSeries),
    componentTypes: normalizeList(safeSettings.componentTypes),
    productOverrides,
  };
}

function findIndexById(items, id) {
  return (items || []).findIndex(item => item.id === id);
}

function readId(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value.id === 'string') return value.id;
  return '';
}

function normalizeGroupOrderInput(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return undefined;
  return Math.max(1, Math.min(99, Math.round(numberValue)));
}

function getProductCategoryId(product) {
  return (
    readId(product && product.categoryId) || readId(product && product.category)
  );
}

function getCategoryDisplayName(category) {
  if (!category) return '';

  const fullPath = String(category.fullPath || '').trim();
  if (fullPath) return fullPath;

  const name = String(category.name || '').trim();
  if (!name) return '';

  const parentName = getCategoryDisplayName(category.parent);
  return parentName ? `${parentName} / ${name}` : name;
}

function normalizeCategoryForView(category) {
  const displayName = getCategoryDisplayName(category);

  return {
    ...category,
    displayName: displayName || category.name,
  };
}

function normalizeCategories(categories, product) {
  const list = normalizeList(categories).filter(
    category => category && category.id && category.name
  ).map(normalizeCategoryForView);
  const productCategory = product && product.category;

  if (
    productCategory &&
    productCategory.id &&
    productCategory.name &&
    !list.some(category => category.id === productCategory.id)
  ) {
    return [normalizeCategoryForView(productCategory)].concat(list);
  }

  return list;
}

function buildProductSearchText(product) {
  if (!product) return '';

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const variantText = variants
    .map(variant =>
      [variant.colorName, variant.colorCode, variant.colorValue]
        .filter(Boolean)
        .join(' ')
    )
    .join(' ');

  return [
    product.code,
    product.name,
    product.specification,
    product.description,
    product.category && getCategoryDisplayName(product.category),
    variantText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function resolveCatalogItemId(items, searchText, fallbackId) {
  const list = normalizeList(items);
  const text = String(searchText || '').toLowerCase();
  const matched = list.find(item => {
    const keywords = normalizeList(item && item.keywords);
    return (
      item &&
      item.id !== fallbackId &&
      keywords.some(keyword => {
        const keywordText = String(keyword || '').trim().toLowerCase();
        return keywordText && text.includes(keywordText);
      })
    );
  });

  if (matched) return matched.id;

  const fallback = list.find(item => item && item.id === fallbackId);
  if (fallback) return fallback.id;

  return list[0] && list[0].id ? list[0].id : '';
}

function hasManualCatalogDisplay(override) {
  return Boolean(
    override &&
      (override.seriesId ||
        override.componentType ||
        override.displayGroupName ||
        override.displayGroupOrder ||
        typeof override.visible === 'boolean')
  );
}

function createMiniDisplayFromProduct(
  product,
  miniProduct,
  catalogSettings,
  productId
) {
  const productOverrides = catalogSettings.productOverrides || {};
  const override = productOverrides[productId] || {};
  const searchText = buildProductSearchText(product);
  const miniProductSeriesId = readId(miniProduct && miniProduct.colorSeries);
  const miniProductComponentType = readId(
    miniProduct && miniProduct.componentType
  );
  const productSeriesId =
    readId(product && product.colorSeries) || readId(product && product.seriesId);
  const productComponentType =
    readId(product && product.componentType) ||
    readId(product && product.componentTypeId);
  const seriesId =
    override.seriesId ||
    miniProductSeriesId ||
    productSeriesId ||
    resolveCatalogItemId(catalogSettings.colorSeries, searchText, 'other');
  const componentType =
    override.componentType ||
    miniProductComponentType ||
    productComponentType ||
    resolveCatalogItemId(catalogSettings.componentTypes, searchText, 'other');
  const display = {
    componentType,
    displayGroupName: String(override.displayGroupName || '').trim(),
    displayGroupOrder:
      override.displayGroupOrder !== undefined &&
      override.displayGroupOrder !== null
        ? String(override.displayGroupOrder)
        : '',
    seriesId,
    visible: override.visible !== false,
  };
  const hasSpecificDisplay =
    (seriesId && seriesId !== 'other') ||
    (componentType && componentType !== 'other');
  const sourceLabel = hasManualCatalogDisplay(override)
    ? '已手动选择'
    : miniProductSeriesId || miniProductComponentType
      ? '已按目录匹配'
      : hasSpecificDisplay
        ? '已按商品信息匹配'
        : '待选择';

  return {
    display,
    sourceLabel,
  };
}

function buildSelectableCatalogItems(items, selectedId) {
  const list = normalizeList(items).filter(item => item && item.id);
  const visibleItems = list.filter(item => item.visible !== false);
  const selectedItem = list.find(item => item.id === selectedId);

  if (
    selectedItem &&
    !visibleItems.some(item => item.id === selectedItem.id)
  ) {
    return visibleItems.concat(selectedItem);
  }

  return visibleItems;
}

function findCatalogName(items, id, nameField) {
  const item = (items || []).find(item => item.id === id);
  return item ? item[nameField] : '';
}

function normalizeSearchText(value) {
  return String(value || '').trim().toLowerCase();
}

function getCatalogItemTitle(item, type) {
  if (!item) return '';
  return type === 'series' ? item.name || '' : item.label || '';
}

function buildSelectorItems(items, type, keyword, selectedId) {
  const searchText = normalizeSearchText(keyword);

  return (items || [])
    .filter(item => {
      if (!item || !item.id) return false;
      if (!searchText) return true;

      const title = getCatalogItemTitle(item, type);
      const keywords = normalizeList(item.keywords).join(' ');
      const haystack = normalizeSearchText(
        `${title} ${item.id || ''} ${keywords}`
      );
      return haystack.includes(searchText);
    })
    .map(item => ({
      id: item.id,
      selected: item.id === selectedId,
      subtitle: item.visible === false ? '已停用，当前商品仍在使用' : '',
      title: getCatalogItemTitle(item, type),
    }));
}

Page({
  data: {
    catalogSettings: normalizeCatalogSettings(null),
    categories: [],
    categoryIndex: -1,
    componentIndex: -1,
    componentTypes: [],
    form: createEmptyForm(),
    id: '',
    isEdit: false,
    isUploading: false,
    effectImages: [],
    loadError: '',
    loading: true,
    mainImages: [],
    miniDisplay: createEmptyMiniDisplay(),
    miniDisplaySourceLabel: '',
    saving: false,
    selectedCategoryName: '请选择分类',
    selectedComponentName: '请选择品种',
    selectedSeriesName: '请选择花色',
    selectorEmptyText: '',
    selectorItems: [],
    selectorSearch: '',
    selectorTitle: '',
    selectorType: '',
    selectorVisible: false,
    seriesIndex: -1,
    seriesList: [],
    uploadingKind: '',
  },

  onLoad(options) {
    hideAdminShareMenu();

    const session = requireAdminSession();
    if (!session) return;

    const id = options.id || '';
    if (!id) {
      wx.showToast({
        title: '请在内部商品管理新增',
        icon: 'none',
      });
      wx.redirectTo({
        url: '/pages/admin/products',
      });
      return;
    }

    this.setData({
      id,
      isEdit: true,
    });
    this.initForm(id);
  },

  async initForm(id) {
    this.setData({ loadError: '', loading: true });

    try {
      const [
        categoriesResult,
        catalogSettingsResult,
        productResult,
        miniProductResult,
      ] = await Promise.all([
        settle(getCategories()),
        settle(getCatalogSettings()),
        id ? settle(getProduct(id)) : Promise.resolve({ ok: true, value: null }),
        id
          ? settle(getCatalogProduct(id))
          : Promise.resolve({ ok: true, value: null }),
      ]);

      if (!productResult.ok) {
        throw productResult.error;
      }

      const product = productResult.value;
      const miniProduct = miniProductResult.ok ? miniProductResult.value : null;
      const catalogSettings = normalizeCatalogSettings(
        catalogSettingsResult.ok ? catalogSettingsResult.value : null
      );
      const categories = normalizeCategories(
        categoriesResult.ok ? categoriesResult.value : [],
        product
      );
      let form = createEmptyForm();
      let miniDisplay = createEmptyMiniDisplay();
      let miniDisplaySourceLabel = '待选择';

      if (product) {
        form = {
          categoryId: getProductCategoryId(product),
          code: product.code || '',
          description: product.description || '',
          images: Array.isArray(product.images) ? product.images : [],
          name: product.name || '',
          specification: product.specification || '',
          status: product.status || 'active',
          thumbnailUrl: product.thumbnailUrl || '',
        };
        const displayResult = createMiniDisplayFromProduct(
          product,
          miniProduct,
          catalogSettings,
          id
        );
        miniDisplay = displayResult.display;
        miniDisplaySourceLabel = displayResult.sourceLabel;
      }

      const seriesList = buildSelectableCatalogItems(
        catalogSettings.colorSeries,
        miniDisplay.seriesId
      );
      const componentTypes = buildSelectableCatalogItems(
        catalogSettings.componentTypes,
        miniDisplay.componentType
      );
      const selectedCategory = categories.find(
        category => category.id === form.categoryId
      );
      const selectedSeries = seriesList.find(
        series => series.id === miniDisplay.seriesId
      );
      const selectedComponent = componentTypes.find(
        component => component.id === miniDisplay.componentType
      );
      const splitImages = splitProductImages(form.images);

      this.setData({
        categories,
        catalogSettings,
        categoryIndex: categories.findIndex(
          category => category.id === form.categoryId
        ),
        componentIndex: findIndexById(
          componentTypes,
          miniDisplay.componentType
        ),
        componentTypes,
        effectImages: splitImages.effectImages,
        form,
        loading: false,
        mainImages: splitImages.mainImages,
        miniDisplay,
        miniDisplaySourceLabel,
        selectedCategoryName: selectedCategory
          ? selectedCategory.displayName
          : product
            ? '未读取到内部分类'
            : '请选择分类',
        selectedComponentName: selectedComponent
          ? selectedComponent.label
          : '请选择品种',
        selectedSeriesName: selectedSeries ? selectedSeries.name : '请选择花色',
        seriesIndex: findIndexById(seriesList, miniDisplay.seriesId),
        seriesList,
      });

      if (!categoriesResult.ok) {
        wx.showToast({
          title: '内部分类加载失败，请稍后重试',
          icon: 'none',
        });
      } else if (!catalogSettingsResult.ok) {
        wx.showToast({
          title: '展示分类加载失败，请稍后重试',
          icon: 'none',
        });
      }
    } catch (error) {
      const message = error.message || '加载失败';
      wx.showToast({
        title: message,
        icon: 'none',
      });
      this.setData({ loadError: message, loading: false });
    }
  },

  onRetryLoadTap() {
    if (!this.data.id) return;
    this.initForm(this.data.id);
  },

  onBackProductsTap() {
    wx.redirectTo({
      url: '/pages/admin/products',
    });
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;

    if (
      this.data.isEdit &&
      EDIT_READONLY_ERP_FIELDS.indexOf(field) !== -1
    ) {
      return;
    }

    this.setData({
      [`form.${field}`]: event.detail.value,
    });
  },

  onCategoryChange(event) {
    if (this.data.isEdit) return;

    const index = Number(event.detail.value);
    const category = this.data.categories[index];
    this.setData({
      categoryIndex: index,
      'form.categoryId': category ? category.id : '',
      selectedCategoryName: category ? category.displayName : '请选择分类',
    });
  },

  onSeriesChange(event) {
    const index = Number(event.detail.value);
    const series = this.data.seriesList[index];
    this.setData({
      'miniDisplay.seriesId': series ? series.id : '',
      miniDisplaySourceLabel: '已手动选择',
      selectedSeriesName: series ? series.name : '请选择花色',
      seriesIndex: index,
    });
  },

  onComponentChange(event) {
    const index = Number(event.detail.value);
    const component = this.data.componentTypes[index];
    this.setData({
      'miniDisplay.componentType': component ? component.id : '',
      componentIndex: index,
      miniDisplaySourceLabel: '已手动选择',
      selectedComponentName: component ? component.label : '请选择品种',
    });
  },

  onStatusChange(event) {
    this.setData({
      'form.status': event.detail.value ? 'active' : 'inactive',
    });
  },

  onMiniVisibleChange(event) {
    this.setData({
      'miniDisplay.visible': event.detail.value,
      miniDisplaySourceLabel: '已手动选择',
    });
  },

  onMiniDisplayInput(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;

    this.setData({
      [`miniDisplay.${field}`]: event.detail.value,
      miniDisplaySourceLabel: '已手动选择',
    });
  },

  onOpenCatalogSelector(event) {
    if (!this.data.miniDisplay.visible) {
      wx.showToast({
        title: '先打开客户可见',
        icon: 'none',
      });
      return;
    }

    const type = event.currentTarget.dataset.type;
    if (type !== 'series' && type !== 'component') return;

    this.openCatalogSelector(type, '');
  },

  openCatalogSelector(type, keyword) {
    const isSeries = type === 'series';
    const selectedId = isSeries
      ? this.data.miniDisplay.seriesId
      : this.data.miniDisplay.componentType;
    const items = isSeries ? this.data.seriesList : this.data.componentTypes;
    const selectorItems = buildSelectorItems(items, type, keyword, selectedId);

    this.setData({
      selectorEmptyText: isSeries
        ? '没有找到花色，先到分类管理添加'
        : '没有找到品种，先到分类管理添加',
      selectorItems,
      selectorSearch: keyword,
      selectorTitle: isSeries ? '选择花色' : '选择品种',
      selectorType: type,
      selectorVisible: true,
    });
  },

  onSelectorSearchInput(event) {
    this.openCatalogSelector(this.data.selectorType, event.detail.value);
  },

  onSelectorItemTap(event) {
    const id = event.currentTarget.dataset.id;
    const type = this.data.selectorType;

    if (type === 'series') {
      const index = findIndexById(this.data.seriesList, id);
      const series = this.data.seriesList[index];
      if (!series) return;

      this.setData({
        'miniDisplay.seriesId': series.id,
        miniDisplaySourceLabel: '已手动选择',
        selectedSeriesName: series.name,
        selectorVisible: false,
        seriesIndex: index,
      });
      return;
    }

    if (type === 'component') {
      const index = findIndexById(this.data.componentTypes, id);
      const component = this.data.componentTypes[index];
      if (!component) return;

      this.setData({
        'miniDisplay.componentType': component.id,
        componentIndex: index,
        miniDisplaySourceLabel: '已手动选择',
        selectedComponentName: component.label,
        selectorVisible: false,
      });
    }
  },

  onCloseSelector() {
    this.setData({
      selectorItems: [],
      selectorSearch: '',
      selectorTitle: '',
      selectorType: '',
      selectorVisible: false,
    });
  },

  noop() {},

  onAutoClassifyTap() {
    const category = this.data.categories[this.data.categoryIndex] || null;
    const product = {
      ...this.data.form,
      category,
    };
    const displayResult = createMiniDisplayFromProduct(
      product,
      null,
      {
        colorSeries: this.data.seriesList,
        componentTypes: this.data.componentTypes,
        productOverrides: {},
      },
      this.data.id || ''
    );
    const nextDisplay = {
      ...this.data.miniDisplay,
      componentType: displayResult.display.componentType,
      seriesId: displayResult.display.seriesId,
    };
    const selectedSeriesName =
      findCatalogName(this.data.seriesList, nextDisplay.seriesId, 'name') ||
      '请选择花色';
    const selectedComponentName =
      findCatalogName(
        this.data.componentTypes,
        nextDisplay.componentType,
        'label'
      ) || '请选择品种';

    this.setData({
      componentIndex: findIndexById(
        this.data.componentTypes,
        nextDisplay.componentType
      ),
      miniDisplay: nextDisplay,
      miniDisplaySourceLabel: displayResult.sourceLabel,
      selectedComponentName,
      selectedSeriesName,
      seriesIndex: findIndexById(this.data.seriesList, nextDisplay.seriesId),
    });

    if (!nextDisplay.seriesId || !nextDisplay.componentType) {
      wx.showToast({
        title: '没有匹配到分类',
        icon: 'none',
      });
    }
  },

  validateForm() {
    if (!this.data.id) return '商品ID缺失，请返回列表重新进入';
    if (this.data.miniDisplay.visible) {
      if (this.data.seriesList.length === 0) return '请先维护小程序花色';
      if (!this.data.miniDisplay.seriesId) return '请选择小程序花色';
      if (this.data.componentTypes.length === 0) return '请先维护小程序品种';
      if (!this.data.miniDisplay.componentType) return '请选择小程序品种';
    }
    const groupOrder = String(
      this.data.miniDisplay.displayGroupOrder || ''
    ).trim();
    if (groupOrder && normalizeGroupOrderInput(groupOrder) === undefined) {
      return '组内排序请填写 1-99 的数字';
    }
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
    if (this.data.isEdit) {
      wx.showToast({
        title: '请在内部商品管理维护图片',
        icon: 'none',
      });
      return;
    }

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
          alt: kind === 'main' ? '商品主图' : '效果案例',
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
    if (this.data.isEdit) return;

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
    if (this.data.saving) return;

    const message = this.validateForm();

    if (message) {
      wx.showToast({ title: message, icon: 'none' });
      return;
    }

    this.setData({ saving: true });

    try {
      await updateProductCatalogDisplay(this.data.id, {
        visible: this.data.miniDisplay.visible,
        seriesId: this.data.miniDisplay.seriesId || undefined,
        componentType: this.data.miniDisplay.componentType || undefined,
        displayGroupName:
          String(this.data.miniDisplay.displayGroupName || '').trim() ||
          undefined,
        displayGroupOrder: normalizeGroupOrderInput(
          this.data.miniDisplay.displayGroupOrder
        ),
      });

      markCatalogDirty();
      wx.showToast({ title: '已保存' });
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
