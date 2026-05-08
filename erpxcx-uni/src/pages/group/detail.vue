<template>
  <view class="page detail-page safe-bottom">
    <view v-if="loading" class="empty">正在加载产品组...</view>
    <view v-else-if="error" class="notice">{{ error }}</view>

    <block v-else-if="group">
      <image
        v-if="group.coverUrl"
        class="hero"
        :src="group.coverUrl"
        mode="aspectFill"
      />
      <view v-else class="hero fallback">暂无图片</view>

      <view class="title-card">
        <view class="kicker">
          {{ group.colorSeries.name }} · {{ group.componentType.label }}
        </view>
        <view class="title">{{ group.title }}</view>
        <view class="meta">
          {{ group.specificationCount || group.productCount }} 种规格
          <text v-if="group.effectImageCount > 0"> · 有实拍</text>
        </view>
      </view>

      <view v-if="group.relatedGroups && group.relatedGroups.length" class="section">
        <view class="section-title">同花色其他品种</view>
        <scroll-view class="related-scroll" scroll-x>
          <view class="related-row">
            <view
              v-for="item in group.relatedGroups"
              :key="item.id"
              class="related-card"
              @tap="goGroup(item.id)"
            >
              <image
                v-if="item.coverUrl"
                class="related-cover"
                :src="item.coverUrl"
                mode="aspectFill"
              />
              <view v-else class="related-cover fallback">图</view>
              <view class="related-title line-2">{{ item.title }}</view>
            </view>
          </view>
        </scroll-view>
      </view>

      <view class="section">
        <view class="section-head">
          <view class="section-title">规格</view>
          <button
            v-if="group.products.length > previewLimit"
            class="toggle-btn"
            @tap="expanded = !expanded"
          >
            {{ expanded ? '收起' : '展开全部' }}
          </button>
        </view>

        <view class="spec-list">
          <view
            v-for="product in visibleProducts"
            :key="product.id"
            class="spec-row"
            @tap="goProduct(product.id)"
          >
            <image
              v-if="product.thumbnailUrl"
              class="spec-cover"
              :src="product.thumbnailUrl"
              mode="aspectFill"
            />
            <view v-else class="spec-cover fallback">图</view>
            <view class="spec-main">
              <view class="spec-name line-2">{{ product.name }}</view>
              <view class="spec-text line-1">
                {{ product.code }} · {{ product.specification || '未填规格' }}
              </view>
              <view class="spec-extra line-1">
                {{ product.packageText || product.weightText || product.sourceLabel }}
              </view>
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

import { getProductGroup } from '../../utils/catalog';

const loading = ref(true);
const error = ref('');
const group = ref(null);
const groupId = ref('');
const expanded = ref(false);
const previewLimit = 8;

const visibleProducts = computed(() => {
  const products = group.value && group.value.products ? group.value.products : [];
  return expanded.value ? products : products.slice(0, previewLimit);
});

async function loadGroup() {
  if (!groupId.value) return;
  loading.value = true;
  error.value = '';

  try {
    group.value = await getProductGroup(groupId.value);
  } catch (err) {
    error.value = err.message || '产品组加载失败';
  } finally {
    loading.value = false;
  }
}

function goGroup(id) {
  uni.redirectTo({
    url: `/pages/group/detail?id=${encodeURIComponent(id)}`,
  });
}

function goProduct(id) {
  uni.navigateTo({
    url: `/pages/product/detail?id=${encodeURIComponent(id)}`,
  });
}

onLoad(options => {
  groupId.value = options && options.id ? decodeURIComponent(options.id) : '';
  loadGroup();
});

onPullDownRefresh(() => {
  loadGroup().finally(() => uni.stopPullDownRefresh());
});
</script>

<style scoped>
.detail-page {
  padding: 24rpx 22rpx 40rpx;
}

.hero {
  width: 100%;
  height: 430rpx;
  border-radius: 8rpx;
  background: #eef2f0;
}

.fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #98a2b3;
  font-size: 24rpx;
  font-weight: 900;
}

.title-card {
  margin-top: 18rpx;
  padding: 22rpx;
  border: 1rpx solid #d9e0dd;
  border-radius: 8rpx;
  background: #fff;
}

.kicker {
  color: #176b5b;
  font-size: 23rpx;
  font-weight: 900;
}

.title {
  margin-top: 8rpx;
  color: #111827;
  font-size: 38rpx;
  font-weight: 900;
  line-height: 1.22;
}

.meta {
  margin-top: 10rpx;
  color: #667085;
  font-size: 24rpx;
}

.section {
  margin-top: 30rpx;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14rpx;
}

.section-title {
  color: #111827;
  font-size: 30rpx;
  font-weight: 900;
}

.toggle-btn {
  width: 132rpx;
  height: 56rpx;
  margin: 0;
  border-radius: 8rpx;
  background: #e9f3f0;
  color: #176b5b;
  font-size: 23rpx;
  font-weight: 900;
  line-height: 56rpx;
}

.related-scroll {
  width: 100%;
  white-space: nowrap;
}

.related-row {
  display: flex;
  gap: 14rpx;
}

.related-card {
  width: 190rpx;
  flex: none;
  padding: 12rpx;
  border: 1rpx solid #d9e0dd;
  border-radius: 8rpx;
  background: #fff;
}

.related-cover {
  width: 100%;
  height: 132rpx;
  border-radius: 8rpx;
  background: #eef2f0;
}

.related-title {
  margin-top: 8rpx;
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 1.3;
}

.spec-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.spec-row {
  display: flex;
  gap: 16rpx;
  padding: 16rpx;
  border: 1rpx solid #d9e0dd;
  border-radius: 8rpx;
  background: #fff;
}

.spec-cover {
  width: 126rpx;
  height: 126rpx;
  flex: none;
  border-radius: 8rpx;
  background: #eef2f0;
}

.spec-main {
  flex: 1;
  min-width: 0;
}

.spec-name {
  color: #111827;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 1.35;
}

.spec-text,
.spec-extra {
  margin-top: 7rpx;
  color: #667085;
  font-size: 23rpx;
}
</style>
