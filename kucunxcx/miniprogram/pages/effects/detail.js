"use strict";
// pages/effects/detail.ts
// 效果图详情页 - 按产品分组显示
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const product_service_1 = __importDefault(require("../../services/product.service"));
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
        effectList: [],
        currentIndex: 0,
        currentItem: {},
        loading: true,
        productId: '', // 当前产品ID
    },
    onLoad(options) {
        const { imageUrl, productId, productCode, productName } = options;
        if (productId) {
            this.setData({ productId });
        }
        if (imageUrl) {
            // 从分享链接或列表进入
            const decodedUrl = decodeURIComponent(imageUrl);
            const initialItem = {
                imageUrl: decodedUrl,
                productId: productId || '',
                productCode: decodeURIComponent(productCode || ''),
                productName: decodeURIComponent(productName || ''),
                // 固定增量（基于产品ID）
                viewCount: getFixedIncrement(productId || ''),
                isFavorite: this.checkFavorite(decodedUrl),
            };
            this.setData({
                currentItem: initialItem,
                effectList: [initialItem],
                loading: false,
            });
            // 加载该产品的所有效果图
            if (productId) {
                this.loadProductEffects(productId, decodedUrl);
            }
        }
    },
    // 加载指定产品的所有效果图
    async loadProductEffects(productId, targetImageUrl) {
        try {
            // 获取产品详情
            const product = await product_service_1.default.getProductDetail(productId);
            if (!product.effectImages || product.effectImages.length === 0) {
                return;
            }
            // 获取收藏列表
            const favorites = wx.getStorageSync(FAVORITES_KEY) || [];
            // 构建效果图列表
            const effectList = product.effectImages.map((imgUrl) => ({
                imageUrl: imgUrl,
                productId: product.id,
                productCode: product.code,
                productName: product.name,
                // 真实浏览量 + 固定增量（基于产品ID）
                viewCount: (product.viewCount || 0) + getFixedIncrement(product.id),
                isFavorite: favorites.includes(imgUrl),
            }));
            // 找到目标图片的索引
            let targetIndex = 0;
            if (targetImageUrl) {
                const idx = effectList.findIndex((item) => item.imageUrl === targetImageUrl);
                if (idx >= 0)
                    targetIndex = idx;
            }
            this.setData({
                effectList,
                currentIndex: targetIndex,
                currentItem: effectList[targetIndex] || effectList[0],
                loading: false,
            });
        }
        catch (error) {
            console.error('加载产品效果图失败:', error);
            this.setData({ loading: false });
        }
    },
    // 检查是否已收藏
    checkFavorite(imageUrl) {
        const favorites = wx.getStorageSync(FAVORITES_KEY) || [];
        return favorites.includes(imageUrl);
    },
    // 轮播切换
    onSwiperChange(e) {
        const index = e.detail.current;
        const currentItem = this.data.effectList[index];
        if (currentItem) {
            this.setData({
                currentIndex: index,
                currentItem,
            });
        }
    },
    // 预览大图
    previewImage(e) {
        const { url } = e.currentTarget.dataset;
        const urls = this.data.effectList.map((item) => item.imageUrl);
        wx.previewImage({
            current: url,
            urls,
        });
    },
    // 切换收藏
    toggleFavorite() {
        const item = this.data.currentItem;
        if (!item || !item.imageUrl)
            return;
        const favorites = wx.getStorageSync(FAVORITES_KEY) || [];
        const imageUrl = item.imageUrl;
        const isFavorite = favorites.includes(imageUrl);
        let newFavorites;
        if (isFavorite) {
            newFavorites = favorites.filter((url) => url !== imageUrl);
            wx.showToast({ title: '已取消收藏', icon: 'none' });
        }
        else {
            newFavorites = [...favorites, imageUrl];
            wx.showToast({ title: '已收藏', icon: 'success' });
        }
        wx.setStorageSync(FAVORITES_KEY, newFavorites);
        // 更新当前项和列表
        const updatedItem = { ...item, isFavorite: !isFavorite };
        const updatedList = this.data.effectList.map((i) => i.imageUrl === imageUrl ? { ...i, isFavorite: !isFavorite } : i);
        this.setData({
            currentItem: updatedItem,
            effectList: updatedList,
        });
    },
    // 查看产品详情
    goToProduct() {
        const productId = this.data.currentItem?.productId || this.data.productId;
        if (!productId) {
            wx.showToast({ title: '产品信息缺失', icon: 'none' });
            return;
        }
        wx.navigateTo({
            url: `/pages/products/detail?id=${productId}`,
        });
    },
    // 返回列表
    goToList() {
        wx.navigateTo({
            url: '/pages/effects/list',
            fail: () => {
                wx.redirectTo({ url: '/pages/effects/list' });
            },
        });
    },
    // 分享配置
    onShareAppMessage() {
        const item = this.data.currentItem;
        return {
            title: `${item.productCode} - ${item.productName}`,
            path: `/pages/effects/detail?imageUrl=${encodeURIComponent(item.imageUrl)}&productId=${item.productId}&productCode=${encodeURIComponent(item.productCode)}&productName=${encodeURIComponent(item.productName)}`,
            imageUrl: item.imageUrl,
        };
    },
});
