// inventory/detail.ts
// 库存详情页

import authService from '../../services/auth.service';
import inventoryService from '../../services/inventory.service';
import type { InventoryItem } from '../../types/inventory';

Page({
  data: {
    id: '',
    inventory: null as InventoryItem | null,
    loading: false,
    // 是否允许查看数字库存（仅 admin / sales）
    canViewNumericInventory: false,
  },

  onLoad(options: any) {
    const id = options?.id;
    if (!id) {
      wx.showToast({
        title: '缺少库存ID',
        icon: 'none',
        duration: 2000,
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    // 初始化权限标记
    const canView = authService.canViewNumericInventory();
    this.setData({ id, canViewNumericInventory: canView });
    void this.loadDetail();
  },

  async loadDetail() {
    const { id } = this.data;
    if (!id) return;

    this.setData({ loading: true });

    try {
      const inventory = await inventoryService.getInventoryDetail(id);

      this.setData({ inventory });

      // 根据产品名称和批次号设置标题
      const titleParts: string[] = [];
      if (inventory.product?.name) {
        titleParts.push(inventory.product.name);
      }
      if (inventory.batchNumber) {
        titleParts.push(inventory.batchNumber);
      }

      wx.setNavigationBarTitle({
        title: titleParts.length > 0 ? titleParts.join(' / ') : '库存详情',
      });
    } catch (error) {
      console.error('加载库存详情失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
        duration: 2000,
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 2000);
    } finally {
      this.setData({ loading: false });
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    void this.loadDetail();
    wx.stopPullDownRefresh();
  },
});
