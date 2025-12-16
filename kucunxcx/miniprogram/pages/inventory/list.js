"use strict";
// inventory/list.ts
// 库存查询页
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const auth_service_1 = __importDefault(require("../../services/auth.service"));
const inventory_service_1 = __importDefault(require("../../services/inventory.service"));
const product_service_1 = __importDefault(require("../../services/product.service"));
const format_1 = require("../../utils/format");
Page({
    data: {
        searchValue: '',
        // 筛选
        filterProduct: '0',
        filterStatus: '0',
        productOptions: [{ text: '全部产品', value: '0' }],
        statusOptions: [
            { text: '全部状态', value: '0' },
            { text: '库存充足', value: '1' },
            { text: '库存预警', value: '2' },
            { text: '缺货', value: '3' },
        ],
        // 库存列表
        inventoryList: [],
        // 分页
        page: 1,
        pageSize: 10,
        total: 0,
        hasMore: true,
        // 加载状态
        loading: false,
        // 是否允许查看数字库存（仅 admin / sales）
        canViewNumericInventory: false,
    },
    onLoad(options) {
        // 如果从产品详情页跳转过来，可以传递productId
        if (options.productId) {
            this.setData({ filterProduct: options.productId });
        }
        // 加载产品选项
        this.loadProductOptions();
        // 初始化库存权限标记（游客模式下也允许进入，只是看不到数字库存）
        const canView = auth_service_1.default.canViewNumericInventory();
        this.setData({ canViewNumericInventory: canView });
        // 加载库存数据
        this.loadInventory(true);
    },
    // 每次返回库存列表页时自动刷新一次，确保看到最新库存数据
    onShow() {
        // 这里使用 reset=true，始终从第一页重新拉取，避免展示过期的分页数据
        this.loadInventory(true);
    },
    // 加载产品选项
    async loadProductOptions() {
        try {
            const response = await product_service_1.default.getProducts({
                page: 1,
                limit: 100,
                status: 'active',
            });
            const productOptions = [
                { text: '全部产品', value: '0' },
                ...response.items.map(product => ({
                    text: `${product.name} (${product.code})`,
                    value: product.id,
                })),
            ];
            this.setData({ productOptions });
        }
        catch (error) {
            console.error('加载产品选项失败:', error);
            // 失败时不影响主流程,使用默认选项
        }
    },
    // 加载库存数据
    async loadInventory(reset = false) {
        if (this.data.loading)
            return;
        if (reset) {
            this.setData({
                page: 1,
                inventoryList: [],
                hasMore: true,
            });
        }
        this.setData({ loading: true });
        try {
            // 构建查询参数
            const queryParams = {
                page: this.data.page,
                limit: this.data.pageSize,
            };
            // 搜索关键词
            if (this.data.searchValue) {
                queryParams.search = this.data.searchValue;
            }
            // 产品筛选
            if (this.data.filterProduct !== '0') {
                queryParams.productId = this.data.filterProduct;
            }
            // 状态筛选
            if (this.data.filterStatus !== '0') {
                switch (this.data.filterStatus) {
                    case '1': // 库存充足
                        queryParams.hasStock = true;
                        break;
                    case '2': // 库存预警
                        queryParams.lowStock = true;
                        break;
                    case '3': // 缺货
                        queryParams.hasStock = false;
                        break;
                }
            }
            // 调用库存服务
            const response = await inventory_service_1.default.getInventoryList(queryParams);
            // 处理库存数据,添加状态信息与时间展示
            const inventoryListWithStatus = response.inventories.map(item => {
                let statusType = 'success';
                let statusText = '充足';
                if (item.availableQuantity === 0) {
                    statusType = 'danger';
                    statusText = '缺货';
                }
                else if (item.availableQuantity < item.quantity * 0.2) {
                    statusType = 'warning';
                    statusText = '预警';
                }
                return {
                    ...item,
                    // 统一格式化更新时间，避免直接展示 ISO 字符串
                    updatedAt: (0, format_1.formatDateTime)(item.updatedAt),
                    statusType,
                    statusText,
                };
            });
            // 合并数据
            const newInventoryList = reset
                ? inventoryListWithStatus
                : [...this.data.inventoryList, ...inventoryListWithStatus];
            this.setData({
                inventoryList: newInventoryList,
                total: response.pagination.total,
                hasMore: response.pagination.page < response.pagination.totalPages,
                page: this.data.page + 1,
            });
        }
        catch (error) {
            console.error('加载库存失败:', error);
            wx.showToast({
                title: '加载失败',
                icon: 'none',
                duration: 2000,
            });
        }
        finally {
            this.setData({ loading: false });
        }
    },
    // 搜索
    onSearch() {
        this.loadInventory(true);
    },
    onSearchChange(e) {
        this.setData({ searchValue: e.detail });
    },
    // 筛选
    onProductChange(e) {
        this.setData({ filterProduct: e.detail });
        this.loadInventory(true);
    },
    onStatusChange(e) {
        this.setData({ filterStatus: e.detail });
        this.loadInventory(true);
    },
    // 下拉刷新（微信原生）
    onPullDownRefresh() {
        this.loadInventory(true);
        wx.stopPullDownRefresh();
    },
    // 上拉加载更多
    onLoadMore() {
        if (!this.data.loading && this.data.hasMore) {
            this.loadInventory(false);
        }
    },
    // 查看详情
    navigateToDetail(e) {
        const { id } = e.currentTarget.dataset;
        wx.navigateTo({
            url: `/pages/inventory/detail?id=${id}`,
        });
    },
});
