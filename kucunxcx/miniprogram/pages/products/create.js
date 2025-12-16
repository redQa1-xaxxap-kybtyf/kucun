"use strict";
// products/create.ts
// 产品创建页
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const auth_service_1 = __importDefault(require("../../services/auth.service"));
const category_service_1 = require("../../services/category.service");
const product_service_1 = require("../../services/product.service");
const api_1 = require("../../config/api");
const request_1 = require("../../utils/request");
Page({
    data: {
        // 是否为编辑模式
        isEditMode: false,
        productId: '',
        code: '',
        name: '',
        specification: '',
        description: '',
        thickness: '',
        categoryId: '',
        categoryName: '',
        categories: [],
        submitting: false,
        // 图片相关
        thumbnailUrl: '',
        // backend 返回的上传记录（可选）
        uploadInfo: null,
        mainImages: [],
        effectImages: [],
    },
    async onLoad(options) {
        // 未登录时跳转到登录页
        if (!auth_service_1.default.isLoggedIn()) {
            wx.reLaunch({
                url: '/pages/auth/login',
            });
            return;
        }
        // 必须是管理员或销售才可以创建 / 编辑产品
        if (!auth_service_1.default.canEditProduct()) {
            wx.showToast({
                title: '无权编辑产品',
                icon: 'none',
            });
            setTimeout(() => {
                wx.navigateBack();
            }, 1500);
            return;
        }
        const isEditMode = !!options?.id;
        if (isEditMode) {
            this.setData({
                isEditMode: true,
                productId: options.id,
            });
            wx.setNavigationBarTitle({
                title: '编辑产品',
            });
            await this.loadCategories();
            await this.loadProductDetail(options.id);
        }
        else {
            wx.setNavigationBarTitle({
                title: '创建产品',
            });
            await this.loadCategories();
        }
    },
    async loadProductDetail(id) {
        try {
            const product = await product_service_1.productService.getProductDetail(id);
            // 回填表单数据
            this.setData({
                code: product.code,
                name: product.name,
                specification: product.specification || '',
                description: product.description || '',
                thickness: product.thickness ? String(product.thickness) : '',
                categoryId: product.category?.id || product.categoryId || '',
                categoryName: product.category?.name || '',
                thumbnailUrl: product.thumbnailUrl || '',
                mainImages: product.mainImages || product.images || [],
                effectImages: product.effectImages || [],
            });
        }
        catch (error) {
            console.error('加载产品详情失败(编辑模式):', error);
            wx.showToast({
                title: '加载产品信息失败',
                icon: 'none',
            });
        }
    },
    async loadCategories() {
        try {
            const categories = await category_service_1.categoryService.getCategories();
            this.setData({ categories });
        }
        catch (error) {
            console.error('加载分类失败:', error);
            wx.showToast({
                title: '加载分类失败',
                icon: 'none',
            });
        }
    },
    // 输入事件
    onCodeInput(e) {
        this.setData({ code: e.detail.value });
    },
    onNameInput(e) {
        this.setData({ name: e.detail.value });
    },
    onSpecInput(e) {
        this.setData({ specification: e.detail.value });
    },
    onDescInput(e) {
        this.setData({ description: e.detail.value });
    },
    onThicknessInput(e) {
        this.setData({ thickness: e.detail.value });
    },
    // 分类选择
    onCategoryChange(e) {
        const index = Number(e.detail.value);
        const categories = this.data.categories || [];
        if (!categories.length || index < 0 || index >= categories.length) {
            return;
        }
        const category = categories[index];
        this.setData({
            categoryId: category.id,
            categoryName: category.name,
        });
    },
    // 通用图片选择入口
    chooseImageAndUpload(kind) {
        const that = this;
        wx.chooseImage({
            count: 1,
            sizeType: ['compressed'],
            sourceType: ['album', 'camera'],
            success(res) {
                if (!res.tempFilePaths || !res.tempFilePaths.length) {
                    return;
                }
                const filePath = res.tempFilePaths[0];
                // 根据类型限制大小（缩略图/主图 1MB，效果图 2MB）
                const maxSizeMb = kind === 'effect' ? 2 : 1;
                const fileInfo = res.tempFiles && res.tempFiles[0];
                if (fileInfo && typeof fileInfo.size === 'number') {
                    const sizeMb = fileInfo.size / (1024 * 1024);
                    if (sizeMb > maxSizeMb) {
                        wx.showToast({
                            title: `${kind === 'effect' ? '效果图' : '图片'}不能超过 ${maxSizeMb}MB`,
                            icon: 'none',
                        });
                        return;
                    }
                }
                that.uploadImage(filePath, kind);
            },
            fail(err) {
                const msg = String(err?.errMsg || '');
                // 取消也给一个轻提示，避免用户误以为“没反应”
                if (msg.includes('cancel')) {
                    wx.showToast({ title: '已取消', icon: 'none', duration: 1200 });
                    return;
                }
                wx.showToast({
                    title: '无法选择图片，请检查相册/相机权限',
                    icon: 'none',
                    duration: 2000,
                });
                console.error('选择图片失败:', err);
            },
        });
    },
    // 选择主图
    onChooseThumbnail() {
        this.chooseImageAndUpload('thumbnail');
    },
    // 添加主图（多张）
    onAddMainImage() {
        this.chooseImageAndUpload('main');
    },
    // 添加效果图
    onAddEffectImage() {
        this.chooseImageAndUpload('effect');
    },
    // 预览主图
    onPreviewThumbnail() {
        const url = this.data.thumbnailUrl;
        if (!url)
            return;
        wx.previewImage({
            current: url,
            urls: [url],
        });
    },
    // 缩略图点击：支持预览/更换/删除（编辑模式下更符合直觉）
    onThumbnailTap() {
        const url = this.data.thumbnailUrl;
        if (!url) {
            this.onChooseThumbnail();
            return;
        }
        wx.showActionSheet({
            itemList: ['预览', '更换', '删除'],
            success: res => {
                if (res.tapIndex === 0) {
                    this.onPreviewThumbnail();
                }
                else if (res.tapIndex === 1) {
                    this.onChooseThumbnail();
                }
                else if (res.tapIndex === 2) {
                    this.setData({ thumbnailUrl: '', uploadInfo: null });
                    wx.showToast({ title: '已删除缩略图', icon: 'none' });
                }
            },
            fail: err => {
                const msg = String(err?.errMsg || '');
                if (msg && !msg.includes('cancel')) {
                    wx.showToast({ title: '操作失败', icon: 'none' });
                }
            },
        });
    },
    // 预览主图/效果图
    onPreviewMainImage(e) {
        const idx = e.currentTarget.dataset.index;
        const list = this.data.mainImages || [];
        if (!list.length)
            return;
        wx.previewImage({
            current: list[idx] || list[0],
            urls: list,
        });
    },
    onPreviewEffectImage(e) {
        const idx = e.currentTarget.dataset.index;
        const list = this.data.effectImages || [];
        if (!list.length)
            return;
        wx.previewImage({
            current: list[idx] || list[0],
            urls: list,
        });
    },
    // 删除主图/效果图
    onRemoveMainImage(e) {
        const idx = e.currentTarget.dataset.index;
        const list = (this.data.mainImages || []).slice();
        if (idx >= 0 && idx < list.length) {
            list.splice(idx, 1);
            this.setData({ mainImages: list });
        }
    },
    onRemoveEffectImage(e) {
        const idx = e.currentTarget.dataset.index;
        const list = (this.data.effectImages || []).slice();
        if (idx >= 0 && idx < list.length) {
            list.splice(idx, 1);
            this.setData({ effectImages: list });
        }
    },
    // 上传图片到后台 /api/upload
    async uploadImage(filePath, kind) {
        const token = wx.getStorageSync(api_1.TOKEN_KEY);
        const baseURL = api_1.apiConfig.baseURL || '';
        if (!baseURL || !/^https?:\/\//.test(baseURL)) {
            wx.showToast({ title: '未配置 API 地址', icon: 'none' });
            return;
        }
        let loadingActive = true;
        const stopLoading = () => {
            if (!loadingActive)
                return;
            loadingActive = false;
            (0, request_1.hideGlobalLoading)();
        };
        (0, request_1.showGlobalLoading)({ title: '上传中...', mask: true });
        // 1) 小程序优先直传七牛：先向后端申请 uploadToken/key
        try {
            if (token) {
                const fileName = (filePath.split('/').pop() || 'image.jpg').trim();
                const directParams = await new Promise((resolve, reject) => {
                    wx.request({
                        url: `${baseURL}/upload/qiniu-token`,
                        method: 'POST',
                        header: {
                            Authorization: `Bearer ${token}`,
                            // 兼容部分代理/网关可能不透传 Authorization 头的情况
                            'x-mini-token': token,
                            'x-client-from': 'mini-program',
                            'Content-Type': 'application/json',
                        },
                        data: {
                            type: 'product',
                            kind,
                            fileName,
                        },
                        success: res => resolve(res),
                        fail: err => reject(err),
                    });
                });
                // 直传初始化失败时给用户明确提示（然后自动回退服务器上传）
                if (directParams && directParams.statusCode === 401) {
                    wx.showToast({ title: '请先登录', icon: 'none' });
                    auth_service_1.default.clearAuth();
                    wx.reLaunch({ url: '/pages/auth/login' });
                    stopLoading();
                    return;
                }
                if (directParams &&
                    directParams.statusCode >= 200 &&
                    directParams.statusCode < 300 &&
                    directParams.data &&
                    directParams.data.success &&
                    directParams.data.data &&
                    directParams.data.data.uploadToken &&
                    directParams.data.data.key &&
                    directParams.data.data.uploadHost &&
                    directParams.data.data.url) {
                    const { uploadToken, key, uploadHost, fallbackUploadHosts, url, } = directParams.data.data;
                    const hosts = [uploadHost]
                        .concat(Array.isArray(fallbackUploadHosts) ? fallbackUploadHosts : [])
                        .filter(Boolean);
                    let lastErrMsg = '';
                    // 直传七牛（失败再走 /api/upload）
                    for (const host of hosts.slice(0, 3)) {
                        try {
                            const qiniuRes = await new Promise((resolve, reject) => {
                                wx.uploadFile({
                                    url: host,
                                    filePath,
                                    name: 'file',
                                    formData: {
                                        token: uploadToken,
                                        key,
                                    },
                                    success: res => resolve(res),
                                    fail: err => reject(err),
                                });
                            });
                            if (qiniuRes && qiniuRes.statusCode === 200) {
                                if (kind === 'thumbnail') {
                                    this.setData({ thumbnailUrl: url, uploadInfo: { url, key } });
                                }
                                else if (kind === 'main') {
                                    const list = (this.data.mainImages || []).slice();
                                    list.push(url);
                                    this.setData({ mainImages: list });
                                }
                                else if (kind === 'effect') {
                                    const list = (this.data.effectImages || []).slice();
                                    list.push(url);
                                    this.setData({ effectImages: list });
                                }
                                stopLoading();
                                return;
                            }
                            // 七牛可能返回非 200，尝试解析错误信息
                            let qiniuErrorText = '';
                            try {
                                const parsed = JSON.parse(qiniuRes?.data || '{}');
                                qiniuErrorText = String(parsed?.error || parsed?.message || '');
                            }
                            catch (_e) {
                                qiniuErrorText = String(qiniuRes?.data || '');
                            }
                            lastErrMsg = `HTTP ${qiniuRes?.statusCode ?? '未知'} ${qiniuErrorText || ''}`.trim();
                        }
                        catch (err) {
                            const msg = String(err?.errMsg || err?.message || '');
                            lastErrMsg = msg || 'uploadFile 失败';
                            // 域名未配置是最高频原因，直接给可操作提示
                            if (msg.includes('url not in domain list') || msg.includes('domain list')) {
                                let hostName = host;
                                try {
                                    hostName = new URL(host).host;
                                }
                                catch (_e) {
                                    // ignore
                                }
                                wx.showToast({
                                    title: `直传失败：请在小程序后台 uploadFile 合法域名加入 ${hostName}`.slice(0, 30),
                                    icon: 'none',
                                    duration: 3500,
                                });
                                break;
                            }
                        }
                    }
                    wx.showToast({
                        title: `七牛直传失败，已切换服务器上传${lastErrMsg ? `：${lastErrMsg}` : ''}`.slice(0, 28),
                        icon: 'none',
                        duration: 2500,
                    });
                }
                else {
                    const msg = (directParams &&
                        directParams.data &&
                        (directParams.data.error || directParams.data.message)) ||
                        `直传初始化失败(HTTP ${directParams?.statusCode ?? '未知'})`;
                    wx.showToast({
                        title: `直传失败：${String(msg).slice(0, 18)}`,
                        icon: 'none',
                        duration: 2500,
                    });
                }
            }
        }
        catch (error) {
            // 直传出错时给轻提示（然后自动回退服务器上传）
            wx.showToast({
                title: '直传失败，已切换服务器上传',
                icon: 'none',
                duration: 2000,
            });
            console.warn('Qiniu direct upload failed, fallback to /api/upload', error);
        }
        // 2) 兜底：走后端 /api/upload（七牛失败会在后端兜底到本地）
        wx.uploadFile({
            url: `${baseURL}/upload`,
            filePath,
            name: 'file',
            formData: { type: 'product', kind },
            header: token
                ? {
                    Authorization: `Bearer ${token}`,
                    // 兼容部分代理/网关可能不透传 Authorization 头的情况
                    'x-mini-token': token,
                    'x-client-from': 'mini-program',
                }
                : {},
            success: res => {
                try {
                    const raw = JSON.parse(res.data || '{}');
                    // uploadFile 的 success 也会在 4xx/5xx 触发，这里手动处理状态码
                    if (res.statusCode === 401) {
                        wx.showToast({ title: '请先登录', icon: 'none' });
                        auth_service_1.default.clearAuth();
                        wx.reLaunch({ url: '/pages/auth/login' });
                        return;
                    }
                    if (res.statusCode < 200 || res.statusCode >= 300) {
                        const msg = (raw && (raw.error || raw.message)) || '上传失败';
                        wx.showToast({ title: msg, icon: 'none' });
                        return;
                    }
                    if (raw && raw.success && raw.data && raw.data.url) {
                        const url = raw.data.url;
                        if (kind === 'thumbnail') {
                            this.setData({
                                thumbnailUrl: url,
                                uploadInfo: raw.data,
                            });
                        }
                        else if (kind === 'main') {
                            const list = (this.data.mainImages || []).slice();
                            list.push(url);
                            this.setData({ mainImages: list });
                        }
                        else if (kind === 'effect') {
                            const list = (this.data.effectImages || []).slice();
                            list.push(url);
                            this.setData({ effectImages: list });
                        }
                    }
                    else {
                        const msg = (raw && (raw.error || raw.message)) || '上传失败';
                        wx.showToast({ title: msg, icon: 'none' });
                    }
                }
                catch (e) {
                    console.error('解析上传响应失败:', e);
                    wx.showToast({ title: '上传返回解析失败', icon: 'none' });
                }
            },
            fail: err => {
                console.error('上传图片失败:', err);
                wx.showToast({ title: '上传失败', icon: 'none' });
            },
            complete: () => {
                stopLoading();
            },
        });
    },
    // 提交创建/更新
    async onSubmit() {
        if (this.data.submitting)
            return;
        const code = this.data.code.trim();
        const name = this.data.name.trim();
        const specification = this.data.specification.trim();
        const categoryId = this.data.categoryId;
        if (!code) {
            wx.showToast({ title: '请输入产品编号', icon: 'none' });
            return;
        }
        if (!name) {
            wx.showToast({ title: '请输入产品名称', icon: 'none' });
            return;
        }
        if (!specification) {
            wx.showToast({ title: '请输入规格', icon: 'none' });
            return;
        }
        if (!categoryId) {
            wx.showToast({ title: '请选择分类', icon: 'none' });
            return;
        }
        let thicknessNumber;
        const thicknessRaw = this.data.thickness.trim();
        if (thicknessRaw) {
            const parsed = Number(thicknessRaw);
            if (Number.isNaN(parsed) || parsed < 0) {
                wx.showToast({ title: '厚度必须为数字', icon: 'none' });
                return;
            }
            thicknessNumber = parsed;
        }
        this.setData({ submitting: true });
        try {
            // 如果缩略图没有选择，自动使用主图的第一张
            const thumbnailUrl = this.data.thumbnailUrl ||
                (this.data.mainImages && this.data.mainImages.length > 0
                    ? this.data.mainImages[0]
                    : undefined);
            const payload = {
                code,
                name,
                specification,
                description: this.data.description.trim(),
                thickness: thicknessNumber,
                categoryId,
                thumbnailUrl,
                mainImages: this.data.mainImages || [],
                effectImages: this.data.effectImages || [],
            };
            let product;
            if (this.data.isEditMode && this.data.productId) {
                product = await product_service_1.productService.updateProduct(this.data.productId, payload);
                wx.showToast({
                    title: '更新成功',
                    icon: 'success',
                    duration: 1500,
                });
            }
            else {
                product = await product_service_1.productService.createProduct(payload);
                wx.showToast({
                    title: '创建成功',
                    icon: 'success',
                    duration: 1500,
                });
            }
            setTimeout(() => {
                if (product && product.id) {
                    wx.redirectTo({
                        url: `/pages/products/detail?id=${product.id}`,
                    });
                }
                else {
                    wx.redirectTo({
                        url: '/pages/products/list',
                    });
                }
            }, 1500);
        }
        catch (error) {
            console.error('创建产品失败:', error);
            // 具体错误提示已在 request.ts 中处理，这里只重置状态
        }
        finally {
            this.setData({ submitting: false });
        }
    },
});
