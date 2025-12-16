"use strict";
// pages/user/favorites.ts
// 我的收藏列表（走后端接口）
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const auth_service_1 = __importDefault(require("../../services/auth.service"));
const user_service_1 = __importDefault(require("../../services/user.service"));
function formatTime(ts) {
    const date = new Date(ts);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}`;
}
Page({
    data: {
        favorites: [],
        loading: true,
    },
    onShow() {
        this.ensureLoggedInAndLoad();
    },
    ensureLoggedInAndLoad() {
        if (!auth_service_1.default.isLoggedIn()) {
            wx.showModal({
                title: '提示',
                content: '请先登录后查看收藏',
                showCancel: false,
                success: () => {
                    wx.reLaunch({
                        url: '/pages/auth/login',
                    });
                },
            });
            return;
        }
        void this.loadFavorites();
    },
    async loadFavorites() {
        this.setData({ loading: true });
        try {
            const list = await user_service_1.default.getFavorites();
            const withText = (list || []).map(item => ({
                ...item,
                addedAtText: formatTime(new Date(item.addedAt).getTime()),
            }));
            this.setData({
                favorites: withText,
                loading: false,
            });
        }
        catch (error) {
            console.error('加载收藏失败:', error);
            this.setData({ favorites: [], loading: false });
            wx.showToast({
                title: '加载收藏失败',
                icon: 'none',
            });
        }
    },
    onItemTap(e) {
        const { id } = e.currentTarget.dataset;
        if (!id)
            return;
        wx.navigateTo({
            url: `/pages/products/detail?id=${id}`,
        });
    },
    onClear() {
        wx.showModal({
            title: '清空收藏',
            content: '确定要清空所有收藏的产品吗？',
            success: async (res) => {
                if (res.confirm) {
                    try {
                        await user_service_1.default.clearFavorites();
                        this.setData({ favorites: [] });
                        wx.showToast({
                            title: '已清空',
                            icon: 'success',
                        });
                    }
                    catch (error) {
                        console.error('清空收藏失败:', error);
                        wx.showToast({
                            title: '清空失败',
                            icon: 'none',
                        });
                    }
                }
            },
        });
    },
});
