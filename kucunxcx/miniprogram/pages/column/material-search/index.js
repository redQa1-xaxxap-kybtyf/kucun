'use strict';
/**
 * 产品查找页面 (三栏布局改造)
 * 顶部颜色筛选 + 左侧分类导航 + 右侧产品网格
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
const app = getApp();
/** 颜色/风格筛选选项 */
const COLOR_OPTIONS = [
  { value: 'golden_hemp', label: '黄金麻', color: '#d4a574' },
  { value: 'white', label: '帝王白', color: '#f5f5f5' },
  { value: 'gold', label: '香槟金', color: '#faeec7' },
  {
    value: 'bicolor',
    label: '双色',
    color: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
  },
];
/** 分类导航选项 */
const CATEGORY_OPTIONS = [
  { value: 'ALL', label: '全部' },
  { value: 'HEAD', label: '柱头' },
  { value: 'BODY', label: '柱身' },
  { value: 'BASE', label: '底座' },
  // 未来扩展
  // { value: 'TILE', label: '走砖' },
  // { value: 'FLOWER', label: '花片' },
];
Page({
  data: {
    /** 搜索关键词 */
    keyword: '',
    /** 搜索结果 */
    materials: [],
    /** 是否加载中 */
    loading: false,
    /** 是否加载更多中 */
    loadingMore: false,
    /** 是否有更多数据 */
    hasMore: true,
    /** 当前页码 */
    page: 1,
    /** 每页数量 */
    pageSize: 20, // 网格布局每页多加载一些
    /** 筛选条件 */
    filters: {
      slot: 'ALL',
      color: 'ALL',
    },
    /** 选项数据 */
    colorOptions: COLOR_OPTIONS,
    categoryOptions: CATEGORY_OPTIONS,
    /** 是否显示搜索面板 */
    showSearchPanel: false,
    /** 是否从拼柱页面跳转过来 */
    fromBuild: false,
    /** 选择的位置（从拼柱页面传递） */
    targetSlot: '',
    /** 当前选中的素材ID（如果是从拼柱页面过来） */
    selectedMaterialId: '',
  },
  onLoad(options) {
    // 检查是否从拼柱页面跳转
    if (options.slot) {
      this.setData({
        fromBuild: true,
        targetSlot: options.slot,
        'filters.slot': options.slot, // 自动选中对应分类
      });
      // 获取当前已选素材ID（如果有）
      const state = app.globalData.columnBuildState;
      if (state) {
        const currentFace = state.faceTypes[state.currentFaceTypeIndex];
        const selectedMat = currentFace.materials[options.slot];
        if (selectedMat && selectedMat.id) {
          this.setData({ selectedMaterialId: selectedMat.id });
        }
      }
    }
    // 如果有初始关键词
    if (options.keyword) {
      this.setData({ keyword: options.keyword });
    }
    // 加载初始数据
    this.loadMaterials();
  },
  /**
   * 加载素材列表
   */
  async loadMaterials(append = false) {
    const { keyword, filters, page, pageSize, loading, loadingMore } =
      this.data;
    if (loading || loadingMore) return;
    this.setData({
      [append ? 'loadingMore' : 'loading']: true,
    });
    try {
      const params = {
        keyword: keyword || undefined,
        slot: filters.slot,
        // 这里暂时用 keyword 模拟颜色筛选，实际后端应支持 color 参数
        // 如果接入真实后端，需调整 searchMaterials 接口定义
        page: append ? page : 1,
        pageSize,
      };
      const response = await column_service_1.default.searchMaterials(params);
      const newMaterials = response.items;
      const materials = append
        ? [...this.data.materials, ...newMaterials]
        : newMaterials;
      const hasMore = response.pagination.hasNextPage;
      this.setData({
        materials,
        page: response.pagination.page,
        hasMore,
        loading: false,
        loadingMore: false,
      });
    } catch (error) {
      console.error('加载素材失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({
        loading: false,
        loadingMore: false,
      });
    }
  },
  /**
   * 切换颜色筛选
   */
  onColorChange(e) {
    const { value } = e.currentTarget.dataset;
    if (this.data.filters.color === value) return;
    this.setData({
      'filters.color': value,
      page: 1,
      materials: [], // 清空列表，避免滚动条位置问题
    });
    this.loadMaterials();
  },
  /**
   * 切换分类导航
   */
  onCategoryChange(e) {
    const { value } = e.currentTarget.dataset;
    if (this.data.filters.slot === value) return;
    this.setData({
      'filters.slot': value,
      page: 1,
      materials: [],
    });
    this.loadMaterials();
  },
  /**
   * 显示搜索面板
   */
  onSearchTrigger() {
    this.setData({ showSearchPanel: true });
  },
  /**
   * 关闭搜索面板
   */
  closeSearchPanel() {
    this.setData({ showSearchPanel: false });
  },
  /**
   * 确认搜索
   */
  onSearchConfirm(e) {
    const keyword = e.detail.value;
    this.setData({
      keyword,
      showSearchPanel: false,
      page: 1,
      materials: [],
    });
    this.loadMaterials();
  },
  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.setData({ page: 1 });
    this.loadMaterials();
    // 注意：scroll-view 的 refresher 状态由 triggered 属性控制，这里不需要调 stopPullDownRefresh
    // 这里简单模拟一下
    setTimeout(() => {
      this.setData({ loading: false });
    }, 500);
  },
  /**
   * 加载更多
   */
  onReachBottom() {
    const { hasMore, loadingMore } = this.data;
    if (hasMore && !loadingMore) {
      this.setData({ page: this.data.page + 1 });
      this.loadMaterials(true);
    }
  },
  /**
   * 点击素材卡片
   */
  onMaterialTap(e) {
    const { id } = e.currentTarget.dataset;
    const { fromBuild, targetSlot, materials } = this.data;
    if (fromBuild && targetSlot) {
      // 从拼柱页面跳转过来，选中并返回
      const material = materials.find(m => m.id === id);
      if (!material) return;
      const state = app.globalData.columnBuildState;
      if (state) {
        const faceTypes = [...state.faceTypes];
        const faceType = { ...faceTypes[state.currentFaceTypeIndex] };
        faceType.materials = { ...faceType.materials };
        // 保持原有的 segments，如果没有则默认为 1
        const currentSegments = faceType.materials[targetSlot]?.segments || 1;
        faceType.materials[targetSlot] = {
          code: material.code,
          id: material.id,
          segments: currentSegments,
          height: material.height,
        };
        faceTypes[state.currentFaceTypeIndex] = faceType;
        app.globalData.columnBuildState = { ...state, faceTypes };
      }
      wx.navigateBack({ delta: 1 });
      wx.showToast({ title: '已选择', icon: 'success' });
    } else {
      // 普通模式，进入详情页
      wx.navigateTo({
        url: `/pages/column/material-detail/index?id=${id}`,
      });
    }
  },
});
