const { getProductGroup } = require('../../utils/catalog');

Page({
  data: {
    loading: true,
    error: '',
    groupId: '',
    group: null,
  },

  onLoad(options) {
    this.setData({
      groupId: decodeURIComponent(options.id || ''),
    });
    this.loadGroup();
  },

  onShow() {
    if (wx.showShareMenu) {
      wx.showShareMenu({
        menus: ['shareAppMessage', 'shareTimeline'],
      });
    }
  },

  onShareAppMessage() {
    const group = this.data.group;
    return {
      title: group ? `${group.title}｜产品规格和实拍图` : '外墙罗马柱产品组',
      path: `/pages/group/detail?id=${encodeURIComponent(this.data.groupId)}`,
      imageUrl: group && group.coverUrl ? group.coverUrl : undefined,
    };
  },

  onShareTimeline() {
    const group = this.data.group;
    return {
      title: group ? `${group.title}｜产品规格和实拍图` : '外墙罗马柱产品组',
      query: `id=${encodeURIComponent(this.data.groupId)}`,
      imageUrl: group && group.coverUrl ? group.coverUrl : undefined,
    };
  },

  async loadGroup() {
    this.setData({ loading: true, error: '' });

    try {
      const group = await getProductGroup(this.data.groupId);
      this.setData({ group, loading: false });
    } catch (error) {
      this.setData({
        error: error.message || '加载失败',
        loading: false,
      });
    }
  },

  onProductTap(event) {
    wx.navigateTo({
      url: `/pages/product/detail?id=${event.currentTarget.dataset.id}`,
    });
  },

  onRelatedGroupTap(event) {
    wx.navigateTo({
      url: `/pages/group/detail?id=${encodeURIComponent(event.currentTarget.dataset.id)}`,
    });
  },
});
