// products/list.ts
// 产品列表页 - 已接入真实 API

import authService from '../../services/auth.service'
import categoryService from '../../services/category.service'
import productService from '../../services/product.service'
import type { Category } from '../../types/category'
import type { Product, ProductQueryParams } from '../../types/product'

interface DropdownOption {
  text: string
  value: string | number
}

type LayoutMode = 'list' | 'grid-2' | 'grid-3'

Page({
  data: {
    // 搜索
    searchValue: '',

    // 筛选
    showFilter: true,
    filterCategory: '0',
    filterStatus: '0',
    filterSort: '0',

    // 筛选选项
    categoryOptions: [
      { text: '全部', value: '0' },
      { text: '瓷砖', value: '1' },
      { text: '地板', value: '2' },
      { text: '墙砖', value: '3' },
      { text: '装饰材料', value: '4' },
    ] as DropdownOption[],

    statusOptions: [
      { text: '全部', value: '0' },
      { text: '有货', value: '1' },
      { text: '缺货', value: '2' },
      { text: '预警', value: '3' },
    ] as DropdownOption[],

    sortOptions: [
      { text: '默认', value: '0' },
      { text: '库存↓', value: '1' },
      { text: '库存↑', value: '2' },
      { text: '名称', value: '3' },
    ] as DropdownOption[],

    // 产品列表
    products: [] as Product[],

    // 分页
    page: 1,
    pageSize: 10,
    total: 0,

    // 状态
    loading: false,
    finished: false,

    // 布局模式
    layoutMode: 'list' as LayoutMode,

    // 是否允许查看数字库存（仅 admin / sales）
    canViewNumericInventory: false,

    // 分类原始数据（用于推断 1 级 / 2 级）
    allCategories: [] as Category[],

    // 分享相关（用于分类详情页分享）
    shareTitle: '产品列表',
    sharePath: '/pages/products/list',
  },

  async onLoad(options: Record<string, any>) {
    // 恢复用户保存的布局偏好
    const savedLayoutMode = wx.getStorageSync('layoutMode') as LayoutMode
    if (savedLayoutMode && ['list', 'grid-2', 'grid-3'].includes(savedLayoutMode)) {
      this.setData({ layoutMode: savedLayoutMode })
    } else {
      // 默认使用双列模式（最佳实践）
      this.setData({ layoutMode: 'grid-2' as LayoutMode })
    }

    // 从URL参数获取搜索关键词（与首页约定 keyword 参数）
    if (options.keyword) {
      this.setData({ searchValue: options.keyword })
    }

    // 从URL参数获取分类ID和名称
    if (options.categoryId) {
      this.setData({
        filterCategory: options.categoryId,
      })

      // 更新导航栏标题显示分类名称（先用当前分类名称，等分类列表加载后再用 1 级 + 2 级补全分享信息）
      if (options.categoryName) {
        wx.setNavigationBarTitle({
          title: `${options.categoryName} - 产品列表`,
        })
      }
    }

    // 加载分类数据
    this.loadCategories()

    // 初始化库存权限标记（游客可以进入，只是看不到数字库存）
    const canView = authService.canViewNumericInventory()
    this.setData({ canViewNumericInventory: canView })

    // 加载产品列表
    this.loadProducts(true)
  },

  onUnload() {
    // 保存用户的布局偏好
    wx.setStorageSync('layoutMode', this.data.layoutMode)
  },

  // 加载分类列表
  async loadCategories() {
    try {
      const categories = await categoryService.getCategories()

      // 将分类转换为“1级 / 2级 / 3级”路径形式，确保用户能看出层级关系
      const categoryMap = new Map<string, (typeof categories)[number]>()
      categories.forEach(cat => {
        categoryMap.set(cat.id, cat)
      })

      const labelCache = new Map<string, string>()

      const getCategoryLabel = (catId: string): string => {
        const cached = labelCache.get(catId)
        if (cached) return cached

        const names: string[] = []
        let current = categoryMap.get(catId)
        let depth = 0

        // 向上追溯到 1 级分类，最多 5 层防止异常数据
        while (current && depth < 5) {
          names.unshift(current.name)
          if (!current.parentId) break
          current = categoryMap.get(current.parentId)
          depth += 1
        }

        const label =
          names.length > 1 ? `${names[0]} / ${names.slice(1).join(' / ')}` : names[0]

        labelCache.set(catId, label)
        return label
      }

      // 生成带有“1级 / 2级( / 3级)”路径的选项，并按文案排序，保证同一 1 级下的 2 级挨在一起
      const enrichedOptions = categories
        .map(cat => {
          const text = getCategoryLabel(cat.id)
          return { text, value: cat.id } as DropdownOption
        })
        .sort((a, b) => a.text.localeCompare(b.text))

      const categoryOptions: DropdownOption[] = [
        { text: '全部分类', value: '0' },
        ...enrichedOptions,
      ]

      this.setData(
        {
          categoryOptions,
          allCategories: categories as Category[],
        },
        () => {
          // 分类加载完成后，根据当前筛选分类更新分享标题（带上 1 级分类）
          this.updateShareInfo()
        }
      )
    } catch (error) {
      console.error('加载分类失败:', error)
      // 失败时使用默认选项，不影响产品加载
    }
  },

  // 加载产品列表
  async loadProducts(reset = false) {
    if (this.data.loading) return

    if (reset) {
      this.setData({
        page: 1,
        products: [],
        finished: false,
      })
    }

    this.setData({ loading: true })

    try {
      // 构建查询参数
      const queryParams: Partial<ProductQueryParams> = {
        page: this.data.page,
        limit: this.data.pageSize,
        includeInventory: true,
      }

      // 搜索关键词
      if (this.data.searchValue) {
        queryParams.search = this.data.searchValue
      }

      // 分类筛选
      if (this.data.filterCategory !== '0') {
        queryParams.categoryId = this.data.filterCategory
      }

      // 状态筛选
      if (this.data.filterStatus !== '0') {
        if (this.data.filterStatus === '1') {
          // 有库存 - 由后端筛选
          queryParams.status = 'active'
        }
        // 缺货和库存预警需要在前端过滤
      }

      // 排序
      if (this.data.filterSort !== '0') {
        switch (this.data.filterSort) {
          case '1': // 库存从高到低
            queryParams.sortBy = 'inventory.availableQuantity'
            queryParams.sortOrder = 'desc'
            break
          case '2': // 库存从低到高
            queryParams.sortBy = 'inventory.availableQuantity'
            queryParams.sortOrder = 'asc'
            break
          case '3': // 名称A-Z
            queryParams.sortBy = 'name'
            queryParams.sortOrder = 'asc'
            break
          default:
            queryParams.sortBy = 'createdAt'
            queryParams.sortOrder = 'desc'
        }
      }

      // 调用产品服务
      const response = await productService.getProducts(queryParams)

      // 根据库存状态在前端进行过滤
      let filteredItems: Product[] = response.items
      if (this.data.filterStatus !== '0') {
        filteredItems = response.items.filter(product => {
          const inventory = product.inventory
          if (!inventory) return false

          const total = inventory.totalQuantity ?? 0
          const available = inventory.availableQuantity ?? 0

          switch (this.data.filterStatus) {
            case '1': // 有库存
              return available > 0
            case '2': // 缺货
              return available <= 0
            case '3': {
              // 库存预警：有库存但较低
              if (available <= 0) return false
              if (total > 0) {
                // 按比例判断：可用库存低于总库存的 20% 视为预警
                return available / total <= 0.2
              }
              // 没有总库存信息时，使用绝对值阈值
              return available <= 20
            }
            default:
              return true
          }
        })
      }

      // 合并数据
      const newProducts = reset
        ? filteredItems
        : [...this.data.products, ...filteredItems]

      // 更新状态
      this.setData({
        products: newProducts,
        total: response.pagination.total,
        finished: !response.pagination.hasNextPage,
        page: this.data.page + 1,
      })
    } catch (error) {
      console.error('加载产品失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      })
    } finally {
      this.setData({
        loading: false,
      })
    }
  },

  // 搜索
  onSearch() {
    this.loadProducts(true)
  },

  onSearchChange(e: any) {
    this.setData({ searchValue: e.detail })
  },

  onClearSearch() {
    this.setData({ searchValue: '' })
    this.loadProducts(true)
  },

  // 筛选
  toggleFilter() {
    this.setData({ showFilter: !this.data.showFilter })
  },

  onCategoryChange(e: any) {
    this.setData({ filterCategory: e.detail })
    this.updateShareInfo()
    this.loadProducts(true)
  },

  onStatusChange(e: any) {
    this.setData({ filterStatus: e.detail })
    this.loadProducts(true)
  },

  onSortChange(e: any) {
    this.setData({ filterSort: e.detail })
    this.loadProducts(true)
  },

  // 下拉刷新（微信原生）
  onPullDownRefresh() {
    this.loadProducts(true)
    wx.stopPullDownRefresh()
  },

  // 上拉加载更多
  onLoadMore() {
    if (!this.data.finished && !this.data.loading) {
      this.loadProducts(false)
    }
  },

  // 导航到详情页
  navigateToDetail(e: any) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/products/detail?id=${id}`,
    })
  },

  // 切换到指定布局模式
  switchToLayout(e: any) {
    const targetMode = e.currentTarget.dataset.mode as LayoutMode
    const currentMode = this.data.layoutMode as LayoutMode

    // 如果点击当前模式，不做处理
    if (targetMode === currentMode) {
      return
    }

    const modeNames: Record<LayoutMode, string> = {
      list: '单列模式',
      'grid-2': '双列模式',
      'grid-3': '三列模式',
    }

    // 更新布局模式
    this.setData({
      layoutMode: targetMode,
    })

    // 保存用户偏好
    wx.setStorageSync('layoutMode', targetMode)

    // 显示切换提示
    wx.showToast({
      title: modeNames[targetMode],
      icon: 'none',
      duration: 800,
    })
  },

  // 兼容旧的 toggleLayout 方法（如果有其他地方调用）
  toggleLayout() {
    const modes: LayoutMode[] = ['list', 'grid-2', 'grid-3']
    const currentMode = this.data.layoutMode as LayoutMode
    const currentIndex = modes.indexOf(currentMode)
    const nextIndex = (currentIndex + 1) % modes.length
    const nextMode = modes[nextIndex]

    this.setData({ layoutMode: nextMode })
    wx.setStorageSync('layoutMode', nextMode)

    const modeNames = ['单列模式', '双列模式', '三列模式']
    wx.showToast({
      title: modeNames[nextIndex],
      icon: 'none',
      duration: 800,
    })
  },

  // 根据当前筛选分类更新分享标题/路径
  updateShareInfo() {
    const { filterCategory, allCategories } = this.data as {
      filterCategory: string
      allCategories: Category[]
    }

    // 默认：全部列表
    let shareTitle = '产品列表'
    let sharePath = '/pages/products/list'

    if (filterCategory && filterCategory !== '0' && Array.isArray(allCategories) && allCategories.length > 0) {
      const map = new Map<string, Category>()
      allCategories.forEach(cat => map.set(cat.id, cat))

      const current = map.get(filterCategory)
      if (current) {
        // 向上追溯 1 级分类
        let root = current
        let depth = 0
        while (root.parentId && depth < 5) {
          const parent = map.get(root.parentId)
          if (!parent) break
          root = parent
          depth += 1
        }

        const parts: string[] = []
        if (root && root.name) {
          parts.push(root.name)
        }
        if (current && current.id !== root.id) {
          parts.push(current.name)
        }

        const core = parts.length > 0 ? parts.join(' / ') : current.name

        shareTitle = `${core} - 产品列表`
        sharePath = `/pages/products/list?categoryId=${current.id}&categoryName=${current.name}`
      }
    }

    this.setData({
      shareTitle,
      sharePath,
    })
  },

  // 分享给好友：支持从分类详情页分享当前筛选后的产品列表
  onShareAppMessage() {
    const title = this.data.shareTitle || '产品列表'
    const path = this.data.sharePath || '/pages/products/list'

    return {
      title,
      path,
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    const title = this.data.shareTitle || '产品列表'
    const path = this.data.sharePath || '/pages/products/list'

    // 朋友圈不支持 path，只支持 query
    const query = path.includes('?') ? path.split('?')[1] : ''

    return {
      title,
      query,
    }
  },
})
