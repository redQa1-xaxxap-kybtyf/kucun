"use strict";
// pages/effects/list.ts
// 效果图列表页
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const product_service_1 = __importDefault(require("../../services/product.service"));
// 收藏存储键
const FAVORITES_KEY = 'effect_favorites';
// 根据产品ID生成固定的增量（1-10）
// 同一个产品每次显示的增量是固定的
function getFixedIncrement(productId) {
    let hash = 0;
    for (let i = 0; i < productId.length; i++) {
        hash = ((hash << 5) - hash) + productId.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash % 10) + 1;
}
Page({
    data: {
        searchValue: '',
        effectList: [],
        allEffectList: [], // 用于搜索过滤
        loading: false,
        loadingMore: false,
        hasMore: true,
        page: 1,
        limit: 50,
        showTip: true, // 显示操作提示
        showSharePopup: false, // 分享弹窗
        currentItem: null, // 当前长按的项目
    },
    onLoad() {
        // 检查是否需要显示提示（首次使用显示，之后隐藏）
        const tipShown = wx.getStorageSync('effect_tip_shown');
        if (tipShown) {
            this.setData({ showTip: false });
        }
        this.loadEffectImages();
    },
    // 下拉刷新
    onPullDownRefresh() {
        this.setData({ page: 1, hasMore: true, effectList: [], allEffectList: [] });
        this.loadEffectImages().then(() => {
            wx.stopPullDownRefresh();
        });
    },
    // 加载效果图数据
    async loadEffectImages() {
        if (this.data.loading)
            return;
        this.setData({ loading: true });
        try {
            const allEffects = [];
            let page = 1;
            let hasMore = true;
            // 遍历所有产品获取效果图
            while (hasMore) {
                const response = await product_service_1.default.getProducts({
                    page,
                    limit: 50,
                    includeInventory: false,
                    includeStatistics: false,
                });
                // 遍历每个产品，提取效果图
                for (const product of response.items) {
                    if (product.effectImages && product.effectImages.length > 0) {
                        // 每张效果图单独作为一个条目
                        product.effectImages.forEach((imgUrl) => {
                            allEffects.push({
                                imageUrl: imgUrl,
                                productId: product.id,
                                productCode: product.code,
                                productName: product.name,
                                // 真实浏览量 + 固定增量（基于产品ID）
                                viewCount: (product.viewCount || 0) + getFixedIncrement(product.id),
                            });
                        });
                    }
                }
                hasMore = response.pagination.hasNextPage;
                page++;
                // 安全限制，防止无限循环
                if (page > 100)
                    break;
            }
            // 获取收藏列表
            const favorites = wx.getStorageSync(FAVORITES_KEY) || [];
            this.setData({
                effectList: allEffects.map((item) => ({
                    ...item,
                    isFavorite: favorites.includes(item.imageUrl),
                })),
                allEffectList: allEffects.map((item) => ({
                    ...item,
                    isFavorite: favorites.includes(item.imageUrl),
                })),
                hasMore: false,
                loading: false,
            });
        }
        catch (error) {
            console.error('加载效果图失败:', error);
            wx.showToast({
                title: '加载失败',
                icon: 'none',
            });
            this.setData({ loading: false });
        }
    },
    // 搜索输入
    onSearchChange(e) {
        const value = e.detail || '';
        this.setData({ searchValue: value });
        this.filterEffects(value);
    },
    // 执行搜索
    onSearch() {
        this.filterEffects(this.data.searchValue);
    },
    // 清除搜索
    onClearSearch() {
        this.setData({
            searchValue: '',
            effectList: this.data.allEffectList,
        });
    },
    // 过滤效果图
    filterEffects(keyword) {
        if (!keyword.trim()) {
            this.setData({ effectList: this.data.allEffectList });
            return;
        }
        const lowerKeyword = keyword.toLowerCase();
        const filtered = this.data.allEffectList.filter((item) => item.productCode.toLowerCase().includes(lowerKeyword) ||
            item.productName.toLowerCase().includes(lowerKeyword));
        this.setData({ effectList: filtered });
    },
    // 加载更多（当前实现一次性加载所有，此方法留作扩展）
    loadMore() {
        // 当前已一次性加载所有效果图，无需分页加载
    },
    // 点击进入详情页
    previewImage(e) {
        const { item } = e.currentTarget.dataset;
        wx.navigateTo({
            url: `/pages/effects/detail?imageUrl=${encodeURIComponent(item.imageUrl)}&productId=${item.productId}&productCode=${encodeURIComponent(item.productCode)}&productName=${encodeURIComponent(item.productName)}`,
        });
    },
    // 隐藏操作提示
    hideTip() {
        this.setData({ showTip: false });
        wx.setStorageSync('effect_tip_shown', true);
    },
    // 长按处理
    onLongPress(e) {
        const { item } = e.currentTarget.dataset;
        this.setData({ currentItem: item });
        const isFavorite = item.isFavorite;
        wx.showActionSheet({
            itemList: [isFavorite ? '取消收藏' : '收藏', '分享'],
            success: (res) => {
                if (res.tapIndex === 0) {
                    // 收藏/取消收藏
                    this.toggleFavorite(item);
                }
                else if (res.tapIndex === 1) {
                    // 显示分享弹窗
                    this.setData({ showSharePopup: true });
                }
            },
        });
    },
    // 关闭分享弹窗
    closeSharePopup() {
        this.setData({ showSharePopup: false });
    },
    // 切换收藏状态
    toggleFavorite(item) {
        const favorites = wx.getStorageSync(FAVORITES_KEY) || [];
        const imageUrl = item.imageUrl;
        const isFavorite = favorites.includes(imageUrl);
        let newFavorites;
        if (isFavorite) {
            // 取消收藏
            newFavorites = favorites.filter((url) => url !== imageUrl);
            wx.showToast({ title: '已取消收藏', icon: 'none' });
        }
        else {
            // 添加收藏
            newFavorites = [...favorites, imageUrl];
            wx.showToast({ title: '已收藏', icon: 'success' });
        }
        // 保存到本地
        wx.setStorageSync(FAVORITES_KEY, newFavorites);
        // 更新列表状态
        const updateList = (list) => list.map((i) => i.imageUrl === imageUrl ? { ...i, isFavorite: !isFavorite } : i);
        this.setData({
            effectList: updateList(this.data.effectList),
            allEffectList: updateList(this.data.allEffectList),
        });
    },
    // 页面分享配置
    onShareAppMessage() {
        // 分享后关闭弹窗
        this.setData({ showSharePopup: false });
        const item = this.data.currentItem;
        if (item) {
            // 分享链接指向详情页
            return {
                title: `${item.productCode} - ${item.productName}`,
                path: `/pages/effects/detail?imageUrl=${encodeURIComponent(item.imageUrl)}&productId=${item.productId}&productCode=${encodeURIComponent(item.productCode)}&productName=${encodeURIComponent(item.productName)}`,
                imageUrl: item.imageUrl,
            };
        }
        return {
            title: '豪星陶瓷效果图',
            path: '/pages/effects/list',
        };
    },
});
