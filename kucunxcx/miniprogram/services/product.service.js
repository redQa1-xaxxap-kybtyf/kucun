'use strict';
// 产品服务
// 封装所有产品相关的 API 请求
Object.defineProperty(exports, '__esModule', { value: true });
exports.productService = void 0;
const api_1 = require('../config/api');
const request_1 = require('../utils/request');
/**
 * 产品服务类
 */
class ProductService {
  /**
   * 获取产品列表
   */
  async getProducts(params = {}) {
    // 设置默认值
    const queryParams = {
      page: params.page || 1,
      limit: params.limit || 10,
      search: params.search,
      categoryId: params.categoryId,
      status: params.status,
      sortBy: params.sortBy || 'createdAt',
      sortOrder: params.sortOrder || 'desc',
      includeInventory: params.includeInventory !== false, // 默认包含库存
      includeStatistics: params.includeStatistics || false,
      includeBatchSpecs: params.includeBatchSpecs || false,
    };
    // 调用后端API
    const response = await (0, request_1.get)(
      api_1.API_ENDPOINTS.PRODUCTS.LIST,
      queryParams
    );
    // 🔧 适配后端返回格式：将 data.data 转换为 items
    // 后端返回: { data: [...], pagination: {...} }
    // 小程序期望: { items: [...], pagination: {...} }
    const items = (response.data || []).map(product => {
      // 将后端返回的图片结构(ProductImage[])转换为小程序使用的 string[]
      let images = [];
      if (Array.isArray(product.images)) {
        images = product.images
          .map(img =>
            typeof img === 'string'
              ? img
              : img && typeof img.url === 'string'
                ? img.url
                : ''
          )
          .filter(url => !!url);
      }
      return {
        ...product,
        images,
      };
    });
    return {
      items,
      pagination: {
        page: response.pagination?.page || params.page || 1,
        limit: response.pagination?.limit || params.limit || 10,
        total: response.pagination?.total || 0,
        totalPages: response.pagination?.totalPages || 0,
        hasNextPage:
          response.pagination?.page < response.pagination?.totalPages,
        hasPreviousPage: response.pagination?.page > 1,
      },
    };
  }
  /**
   * 获取产品详情
   * - 适配后端返回的图片结构(ProductImage[])为小程序使用的 string[]
   */
  async getProductDetail(id) {
    const raw = await (0, request_1.get)(
      api_1.API_ENDPOINTS.PRODUCTS.DETAIL(id),
      {
        includeInventory: true,
        includeStatistics: true,
        includeBatchSpecs: true,
      }
    );
    let images = [];
    if (Array.isArray(raw.images)) {
      images = raw.images
        .map(img =>
          typeof img === 'string'
            ? img
            : img && typeof img.url === 'string'
              ? img.url
              : ''
        )
        .filter(url => !!url);
    }
    return {
      ...raw,
      images,
    };
  }
  /**
   * 搜索产品
   */
  async searchProducts(keyword, params = {}) {
    return this.getProducts({
      ...params,
      search: keyword,
    });
  }
  /**
   * 按分类获取产品
   */
  async getProductsByCategory(categoryId, params = {}) {
    return this.getProducts({
      ...params,
      categoryId,
    });
  }
  /**
   * 创建产品
   * 注意：后端 productCreateSchema 要求的字段：
   * - code, name, specification, categoryId 为必填
   * - description/thickness 可选
   * - thumbnailUrl/images 为可选的图片字段
   */
  async createProduct(payload) {
    // 将小程序选择的图片列表转换为后端需要的 ProductImage 结构
    const images = [];
    let order = 0;
    // 缩略图优先作为主图
    if (payload.thumbnailUrl) {
      images.push({
        url: payload.thumbnailUrl,
        type: 'main',
        order: order++,
      });
    }
    // 其他主图
    if (payload.mainImages && payload.mainImages.length > 0) {
      payload.mainImages.forEach(url => {
        if (!url) return;
        images.push({
          url,
          type: 'main',
          order: order++,
        });
      });
    }
    // 效果图
    if (payload.effectImages && payload.effectImages.length > 0) {
      payload.effectImages.forEach(url => {
        if (!url) return;
        images.push({
          url,
          type: 'effect',
          order: order++,
        });
      });
    }
    const body = {
      code: payload.code,
      name: payload.name,
      specification: payload.specification,
      description: payload.description ?? '',
      thickness: payload.thickness,
      status: 'active',
      categoryId: payload.categoryId,
      thumbnailUrl: payload.thumbnailUrl ?? '',
      images,
    };
    return (0, request_1.post)(api_1.API_ENDPOINTS.PRODUCTS.LIST, body);
  }
}
// 导出单例
exports.productService = new ProductService();
exports.default = exports.productService;
