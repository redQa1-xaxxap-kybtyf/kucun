"use strict";
// 库存服务
Object.defineProperty(exports, "__esModule", { value: true });
const request_1 = require("../utils/request");
class InventoryService {
    /**
     * 获取库存列表
     */
    async getInventoryList(params = {}) {
        // 直接将参数传递给 request，它会自动处理查询字符串
        const response = await (0, request_1.request)({
            url: '/inventory',
            method: 'GET',
            params, // buildURL 函数会自动过滤 undefined/null 并构建查询字符串
            // 游客查看库存列表时，不强制跳转登录
            autoRedirectOn401: false,
        });
        return response;
    }
    /**
     * 获取库存详情
     */
    async getInventoryDetail(id) {
        return await (0, request_1.request)({
            url: `/inventory/${id}`,
            method: 'GET',
            autoRedirectOn401: false,
        });
    }
}
exports.default = new InventoryService();
