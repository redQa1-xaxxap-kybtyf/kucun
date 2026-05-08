const {
  hideAdminShareMenu,
  requireAdminSession,
} = require('../../utils/admin');
const { getCatalog } = require('../../utils/catalog');
const {
  getCatalogSettings,
  updateCatalogSettings,
} = require('../../utils/catalog-settings');
const { uploadProductImage } = require('../../utils/upload');

function createCustomId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function getNextSortOrder(items) {
  return (
    (items || []).reduce((max, item) => {
      const sortOrder = Number(item.sortOrder) || 0;
      return Math.max(max, sortOrder);
    }, 0) + 1
  );
}

function mergeCount(items, counts, keyName) {
  const countMap = new Map((counts || []).map(item => [item.id, item]));
  return (items || []).map(item => {
    const matched = countMap.get(item.id) || {};
    const title = item.name || item.label || '';

    return {
      ...item,
      count: matched.productCount || 0,
      coverUrl: item.coverUrl || matched.coverUrl || '',
      title,
      shortTitle: String(title).slice(0, 2),
      typeLabel: keyName,
      builtIn: item.builtIn === true,
      canDelete: item.canDelete === true && item.builtIn !== true,
    };
  });
}

Page({
  data: {
    activeTab: 'series',
    colorSeries: [],
    componentTypes: [],
    editorItem: null,
    editorTitle: '',
    editorType: '',
    editorVisible: false,
    error: '',
    loading: true,
    note: '',
    saving: false,
    uploading: false,
  },

  onLoad() {
    hideAdminShareMenu();

    const session = requireAdminSession();
    if (!session) return;
    this.loadData();
  },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  async loadData() {
    this.setData({ loading: true, error: '' });

    try {
      const [settings, catalog] = await Promise.all([
        getCatalogSettings(),
        getCatalog(),
      ]);

      this.setData({
        colorSeries: mergeCount(
          settings.colorSeries || [],
          (catalog.series || []).filter(item => item.id !== 'hot'),
          '花色'
        ),
        componentTypes: mergeCount(
          settings.componentTypes || [],
          (catalog.components || []).filter(item => item.id !== 'all'),
          '品种'
        ),
        note: settings.note || '',
        loading: false,
      });
    } catch (error) {
      this.setData({
        error: error.message || '加载失败',
        loading: false,
      });
    }
  },

  onPreviewTap() {
    wx.reLaunch({
      url: '/pages/index/index',
    });
  },

  onProductsTap() {
    wx.navigateTo({
      url: '/pages/admin/products',
    });
  },

  onTabTap(event) {
    const tab = event.currentTarget.dataset.tab;
    if (tab !== 'series' && tab !== 'component') return;

    this.setData({
      activeTab: tab,
    });
  },

  onAddSeriesTap() {
    this.openEditor(
      'series',
      {
        builtIn: false,
        canDelete: true,
        count: 0,
        coverUrl: '',
        id: createCustomId('custom-series'),
        name: '',
        sortOrder: getNextSortOrder(this.data.colorSeries),
        title: '',
        visible: true,
      },
      '新增花色'
    );
  },

  onAddComponentTap() {
    this.openEditor(
      'component',
      {
        builtIn: false,
        canDelete: true,
        count: 0,
        coverUrl: '',
        id: createCustomId('custom-component'),
        label: '',
        sortOrder: getNextSortOrder(this.data.componentTypes),
        title: '',
        visible: true,
      },
      '新增品种'
    );
  },

  onEditSeriesTap(event) {
    const index = Number(event.currentTarget.dataset.index);
    const item = this.data.colorSeries[index];
    if (!item) return;
    this.openEditor('series', item, '编辑花色');
  },

  onEditComponentTap(event) {
    const index = Number(event.currentTarget.dataset.index);
    const item = this.data.componentTypes[index];
    if (!item) return;
    this.openEditor('component', item, '编辑品种');
  },

  openEditor(type, item, title) {
    this.setData({
      editorItem: {
        ...item,
        displayName: item.name || item.label || item.title || '',
        sortOrder: String(item.sortOrder || 1),
      },
      editorTitle: title,
      editorType: type,
      editorVisible: true,
    });
  },

  onEditorInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [`editorItem.${field}`]: event.detail.value,
    });
  },

  onEditorVisibleChange(event) {
    this.setData({
      'editorItem.visible': event.detail.value,
    });
  },

  chooseImageFiles() {
    return new Promise((resolve, reject) => {
      if (wx.chooseMedia) {
        wx.chooseMedia({
          count: 1,
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
        count: 1,
        sourceType: ['album', 'camera'],
        success(result) {
          resolve(result.tempFilePaths || []);
        },
        fail(error) {
          reject(error);
        },
      });
    });
  },

  async onUploadCover() {
    if (this.data.uploading) return;

    try {
      const paths = await this.chooseImageFiles();
      if (!paths.length) return;

      this.setData({ uploading: true });
      const url = await uploadProductImage(paths[0], 'thumbnail');
      this.setData({
        'editorItem.coverUrl': url,
      });
      wx.showToast({ title: '图片已上传' });
    } catch (error) {
      if (error && error.errMsg && error.errMsg.includes('cancel')) return;
      wx.showToast({
        title: error.message || '上传失败',
        icon: 'none',
      });
    } finally {
      this.setData({ uploading: false });
    }
  },

  onClearCover() {
    this.setData({
      'editorItem.coverUrl': '',
    });
  },

  onCloseEditor() {
    if (this.data.saving || this.data.uploading) return;
    this.setData({
      editorItem: null,
      editorTitle: '',
      editorType: '',
      editorVisible: false,
    });
  },

  noop() {},

  normalizeColorSeriesForSave(list) {
    return (list || []).map(item => ({
      id: item.id,
      name: item.name || item.title,
      coverUrl: item.coverUrl || null,
      sortOrder: Number(item.sortOrder) || 1,
      visible: item.visible !== false,
    }));
  },

  normalizeComponentTypesForSave(list) {
    return (list || []).map(item => ({
      id: item.id,
      label: item.label || item.title,
      coverUrl: item.coverUrl || null,
      sortOrder: Number(item.sortOrder) || 1,
      visible: item.visible !== false,
    }));
  },

  async saveCatalogLists(colorSeries, componentTypes, toastTitle) {
    this.setData({ saving: true });

    try {
      await updateCatalogSettings({
        colorSeries: this.normalizeColorSeriesForSave(colorSeries),
        componentTypes: this.normalizeComponentTypesForSave(componentTypes),
      });

      this.setData({
        colorSeries,
        componentTypes,
        saving: false,
      });
      this.onCloseEditor();
      wx.showToast({ title: toastTitle || '已保存' });
      this.loadData();
    } catch (error) {
      this.setData({ saving: false });
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none',
      });
    }
  },

  async onSaveEditor() {
    const item = this.data.editorItem;
    if (!item) return;

    const displayName = String(item.displayName || '').trim();
    if (!displayName) {
      wx.showToast({ title: '请输入名称', icon: 'none' });
      return;
    }

    const nextItem = {
      ...item,
      coverUrl: item.coverUrl || '',
      sortOrder: Number(item.sortOrder) || 1,
      title: displayName,
      visible: item.visible !== false,
    };

    let colorSeries = this.data.colorSeries;
    let componentTypes = this.data.componentTypes;

    if (this.data.editorType === 'series') {
      nextItem.name = displayName;
      colorSeries = colorSeries.some(current => current.id === item.id)
        ? colorSeries.map(current =>
            current.id === item.id ? nextItem : current
          )
        : colorSeries.concat(nextItem);
    } else {
      nextItem.label = displayName;
      componentTypes = componentTypes.some(current => current.id === item.id)
        ? componentTypes.map(current =>
            current.id === item.id ? nextItem : current
          )
        : componentTypes.concat(nextItem);
    }

    await this.saveCatalogLists(colorSeries, componentTypes, '已保存');
  },

  onDeleteEditor() {
    const item = this.data.editorItem;
    if (!item || !item.canDelete) {
      wx.showToast({ title: '系统默认分类不能删除', icon: 'none' });
      return;
    }

    if (Number(item.count) > 0) {
      wx.showToast({ title: '已有产品使用，先调整产品', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '删除分类',
      content: `删除“${item.displayName || item.title}”？`,
      confirmColor: '#B42318',
      success: result => {
        if (!result.confirm) return;

        const colorSeries =
          this.data.editorType === 'series'
            ? this.data.colorSeries.filter(current => current.id !== item.id)
            : this.data.colorSeries;
        const componentTypes =
          this.data.editorType === 'component'
            ? this.data.componentTypes.filter(current => current.id !== item.id)
            : this.data.componentTypes;

        this.saveCatalogLists(colorSeries, componentTypes, '已删除');
      },
    });
  },

});
