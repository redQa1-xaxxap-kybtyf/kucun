/**
 * 素材卡片组件
 * 可复用的罗马柱素材展示卡片
 */

Component({
  options: {
    styleIsolation: 'apply-shared',
  },

  properties: {
    /** 素材数据 */
    material: {
      type: Object,
      value: () => ({}),
    },
    /** 是否选中状态 */
    selected: {
      type: Boolean,
      value: false,
    },
    /** 是否显示添加按钮 */
    showAddButton: {
      type: Boolean,
      value: true,
    },
    /** 卡片模式：list（列表）/ grid（网格） */
    mode: {
      type: String,
      value: 'list',
    },
  },

  data: {},

  methods: {
    /**
     * 点击卡片
     */
    onTap() {
      this.triggerEvent('tap', { material: this.data.material });
    },

    /**
     * 点击添加按钮
     */
    onAdd() {
      this.triggerEvent('add', { material: this.data.material });
    },

    /**
     * 长按卡片
     */
    onLongPress() {
      this.triggerEvent('longpress', { material: this.data.material });
    },
  },
});
