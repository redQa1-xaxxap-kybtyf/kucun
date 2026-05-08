<template>
  <view class="page products-page safe-bottom">
    <view class="header">
      <view>
        <view class="title">产品维护</view>
        <view class="desc">先迁移列表、库存和上下架入口</view>
      </view>
      <button class="add-btn" @tap="comingSoon">新增</button>
    </view>

    <view class="tabs">
      <view
        v-for="tab in statusTabs"
        :key="tab.value"
        :class="['tab', status === tab.value ? 'active' : '']"
        @tap="changeStatus(tab.value)"
      >
        {{ tab.label }}
      </view>
    </view>

    <view class="search-card">
      <input
        v-model="search"
        class="search-input"
        confirm-type="search"
        placeholder="输入编码、名称、规格"
        @confirm="loadProducts"
      />
      <button v-if="search" class="clear-btn" @tap="clearSearch">清空</button>
    </view>

    <view v-if="error" class="notice">{{ error }}</view>
    <view v-if="loading" class="empty">正在加载产品...</view>

    <view v-else class="product-list">
      <view v-if="products.length === 0" class="empty-card">没有产品记录</view>
      <view v-for="item in products" :key="item.id" class="product-row">
        <image
          v-if="item.coverUrl"
          class="cover"
          :src="item.coverUrl"
          mode="aspectFill"
        />
        <view v-else class="cover fallback">图</view>
        <view class="product-main">
          <view class="name line-1">{{ item.name }}</view>
          <view class="meta line-1">{{ item.code }} · {{ item.specification }}</view>
          <view class="stock-row">
            <text>库存 {{ item.totalQuantity }}</text>
            <text>可用 {{ item.availableQuantity }}</text>
            <text :class="['status-chip', item.status === 'active' ? 'active' : '']">
              {{ item.statusLabel }}
            </text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app';

import { requireAdminSession } from '../../../utils/auth';
import { getProducts } from '../../../utils/products';

const statusTabs = [
  { label: '正常', value: 'active' },
  { label: '全部', value: 'all' },
  { label: '已下架', value: 'inactive' },
];

const loading = ref(false);
const error = ref('');
const search = ref('');
const status = ref('active');
const products = ref([]);

function toNumber(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeProduct(item) {
  const inventory = item.inventory || {};
  const images = Array.isArray(item.images) ? item.images : [];
  return {
    id: item.id,
    code: item.code || '-',
    name: item.name || '-',
    specification: item.specification || '未填写规格',
    coverUrl: item.thumbnailUrl || (images[0] && images[0].url) || '',
    status: item.status || 'active',
    statusLabel: item.status === 'inactive' ? '已下架' : '正常',
    totalQuantity: toNumber(inventory.totalQuantity),
    availableQuantity: toNumber(inventory.availableQuantity),
  };
}

async function loadProducts() {
  loading.value = true;
  error.value = '';

  try {
    const params = {
      page: 1,
      limit: 30,
      search: search.value.trim(),
    };
    if (status.value !== 'all') {
      params.status = status.value;
    }
    const data = await getProducts(params);
    products.value = (data.data || []).map(normalizeProduct);
  } catch (err) {
    error.value = err.message || '产品加载失败';
    if (error.value.includes('未授权')) {
      uni.navigateTo({ url: '/pages/admin/login/index' });
    }
  } finally {
    loading.value = false;
  }
}

function changeStatus(nextStatus) {
  status.value = nextStatus;
  loadProducts();
}

function clearSearch() {
  search.value = '';
  loadProducts();
}

function comingSoon() {
  uni.showToast({ title: '产品表单下一步迁移', icon: 'none' });
}

onLoad(() => {
  if (!requireAdminSession()) return;
  loadProducts();
});

onPullDownRefresh(() => {
  loadProducts().finally(() => uni.stopPullDownRefresh());
});
</script>

<style scoped>
.products-page {
  padding: 30rpx 24rpx 42rpx;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
  padding: 8rpx 2rpx 22rpx;
}

.title {
  color: #111827;
  font-size: 40rpx;
  font-weight: 900;
}

.desc {
  margin-top: 8rpx;
  color: #667085;
  font-size: 25rpx;
}

.add-btn {
  width: 96rpx;
  height: 58rpx;
  margin: 0;
  border-radius: 8rpx;
  background: #176b5b;
  color: #fff;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 58rpx;
}

.tabs {
  display: flex;
  gap: 10rpx;
  margin-bottom: 14rpx;
}

.tab {
  flex: 1;
  height: 62rpx;
  border: 1rpx solid #d9e0dd;
  border-radius: 8rpx;
  background: #fff;
  color: #344054;
  font-size: 25rpx;
  font-weight: 900;
  line-height: 62rpx;
  text-align: center;
}

.tab.active {
  border-color: #176b5b;
  background: #176b5b;
  color: #fff;
}

.search-card {
  display: flex;
  align-items: center;
  gap: 12rpx;
  height: 78rpx;
  padding: 0 14rpx 0 18rpx;
  border: 1rpx solid #d9e0dd;
  border-radius: 8rpx;
  background: #fff;
}

.search-input {
  flex: 1;
  height: 76rpx;
  font-size: 27rpx;
}

.clear-btn {
  width: 82rpx;
  height: 54rpx;
  margin: 0;
  border-radius: 8rpx;
  background: #eef2f0;
  color: #667085;
  font-size: 22rpx;
  font-weight: 900;
  line-height: 54rpx;
}

.product-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 18rpx;
}

.product-row {
  display: flex;
  gap: 16rpx;
  padding: 16rpx;
  border: 1rpx solid #d9e0dd;
  border-radius: 8rpx;
  background: #fff;
}

.cover {
  width: 112rpx;
  height: 112rpx;
  flex: none;
  border-radius: 8rpx;
  background: #eef2f0;
}

.fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #98a2b3;
  font-size: 22rpx;
  font-weight: 900;
}

.product-main {
  flex: 1;
  min-width: 0;
}

.name {
  color: #111827;
  font-size: 28rpx;
  font-weight: 900;
}

.meta {
  margin-top: 7rpx;
  color: #667085;
  font-size: 23rpx;
}

.stock-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 10rpx;
  color: #344054;
  font-size: 22rpx;
  font-weight: 800;
}

.status-chip {
  padding: 0 10rpx;
  border-radius: 8rpx;
  background: #eef2f0;
  color: #667085;
}

.status-chip.active {
  background: #e9f3f0;
  color: #176b5b;
}

.empty-card {
  padding: 54rpx 20rpx;
  border: 1rpx solid #d9e0dd;
  border-radius: 8rpx;
  background: #fff;
  color: #667085;
  font-size: 26rpx;
  text-align: center;
}
</style>
