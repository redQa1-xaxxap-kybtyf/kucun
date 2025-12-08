// 产品服务
// 封装所有产品相关的 API 请求

import { API_ENDPOINTS } from '../config/api';
import type { PaginationResponse } from '../types/common';
import type {
  Product,
  ProductDetail,
  ProductQueryParams,
} from '../types/product';
import { get, post } from '../utils/request';

/**
 * 产品服务类
 */
class ProductService {
  /**
   * 获取产品列表
   */
  async getProducts(
    params: Partial<ProductQueryParams> = {}
  ): Promise<PaginationResponse<Product>> {
    // 设置默认值
    const queryParams: ProductQueryParams = {
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
    const response = await get<any>(API_ENDPOINTS.PRODUCTS.LIST, queryParams, {
      // 浏览产品列表时，未登录用户不强制跳转登录页
      autoRedirectOn401: false,
    });

    // 🔧 适配后端返回格式：将 data.data 转换为 items
    // 后端返回: { data: [...], pagination: {...} }
    // 小程序期望: { items: [...], pagination: {...} }
    const items: Product[] = (response.data || []).map((product: any) => {
      // 将后端返回的图片结构(ProductImage[])转换为小程序使用的 string[]
      let images: string[] = [];
      if (Array.isArray(product.images)) {
        images = product.images
          .map((img: any) =>
            typeof img === 'string'
              ? img
              : img && typeof img.url === 'string'
                ? img.url
                : ''
          )
          .filter((url: string) => !!url);
      }

      return {
        ...product,
        images,
      } as Product;
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
  async getProductDetail(id: string): Promise<ProductDetail> {
    const raw = await get<any>(
      API_ENDPOINTS.PRODUCTS.DETAIL(id),
      {
        includeInventory: true,
        includeStatistics: true,
        includeBatchSpecs: true,
      },
      {
        // 产品详情同样允许游客访问，不自动跳转登录
        autoRedirectOn401: false,
      }
    );

    let images: string[] = [];
    if (Array.isArray(raw.images)) {
      images = raw.images
        .map((img: any) =>
          typeof img === 'string'
            ? img
            : img && typeof img.url === 'string'
              ? img.url
              : ''
        )
        .filter((url: string) => !!url);
    }

    return {
      ...raw,
      images,
    } as ProductDetail;
  }

  /**
   * 搜索产品
   */
  async searchProducts(
    keyword: string,
    params: Partial<ProductQueryParams> = {}
  ): Promise<PaginationResponse<Product>> {
    return this.getProducts({
      ...params,
      search: keyword,
    });
  }

  /**
   * 按分类获取产品
   */
  async getProductsByCategory(
    categoryId: string,
    params: Partial<ProductQueryParams> = {}
  ): Promise<PaginationResponse<Product>> {
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
  async createProduct(payload: {
    code: string;
    name: string;
    specification: string;
    description?: string;
    thickness?: number;
    categoryId: string;
    thumbnailUrl?: string;
    mainImages?: string[];
    effectImages?: string[];
  }): Promise<ProductDetail> {
    // 将小程序选择的图片列表转换为后端需要的 ProductImage 结构
    const images: Array<{
      url: string;
      type: 'main' | 'effect';
      order: number;
    }> = [];
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

    return post<ProductDetail>(API_ENDPOINTS.PRODUCTS.LIST, body);
  }
}

// 导出单例
export const productService = new ProductService();
export default productService;
