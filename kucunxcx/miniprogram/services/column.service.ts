/**
 * 罗马柱服务
 * 封装所有罗马柱相关的 API 请求
 */

import { API_ENDPOINTS } from '../config/api';
import type {
  GenerateSchemeRequest,
  GenerateSchemeResponse,
  Material,
  MaterialSearchParams,
  SaveSchemeRequest,
  SavedScheme,
  SlotType,
} from '../types/column';
import type { PaginationResponse } from '../types/common';
import { del, get, post } from '../utils/request';

/**
 * 罗马柱服务类
 */
class ColumnService {
  /**
   * 搜索素材
   */
  /**
   * 搜索素材
   */
  async searchMaterials(
    params: MaterialSearchParams = {}
  ): Promise<PaginationResponse<Material>> {
    // [DEMO] 如果没有真实后端，使用 Mock 数据
    // 在真实项目中，这里应该先调用 API，如果失败或无数据再考虑是否使用 Mock

    // 模拟不同分类的数据
    const slot = params.slot === 'ALL' ? undefined : params.slot;
    const mockItems = this.getMockMaterials(slot);

    // 简单的分页模拟
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedItems = mockItems.slice(start, end);

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 300));

    return {
      items: paginatedItems,
      pagination: {
        page,
        limit: pageSize,
        total: mockItems.length,
        totalPages: Math.ceil(mockItems.length / pageSize),
        hasNextPage: end < mockItems.length,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * 生成 Mock 数据列表
   */
  private getMockMaterials(slot?: SlotType): Material[] {
    const allMaterials: Material[] = [];

    // 生成一些 mock 数据
    const slots: SlotType[] = ['BODY', 'BASE', 'CAP', 'HEAD'];
    const slotNames: Record<SlotType, string> = {
      BODY: '柱身',
      BASE: '底座',
      CAP: '盖帽',
      HEAD: '柱头',
    };

    // 每个分类生成一些数据
    slots.forEach(s => {
      // 如果指定了 slot 且不匹配，则跳过
      if (slot && slot !== s) return;

      const count = 12; // 每个分类 12 个
      for (let i = 1; i <= count; i++) {
        // 使用 Picsum 图片作为占位符，加上随机 ID 避免缓存
        const imageId = 100 + slots.indexOf(s) * 20 + i;
        allMaterials.push({
          id: `${s}_${i}`,
          code: `${s}-00${i}`,
          name: `${slotNames[s]} ${i}号`,
          slot: s,
          slotName: slotNames[s],
          height: this.getSlotUnitHeight(s),
          faceWidth: 300,
          cuttable: s === 'BODY', // 只有柱身通过
          image: `https://picsum.photos/id/${imageId}/300/300`, // 随机图片
          usageCount: Math.floor(Math.random() * 1000),
        });
      }
    });

    return allMaterials;
  }

  /**
   * 获取位置标准高度 (Mock 用)
   */
  private getSlotUnitHeight(slot: SlotType): number {
    switch (slot) {
      case 'BODY':
        return 800;
      case 'BASE':
        return 200;
      case 'CAP':
        return 300;
      case 'HEAD':
        return 300;
      default:
        return 0;
    }
  }

  /**
   * 获取素材详情
   */
  async getMaterialDetail(id: string): Promise<Material> {
    const raw = await get<any>(
      API_ENDPOINTS.COLUMN.MATERIAL_DETAIL(id),
      {},
      {
        autoRedirectOn401: false,
      }
    );

    return {
      id: raw.id,
      code: raw.code,
      name: raw.name,
      slot: raw.slot,
      slotName: raw.slotName || this.getSlotName(raw.slot),
      height: raw.height,
      faceWidth: raw.faceWidth,
      cuttable: raw.cuttable ?? true,
      cutRecommend: raw.cutRecommend,
      image: raw.image || raw.thumbnailUrl || '',
      images: raw.images || [],
      usageCount: raw.usageCount || 0,
      isFavorite: raw.isFavorite || false,
      scenarios: raw.scenarios || [],
      material: raw.material,
    };
  }

  /**
   * 获取指定位置的可用素材列表
   */
  async getMaterialsBySlot(
    slot: SlotType,
    faceWidth?: number
  ): Promise<Material[]> {
    const response = await this.searchMaterials({
      slot,
      faceWidth,
      pageSize: 100,
    });
    return response.items;
  }

  /**
   * 生成用砖方案
   */
  async generateScheme(
    request: GenerateSchemeRequest
  ): Promise<GenerateSchemeResponse> {
    return post<GenerateSchemeResponse>(
      API_ENDPOINTS.COLUMN.GENERATE_SCHEME,
      request
    );
  }

  /**
   * 修改切割位置
   */
  async changeCutPosition(
    request: GenerateSchemeRequest & { cutPosition: SlotType }
  ): Promise<GenerateSchemeResponse> {
    return post<GenerateSchemeResponse>(
      API_ENDPOINTS.COLUMN.CHANGE_CUT_POSITION,
      request
    );
  }

  /**
   * 收藏素材
   */
  async addFavorite(materialId: string): Promise<void> {
    await post(API_ENDPOINTS.COLUMN.FAVORITES, { materialId });
  }

  /**
   * 取消收藏
   */
  async removeFavorite(materialId: string): Promise<void> {
    await del(`${API_ENDPOINTS.COLUMN.FAVORITES}/${materialId}`);
  }

  /**
   * 获取收藏列表
   */
  async getFavorites(): Promise<Material[]> {
    const response = await get<any>(
      API_ENDPOINTS.COLUMN.FAVORITES,
      {},
      {
        autoRedirectOn401: false,
      }
    );
    return response.data || [];
  }

  /**
   * 保存方案
   */
  async saveScheme(request: SaveSchemeRequest): Promise<SavedScheme> {
    return post<SavedScheme>(API_ENDPOINTS.COLUMN.SCHEMES, request);
  }

  /**
   * 获取已保存的方案列表
   */
  async getSchemes(): Promise<SavedScheme[]> {
    const response = await get<any>(
      API_ENDPOINTS.COLUMN.SCHEMES,
      {},
      {
        autoRedirectOn401: false,
      }
    );
    return response.data || [];
  }

  /**
   * 删除方案
   */
  async deleteScheme(schemeId: string): Promise<void> {
    await del(API_ENDPOINTS.COLUMN.SCHEME_DETAIL(schemeId));
  }

  /**
   * 获取位置中文名称
   */
  private getSlotName(slot: SlotType): string {
    const names: Record<SlotType, string> = {
      BODY: '柱身',
      BASE: '底座',
      CAP: '盖帽',
      HEAD: '柱头',
    };
    return names[slot] || slot;
  }
}

// 导出单例
export const columnService = new ColumnService();
export default columnService;
