"use strict";
// 用户相关服务（收藏、浏览历史等）
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = void 0;
const api_1 = require("../config/api");
const request_1 = require("../utils/request");
const auth_service_1 = __importDefault(require("./auth.service"));
class UserService {
    /**
     * 获取当前用户收藏的产品列表
     */
    async getFavorites() {
        return (0, request_1.get)(api_1.API_ENDPOINTS.PROFILE.FAVORITES);
    }
    /**
     * 切换收藏状态（收藏 / 取消收藏）
     * 后端会根据当前状态自动切换，并返回最新 isFavorite 状态
     */
    async toggleFavorite(productId) {
        return (0, request_1.post)(api_1.API_ENDPOINTS.PROFILE.FAVORITES, {
            productId,
        });
    }
    /**
     * 清空当前用户的收藏
     */
    async clearFavorites() {
        await (0, request_1.del)(api_1.API_ENDPOINTS.PROFILE.FAVORITES);
    }
    /**
     * 获取浏览历史列表
     */
    async getHistory() {
        return (0, request_1.get)(api_1.API_ENDPOINTS.PROFILE.HISTORY);
    }
    /**
     * 记录浏览历史（查看某个产品时调用）
     */
    async addHistory(productId) {
        // 未登录用户不记录浏览历史，直接跳过，避免多余的 401 请求
        if (!auth_service_1.default.isLoggedIn()) {
            return;
        }
        await (0, request_1.post)(api_1.API_ENDPOINTS.PROFILE.HISTORY, { productId }, {
            // 登录状态下如果 token 失效，仅在控制台报错，不强制跳登录
            autoRedirectOn401: false,
        });
    }
    /**
     * 清空浏览历史
     */
    async clearHistory() {
        await (0, request_1.del)(api_1.API_ENDPOINTS.PROFILE.HISTORY);
    }
}
const userService = new UserService();
exports.userService = userService;
exports.default = userService;
