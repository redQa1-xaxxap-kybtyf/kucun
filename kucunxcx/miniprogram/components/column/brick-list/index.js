'use strict';
/**
 * 用砖清单组件
 * 按面型分组展示用砖清单
 */
Component({
  options: {
    styleIsolation: 'apply-shared',
  },
  properties: {
    /** 用砖清单数据 */
    brickList: {
      type: Array,
      value: [],
    },
    /** 目标高度 */
    targetHeight: {
      type: Number,
      value: 0,
    },
    /** 用砖高度 */
    buildHeight: {
      type: Number,
      value: 0,
    },
    /** 高度差值 */
    delta: {
      type: Number,
      value: 0,
    },
    /** 切割位置 */
    cutPosition: {
      type: String,
      value: '',
    },
    /** 是否显示编辑按钮 */
    showEdit: {
      type: Boolean,
      value: false,
    },
    /** 是否显示切割说明 */
    showCutInfo: {
      type: Boolean,
      value: true,
    },
  },
  data: {
    /** 是否需要切割 */
    needCut: false,
    /** 状态类型 */
    statusType: 'perfect',
    /** 状态描述 */
    statusMessage: '',
  },
  observers: {
    delta: function (delta) {
      let statusType = 'perfect';
      let statusMessage = '';
      let needCut = false;
      if (delta === 0) {
        statusType = 'perfect';
        statusMessage = '高度完美匹配';
      } else if (delta > 0) {
        statusType = 'cut';
        statusMessage = `超出 ${delta}mm（需切割）`;
        needCut = true;
      } else {
        statusType = 'insufficient';
        statusMessage = `不足 ${Math.abs(delta)}mm`;
      }
      this.setData({ statusType, statusMessage, needCut });
    },
  },
  methods: {
    /**
     * 点击编辑切割位置
     */
    onEditCut() {
      this.triggerEvent('editcut');
    },
    /**
     * 点击砖块项
     */
    onItemTap(e) {
      const { faceType, item, index } = e.currentTarget.dataset;
      this.triggerEvent('itemtap', { faceType, item, index });
    },
    /**
     * 计算清单总数量
     */
    getTotalQuantity() {
      const list = this.data.brickList;
      let total = 0;
      list.forEach(faceType => {
        (faceType.items || []).forEach(item => {
          total += item.quantity || 0;
        });
      });
      return total;
    },
  },
});
