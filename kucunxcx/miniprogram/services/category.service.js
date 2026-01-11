"use strict";
// 分类服务
// 封装所有分类相关的 API 请求
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryService = void 0;
const api_1 = require("../config/api");
const request_1 = require("../utils/request");
/**
 * 分类服务类
 */
class CategoryService {
    /**
     * 获取分类列表
     */
    async getCategories() {
        return (0, request_1.get)(api_1.API_ENDPOINTS.CATEGORIES.LIST, {
            status: 'active', // 只获取启用的分类
        }, {
            // 分类浏览允许游客模式，不自动跳转登录
            autoRedirectOn401: false,
        });
    }
    /**
     * 获取分类详情
     */
    async getCategoryDetail(id) {
        return (0, request_1.get)(api_1.API_ENDPOINTS.CATEGORIES.DETAIL(id), undefined, {
            autoRedirectOn401: false,
        });
    }
    /**
     * 创建分类
     */
    async createCategory(params) {
        return (0, request_1.post)(api_1.API_ENDPOINTS.CATEGORIES.LIST, params);
    }
    /**
     * 更新分类
     */
    async updateCategory(id, params) {
        return (0, request_1.put)(api_1.API_ENDPOINTS.CATEGORIES.DETAIL(id), params);
    }
    /**
     * 更新分类状态
     */
    async updateCategoryStatus(id, status) {
        return (0, request_1.patch)(`${api_1.API_ENDPOINTS.CATEGORIES.DETAIL(id)}/status`, { status });
    }
    /**
     * 删除分类
     */
    async deleteCategory(id) {
        await (0, request_1.del)(api_1.API_ENDPOINTS.CATEGORIES.DETAIL(id));
    }
}
// 导出单例
exports.categoryService = new CategoryService();
exports.default = exports.categoryService;
