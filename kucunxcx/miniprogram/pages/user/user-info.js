"use strict";
// pages/user/user-info.ts
// 个人信息页
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const auth_service_1 = __importDefault(require("../../services/auth.service"));
Page({
    data: {
        user: null,
    },
    onLoad() {
        this.ensureLoggedIn();
    },
    onShow() {
        this.ensureLoggedIn();
    },
    ensureLoggedIn() {
        if (!auth_service_1.default.isLoggedIn()) {
            wx.showModal({
                title: '提示',
                content: '请先登录后再查看个人信息',
                showCancel: false,
                success: () => {
                    wx.reLaunch({
                        url: '/pages/auth/login',
                    });
                },
            });
            return;
        }
        const user = auth_service_1.default.getCurrentUser();
        if (!user) {
            auth_service_1.default.clearAuth();
            wx.reLaunch({
                url: '/pages/auth/login',
            });
            return;
        }
        this.setData({
            user: {
                id: user.id,
                username: user.username,
                name: user.name || user.username,
                email: user.email,
                role: user.role,
                avatar: user.avatar || user.avatarUrl || '',
            },
        });
    },
    onLogout() {
        wx.showModal({
            title: '退出登录',
            content: '确定要退出当前账号吗？',
            success: res => {
                if (res.confirm) {
                    auth_service_1.default.logout();
                }
            },
        });
    },
});
