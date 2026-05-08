<template>
  <view class="page product-page safe-bottom">
    <view v-if="loading" class="empty">正在加载产品...</view>
    <view v-else-if="error" class="notice">{{ error }}</view>

    <block v-else-if="product">
      <swiper
        v-if="imageUrls.length"
        class="image-swiper"
        indicator-dots
        indicator-color="rgba(255,255,255,0.55)"
        indicator-active-color="#FFFFFF"
      >
        <swiper-item v-for="url in imageUrls" :key="url">
          <image class="hero-image" :src="url" mode="aspectFill" />
        </swiper-item>
      </swiper>
      <view v-else class="image-swiper placeholder">暂无图片</view>

      <view class="info-card">
        <view class="tag-row">
          <text class="tag">{{ product.colorSeries.name }}</text>
          <text class="tag">{{ product.componentType.label }}</text>
        </view>
        <view class="title">{{ product.name }}</view>
        <view class="code">{{ product.code }}</view>
      </view>

      <view class="info-card">
        <view class="row">
          <text class="row-label">规格</text>
          <text class="row-value">{{ product.specification || '未填写' }}</text>
        </view>
        <view class="row" v-if="product.packageText">
          <text class="row-label">包装</text>
          <text class="row-value">{{ product.packageText }}</text>
        </view>
        <view class="row" v-if="product.weightText">
          <text class="row-label">重量</text>
          <text class="row-value">{{ product.weightText }}</text>
        </view>
        <view class="row">
          <text class="row-label">来源</text>
          <text class="row-value">{{ product.sourceLabel }}</text>
        </view>
      </view>

      <view v-if="product.description" class="info-card">
        <view class="section-title">备注</view>
        <view class="description">{{ product.description }}</view>
      </view>

      <view v-if="product.relatedGroups && product.relatedGroups.length" class="section">
        <view class="section-title">同花色其他品种</view>
        <view class="related-list">
          <view
            v-for="group in product.relatedGroups"
            :key="group.id"
            class="related-row"
            @tap="goGroup(group.id)"
          >
            <image
              v-if="group.coverUrl"
              class="related-cover"
              :src="group.coverUrl"
              mode="aspectFill"
            />
            <view v-else class="related-cover placeholder-small">图</view>
            <view class="related-main">
              <view class="related-title line-1">{{ group.title }}</view>
              <view class="related-meta">{{ group.specificationCount }} 种规格</view>
            </view>
          </view>
        </view>
      </view>
    </block>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app';

import { getProduct } from '../../utils/catalog';

const loading = ref(true);
const error = ref('');
const product = ref(null);
const productId = ref('');

const imageUrls = computed(() =>
  product.value && Array.isArray(product.value.imageUrls)
    ? product.value.imageUrls
    : []
);

async function loadProduct() {
  if (!productId.value) return;
  loading.value = true;
  error.value = '';

  try {
    product.value = await getProduct(productId.value);
  } catch (err) {
    error.value = err.message || '产品加载失败';
  } finally {
    loading.value = false;
  }
}

function goGroup(id) {
  uni.navigateTo({
    url: `/pages/group/detail?id=${encodeURIComponent(id)}`,
  });
}

onLoad(options => {
  productId.value = options && options.id ? decodeURIComponent(options.id) : '';
  loadProduct();
});

onPullDownRefresh(() => {
  loadProduct().finally(() => uni.stopPullDownRefresh());
});
</script>

<style scoped>
.product-page {
  padding: 24rpx 22rpx 40rpx;
}

.image-swiper {
  width: 100%;
  height: 520rpx;
  border-radius: 8rpx;
  overflow: hidden;
  background: #eef2f0;
}

.hero-image {
  width: 100%;
  height: 100%;
}

.placeholder,
.placeholder-small {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #98a2b3;
  font-size: 24rpx;
  font-weight: 900;
}

.info-card {
  margin-top: 18rpx;
  padding: 22rpx;
  border: 1rpx solid #d9e0dd;
  border-radius: 8rpx;
  background: #fff;
}

.tag-row {
  display: flex;
  gap: 10rpx;
  margin-bottom: 12rpx;
}

.tag {
  padding: 7rpx 12rpx;
  border-radius: 8rpx;
  background: #e9f3f0;
  color: #176b5b;
  font-size: 22rpx;
  font-weight: 900;
}

.title {
  color: #111827;
  font-size: 38rpx;
  font-weight: 900;
  line-height: 1.25;
}

.code {
  margin-top: 8rpx;
  color: #667085;
  font-size: 24rpx;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 22rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #eef2f0;
}

.row:last-child {
  border-bottom: 0;
}

.row-label {
  color: #667085;
  font-size: 25rpx;
}

.row-value {
  flex: 1;
  color: #111827;
  font-size: 25rpx;
  font-weight: 900;
  text-align: right;
}

.section {
  margin-top: 30rpx;
}

.section-title {
  color: #111827;
  font-size: 30rpx;
  font-weight: 900;
}

.description {
  margin-top: 12rpx;
  color: #344054;
  font-size: 25rpx;
  line-height: 1.6;
}

.related-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 14rpx;
}

.related-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 14rpx;
  border: 1rpx solid #d9e0dd;
  border-radius: 8rpx;
  background: #fff;
}

.related-cover {
  width: 88rpx;
  height: 88rpx;
  flex: none;
  border-radius: 8rpx;
  background: #eef2f0;
}

.related-main {
  flex: 1;
  min-width: 0;
}

.related-title {
  color: #111827;
  font-size: 27rpx;
  font-weight: 900;
}

.related-meta {
  margin-top: 6rpx;
  color: #667085;
  font-size: 23rpx;
}
</style>
