// 底部导航组件
import authService from '../../services/auth.service';

Component({
  properties: {
    // 当前激活的菜单项: home | categories | inventory | user
    active: {
      type: String,
      value: 'home',
    },
  },

  data: {
    canCreateProduct: false,
  },

  lifetimes: {
    attached() {
      // 初始化权限
      const canManage = authService.canViewNumericInventory();
      this.setData({ canCreateProduct: canManage });
    },
  },

  pageLifetimes: {
    show() {
      // 每次页面显示时刷新权限状态
      const canManage = authService.canViewNumericInventory();
      this.setData({ canCreateProduct: canManage });
    },
  },

  methods: {
    navigateToHome() {
      if (this.properties.active === 'home') return;
      wx.vibrateShort?.({ type: 'light' });
      wx.reLaunch({ url: '/pages/index/index' });
    },

    navigateToCategories() {
      if (this.properties.active === 'categories') return;
      wx.vibrateShort?.({ type: 'light' });
      wx.navigateTo({ url: '/pages/categories/list' });
    },

    // 中间按钮：管理员/销售 → 创建产品，普通用户/访客 → 效果图
    onCenterTap() {
      wx.vibrateShort?.({ type: 'light' });
      if (this.data.canCreateProduct) {
        wx.navigateTo({ url: '/pages/products/create' });
      } else {
        wx.navigateTo({ url: '/pages/effects/list' });
      }
    },

    navigateToInventory() {
      if (this.properties.active === 'inventory') return;
      wx.vibrateShort?.({ type: 'light' });
      wx.navigateTo({ url: '/pages/inventory/list' });
    },

    navigateToUser() {
      if (this.properties.active === 'user') return;
      wx.vibrateShort?.({ type: 'light' });
      wx.navigateTo({ url: '/pages/user/profile' });
    },
  },
});
