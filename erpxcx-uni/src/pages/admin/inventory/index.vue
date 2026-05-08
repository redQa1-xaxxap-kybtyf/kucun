<template>
  <view class="page list-page safe-bottom">
    <view class="header">
      <view class="title">库存查询</view>
      <view class="desc">按编码、名称、批次查库存</view>
    </view>

    <view class="search-card">
      <input
        v-model="search"
        class="search-input"
        confirm-type="search"
        placeholder="输入编码、名称、批次"
        @confirm="loadInventories"
      />
      <button class="scan-btn" @tap="scanCode">扫码</button>
    </view>

    <view v-if="error" class="notice">{{ error }}</view>
    <view v-if="loading" class="empty">正在加载库存...</view>

    <view v-else class="rows">
      <view v-if="inventories.length === 0" class="empty-card">没有库存记录</view>
      <view v-for="item in inventories" :key="item.id" class="inventory-row">
        <view class="row-main">
          <view class="name line-1">{{ item.name }}</view>
          <view class="meta line-1">{{ item.code }} · {{ item.specification }}</view>
          <view class="meta line-1">
            批次 {{ item.batchNumber }} · 库位 {{ item.location }}
          </view>
        </view>
        <view class="qty-box">
          <view class="qty">{{ item.availableQuantity }}</view>
          <view class="qty-label">可用</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app';

import { requireAdminSession } from '../../../utils/auth';
import { getInventories } from '../../../utils/inventory';

const loading = ref(false);
const error = ref('');
const search = ref('');
const inventories = ref([]);

function toNumber(value) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeInventory(item) {
  const product = item.product || {};
  const totalQuantity = toNumber(item.quantity || item.totalQuantity);
  const reservedQuantity = toNumber(item.reservedQuantity);
  const availableQuantity = toNumber(
    item.availableQuantity !== undefined
      ? item.availableQuantity
      : totalQuantity - reservedQuantity
  );

  return {
    id: item.id || product.id || `${product.code || ''}-${item.batchNumber || ''}`,
    code: product.code || item.productCode || '-',
    name: product.name || item.productName || '-',
    specification: product.specification || item.specification || '未填规格',
    batchNumber: item.batchNumber || '未填批次',
    location: item.location || '未填库位',
    availableQuantity,
  };
}

async function loadInventories() {
  loading.value = true;
  error.value = '';

  try {
    const data = await getInventories({
      page: 1,
      limit: 30,
      search: search.value.trim(),
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });
    inventories.value = (data.inventories || []).map(normalizeInventory);
  } catch (err) {
    error.value = err.message || '库存加载失败';
    if (error.value.includes('未授权')) {
      uni.navigateTo({ url: '/pages/admin/login/index' });
    }
  } finally {
    loading.value = false;
  }
}

function scanCode() {
  uni.scanCode({
    success(result) {
      search.value = result.result;
      loadInventories();
    },
    fail() {
      uni.showToast({ title: '未识别到编码', icon: 'none' });
    },
  });
}

onLoad(() => {
  if (!requireAdminSession()) return;
  loadInventories();
});

onPullDownRefresh(() => {
  loadInventories().finally(() => uni.stopPullDownRefresh());
});
</script>

<style scoped>
.list-page {
  padding: 30rpx 24rpx 42rpx;
}

.header {
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

.scan-btn {
  width: 92rpx;
  height: 56rpx;
  margin: 0;
  border-radius: 8rpx;
  background: #176b5b;
  color: #fff;
  font-size: 23rpx;
  font-weight: 900;
  line-height: 56rpx;
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 18rpx;
}

.inventory-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 18rpx;
  border: 1rpx solid #d9e0dd;
  border-radius: 8rpx;
  background: #fff;
}

.row-main {
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

.qty-box {
  width: 92rpx;
  flex: none;
  padding: 12rpx 0;
  border-radius: 8rpx;
  background: #e9f3f0;
  text-align: center;
}

.qty {
  color: #176b5b;
  font-size: 31rpx;
  font-weight: 900;
}

.qty-label {
  margin-top: 2rpx;
  color: #176b5b;
  font-size: 20rpx;
  font-weight: 800;
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
