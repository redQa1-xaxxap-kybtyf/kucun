// pages/user/history.ts
// 浏览历史（走后端接口）

import authService from '../../services/auth.service';
import userService from '../../services/user.service';

interface HistoryItem {
  id: string;
  name: string;
  code: string;
  thumbnailUrl?: string;
  viewedAt: string;
  viewedAtText?: string;
}

function formatTime(ts: number): string {
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
    history: [] as HistoryItem[],
    loading: true,
  },

  onShow() {
    this.ensureLoggedInAndLoad();
  },

  ensureLoggedInAndLoad() {
    if (!authService.isLoggedIn()) {
      wx.showModal({
        title: '提示',
        content: '请先登录后查看浏览历史',
        showCancel: false,
        success: () => {
          wx.reLaunch({
            url: '/pages/auth/login',
          });
        },
      });
      return;
    }

    void this.loadHistory();
  },

  async loadHistory() {
    this.setData({ loading: true });

    try {
      const list = await userService.getHistory();
      const withText: HistoryItem[] = (list || []).map(item => ({
        ...item,
        viewedAtText: formatTime(new Date(item.viewedAt).getTime()),
      }));

      this.setData({
        history: withText,
        loading: false,
      });
    } catch (error) {
      console.error('加载浏览历史失败:', error);
      this.setData({ history: [], loading: false });
      wx.showToast({
        title: '加载浏览历史失败',
        icon: 'none',
      });
    }
  },

  onItemTap(e: any) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;

    wx.navigateTo({
      url: `/pages/products/detail?id=${id}`,
    });
  },

  onClear() {
    wx.showModal({
      title: '清空历史',
      content: '确定要清空浏览历史吗？',
      success: async res => {
        if (res.confirm) {
          try {
            await userService.clearHistory();
            this.setData({ history: [] });
            wx.showToast({
              title: '已清空',
              icon: 'success',
            });
          } catch (error) {
            console.error('清空浏览历史失败:', error);
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
