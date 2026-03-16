// 产品服务
// 封装所有产品相关的 API 请求

import { API_ENDPOINTS } from '../config/api';
import type { PaginationResponse } from '../types/common';
import type {
  Product,
  ProductDetail,
  ProductQueryParams,
} from '../types/product';
import { appendMiniTokenForLocalUploads } from '../utils/media';
import { get, post, put } from '../utils/request';

import authService from './auth.service';
import inventoryService from './inventory.service';

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
      // 小程序默认开启批次规格信息，方便计算“X件Y片”
      includeBatchSpecs:
        params.includeBatchSpecs === undefined
          ? true
          : params.includeBatchSpecs,
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
          .filter((url: string) => !!url)
          .map((url: string) => appendMiniTokenForLocalUploads(url));
      }

      // 计算统一的“每件片数”
      // 1) 优先使用产品本身的 piecesPerUnit（>1 时认为是有效包装）
      // 2) 如未设置或为 1，则从批次规格 / 库存批次中推导（所有批次一致时采用）
      let effectivePiecesPerUnit: number | undefined =
        typeof product.piecesPerUnit === 'number' && product.piecesPerUnit > 1
          ? product.piecesPerUnit
          : undefined;

      if (!effectivePiecesPerUnit) {
        const candidateValues: number[] = [];

        // 从批次规格里收集每件片数
        if (Array.isArray(product.batchSpecs)) {
          product.batchSpecs.forEach((spec: any) => {
            const v =
              spec && typeof spec.piecesPerUnit === 'number'
                ? spec.piecesPerUnit
                : undefined;
            if (v && v > 0) {
              candidateValues.push(v);
            }
          });
        }

        // 兼容：从库存批次中收集 piecesPerUnit（如果后端有返回）
        if (product.inventory && Array.isArray(product.inventory.batches)) {
          product.inventory.batches.forEach((batch: any) => {
            const v =
              batch && typeof batch.piecesPerUnit === 'number'
                ? batch.piecesPerUnit
                : undefined;
            if (v && v > 0) {
              candidateValues.push(v);
            }
          });
        }

        const unique = Array.from(new Set(candidateValues));
        if (unique.length === 1) {
          effectivePiecesPerUnit = unique[0];
        }
      }

      return {
        ...product,
        piecesPerUnit: effectivePiecesPerUnit ?? product.piecesPerUnit,
        thumbnailUrl: appendMiniTokenForLocalUploads(
          product.thumbnailUrl || ''
        ),
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
      },
      {
        // 产品详情同样允许游客访问，不自动跳转登录
        autoRedirectOn401: false,
      }
    );

    // 将后端返回的图片结构(ProductImage[])拆分为主图 / 效果图，方便小程序分别展示
    const images: string[] = [];
    const mainImages: string[] = [];
    const effectImages: string[] = [];

    if (Array.isArray(raw.images)) {
      raw.images.forEach((img: any) => {
        if (!img) return;

        // 兼容历史数据：字符串数组视为主图
        if (typeof img === 'string') {
          mainImages.push(img);
          images.push(img);
          return;
        }

        if (img && typeof img.url === 'string' && img.url) {
          const url = appendMiniTokenForLocalUploads(img.url as string);
          if (img.type === 'effect') {
            effectImages.push(url);
          } else {
            // 默认归类为主图
            mainImages.push(url);
          }
          images.push(url);
        }
      });
    }

    // 详情页同样需要正确的“每件片数”用于 X件Y片 展示
    let effectivePiecesPerUnit: number | undefined =
      typeof raw.piecesPerUnit === 'number' && raw.piecesPerUnit > 1
        ? raw.piecesPerUnit
        : undefined;

    // 如果产品本身没有配置 piecesPerUnit，则在有权限查看库存数字的情况下，
    // 尝试从库存批次信息中推导统一的“每件片数”
    if (!effectivePiecesPerUnit && authService.canViewNumericInventory()) {
      try {
        const inventoryResponse = await inventoryService.getInventoryList({
          productId: id,
          page: 1,
          limit: 100,
        });

        const candidateValues: number[] = [];

        if (Array.isArray(inventoryResponse.inventories)) {
          inventoryResponse.inventories.forEach(item => {
            const v =
              typeof item.batchPiecesPerUnit === 'number'
                ? item.batchPiecesPerUnit
                : undefined;
            if (v && v > 0) {
              candidateValues.push(v);
            }
          });
        }

        const unique = Array.from(new Set(candidateValues));
        if (unique.length === 1) {
          effectivePiecesPerUnit = unique[0];
        }
      } catch (error) {
        // 推导失败不影响主流程，只在控制台记录
        // eslint-disable-next-line no-console
        console.error('获取库存批次规格失败:', error);
      }
    }

    return {
      ...raw,
      piecesPerUnit: effectivePiecesPerUnit ?? raw.piecesPerUnit,
      thumbnailUrl: appendMiniTokenForLocalUploads(raw.thumbnailUrl || ''),
      images,
      // 如果没有单独的主图数组，则回退为全部图片
      mainImages: mainImages.length > 0 ? mainImages : images,
      effectImages,
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
    // - 去重：避免缩略图与主图列表重复导致后端存储多份相同图片
    const images: Array<{
      url: string;
      type: 'main' | 'effect';
      order: number;
    }> = [];
    const seen = new Set<string>();
    let order = 0;

    const addImage = (url: string | undefined, type: 'main' | 'effect') => {
      const normalized = typeof url === 'string' ? url.trim() : '';
      if (!normalized) return;
      const key = `${type}|${normalized}`;
      if (seen.has(key)) return;
      seen.add(key);
      images.push({ url: normalized, type, order: order++ });
    };

    // 缩略图优先作为主图
    addImage(payload.thumbnailUrl, 'main');

    // 其他主图
    (payload.mainImages || []).forEach(url => addImage(url, 'main'));

    // 效果图
    (payload.effectImages || []).forEach(url => addImage(url, 'effect'));

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

  /**
   * 更新产品
   * 仅用于小程序端管理员 / 销售编辑产品
   */
  async updateProduct(
    id: string,
    payload: {
      code: string;
      name: string;
      specification: string;
      description?: string;
      thickness?: number;
      categoryId: string;
      thumbnailUrl?: string;
      mainImages?: string[];
      effectImages?: string[];
    }
  ): Promise<ProductDetail> {
    const images: Array<{
      url: string;
      type: 'main' | 'effect';
      order: number;
    }> = [];
    const seen = new Set<string>();
    let order = 0;

    const addImage = (url: string | undefined, type: 'main' | 'effect') => {
      const normalized = typeof url === 'string' ? url.trim() : '';
      if (!normalized) return;
      const key = `${type}|${normalized}`;
      if (seen.has(key)) return;
      seen.add(key);
      images.push({ url: normalized, type, order: order++ });
    };

    addImage(payload.thumbnailUrl, 'main');
    (payload.mainImages || []).forEach(url => addImage(url, 'main'));
    (payload.effectImages || []).forEach(url => addImage(url, 'effect'));

    const body = {
      code: payload.code,
      name: payload.name,
      specification: payload.specification,
      description: payload.description ?? '',
      thickness: payload.thickness,
      categoryId: payload.categoryId,
      thumbnailUrl: payload.thumbnailUrl ?? '',
      images,
    };

    return put<ProductDetail>(API_ENDPOINTS.PRODUCTS.DETAIL(id), body);
  }
}

// 导出单例
export const productService = new ProductService();
export default productService;
