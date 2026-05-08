<template>
  <view class="page home-page safe-bottom">
    <view class="topbar">
      <view>
        <view class="brand-kicker">外墙罗马柱瓷砖</view>
        <view class="brand-title">按花色找货</view>
      </view>
      <button class="admin-entry" @tap="goAdmin">管理</button>
    </view>

    <view class="search-card">
      <text class="search-label">搜索</text>
      <input
        v-model="search"
        class="search-input"
        confirm-type="search"
        placeholder="型号、名称、规格"
        @confirm="confirmSearch"
      />
      <button v-if="search" class="search-clear" @tap="clearSearch">
        清空
      </button>
    </view>

    <view v-if="error" class="notice">{{ error }}</view>

    <view v-if="loading" class="empty">正在加载产品...</view>

    <block v-else-if="isSearching">
      <view class="section-head">
        <view>
          <view class="section-title">搜索结果</view>
          <view class="section-note">{{ searchKeyword }}</view>
        </view>
      </view>

      <view v-if="products.length === 0" class="empty-card">
        <view class="empty-title">没有找到相关产品</view>
        <view class="empty-text">换型号、名称或规格再试。</view>
      </view>

      <view v-else class="product-list">
        <view
          v-for="product in products"
          :key="product.id"
          class="product-row"
          @tap="goProduct(product.id)"
        >
          <image
            v-if="product.thumbnailUrl"
            class="product-cover"
            :src="product.thumbnailUrl"
            mode="aspectFill"
          />
          <view v-else class="product-cover fallback">暂无图片</view>
          <view class="product-body">
            <view class="tag-row">
              <text class="tag">{{ product.colorSeries.name }}</text>
              <text class="tag">{{ product.componentType.label }}</text>
            </view>
            <view class="product-name line-2">{{ product.name }}</view>
            <view class="product-spec line-1">
              {{ product.code }} · {{ product.specification || '查看详情' }}
            </view>
          </view>
        </view>
      </view>
    </block>

    <block v-else>
      <view v-if="visibleSeries.length === 0" class="empty-card">
        <view class="empty-title">还没有可展示的产品</view>
        <view class="empty-text">管理员整理花色和产品后会显示在这里。</view>
      </view>

      <view v-else class="shelf">
        <scroll-view class="series-rail" scroll-y enhanced>
          <view
            v-for="series in visibleSeries"
            :key="series.id"
            :class="['series-item', selectedSeriesId === series.id ? 'active' : '']"
            @tap="selectSeries(series.id)"
          >
            <image
              v-if="series.coverUrl"
              class="series-thumb"
              :src="series.coverUrl"
              mode="aspectFill"
            />
            <view v-else class="series-thumb text-thumb">{{ series.name }}</view>
            <view class="series-name">{{ series.name }}</view>
          </view>
        </scroll-view>

        <scroll-view class="shelf-main" scroll-y enhanced>
          <view class="current-head">
            <view>
              <view class="current-title">{{ selectedSeriesName }}</view>
              <view class="current-subtitle">选择罗马柱、转角石、线条等品种</view>
            </view>
          </view>

          <scroll-view v-if="components.length > 0" class="type-tabs" scroll-x>
            <view class="type-row">
              <view
                v-for="component in components"
                :key="component.id"
                :class="[
                  'type-tab',
                  selectedComponentType === component.id ? 'active' : '',
                ]"
                @tap="selectComponent(component.id)"
              >
                {{ component.label }}
              </view>
            </view>
          </scroll-view>

          <view v-if="groups.length === 0" class="empty-card slim">
            <view class="empty-title">这个花色暂时没有该品种</view>
            <view class="empty-text">切换上面的品种查看。</view>
          </view>

          <view v-else class="group-list">
            <view
              v-for="group in groups"
              :key="group.id"
              class="group-card"
              @tap="goGroup(group.id)"
            >
              <image
                v-if="group.coverUrl"
                class="group-cover"
                :src="group.coverUrl"
                mode="aspectFill"
              />
              <view v-else class="group-cover fallback">暂无图片</view>
              <view class="group-body">
                <view class="group-name line-2">{{ group.title }}</view>
                <view class="group-meta">
                  {{ group.specificationCount || group.productCount }} 种规格
                  <text v-if="group.effectImageCount > 0"> · 有实拍</text>
                </view>
                <view
                  v-if="group.sampleProducts && group.sampleProducts.length"
                  class="sample-row"
                >
                  <text
                    v-for="sample in group.sampleProducts.slice(0, 2)"
                    :key="sample.id"
                    class="sample-pill"
                  >
                    {{ sample.specification || sample.code }}
                  </text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </block>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import {
  onLoad,
  onPullDownRefresh,
  onShareAppMessage,
  onShareTimeline,
} from '@dcloudio/uni-app';

import { getStoredAdmin } from '../../utils/auth';
import { getCatalog } from '../../utils/catalog';

const loading = ref(true);
const error = ref('');
const search = ref('');
const searchKeyword = ref('');
const selectedSeriesId = ref('');
const selectedComponentType = ref('all');
const visibleSeries = ref([]);
const components = ref([]);
const groups = ref([]);
const products = ref([]);

const isSearching = computed(() => Boolean(searchKeyword.value));
const selectedSeriesName = computed(() => {
  const matched = visibleSeries.value.find(
    item => item.id === selectedSeriesId.value
  );
  return matched ? matched.name : '';
});

function getVisibleSeries(series) {
  return (series || []).filter(item => item.id !== 'hot');
}

async function requestCatalog(params) {
  return getCatalog({
    seriesId: params.seriesId || 'hot',
    componentType: params.componentType || 'all',
    search: params.search || '',
  });
}

async function loadCatalog() {
  loading.value = true;
  error.value = '';

  try {
    let nextSeriesId = searchKeyword.value ? '' : selectedSeriesId.value;
    let nextComponentType = searchKeyword.value
      ? 'all'
      : selectedComponentType.value;
    let data = await requestCatalog({
      seriesId: nextSeriesId,
      componentType: nextComponentType,
      search: searchKeyword.value,
    });
    let series = getVisibleSeries(data.series);

    if (!searchKeyword.value && !nextSeriesId && series.length > 0) {
      nextSeriesId = series[0].id;
      nextComponentType = 'all';
      data = await requestCatalog({
        seriesId: nextSeriesId,
        componentType: nextComponentType,
      });
      series = getVisibleSeries(data.series);
    }

    selectedSeriesId.value = nextSeriesId;
    selectedComponentType.value = nextComponentType;
    visibleSeries.value = series;
    components.value = data.components || [];
    groups.value = data.groups || [];
    products.value = data.products || [];
  } catch (err) {
    error.value = err.message || '产品加载失败';
  } finally {
    loading.value = false;
  }
}

function selectSeries(id) {
  selectedSeriesId.value = id;
  selectedComponentType.value = 'all';
  search.value = '';
  searchKeyword.value = '';
  loadCatalog();
}

function selectComponent(id) {
  selectedComponentType.value = id;
  loadCatalog();
}

function confirmSearch() {
  searchKeyword.value = search.value.trim();
  selectedComponentType.value = 'all';
  loadCatalog();
}

function clearSearch() {
  search.value = '';
  searchKeyword.value = '';
  selectedComponentType.value = 'all';
  loadCatalog();
}

function goGroup(id) {
  uni.navigateTo({
    url: `/pages/group/detail?id=${encodeURIComponent(id)}`,
  });
}

function goProduct(id) {
  uni.navigateTo({
    url: `/pages/product/detail?id=${encodeURIComponent(id)}`,
  });
}

function goAdmin() {
  const session = getStoredAdmin();
  if (session.token) {
    uni.switchTab({
      url: '/pages/admin/workspace/index',
    });
    return;
  }

  uni.navigateTo({
    url: '/pages/admin/login/index',
  });
}

onLoad(options => {
  selectedSeriesId.value =
    options && options.seriesId && options.seriesId !== 'hot'
      ? options.seriesId
      : '';
  selectedComponentType.value =
    options && options.componentType ? options.componentType : 'all';
  loadCatalog();
});

onPullDownRefresh(() => {
  loadCatalog().finally(() => uni.stopPullDownRefresh());
});

onShareAppMessage(() => ({
  title: selectedSeriesId.value
    ? `${selectedSeriesName.value}外墙罗马柱`
    : '外墙罗马柱产品',
  path: `/pages/index/index?seriesId=${selectedSeriesId.value || 'hot'}&componentType=${selectedComponentType.value}`,
}));

onShareTimeline(() => ({
  title: selectedSeriesId.value
    ? `${selectedSeriesName.value}外墙罗马柱`
    : '外墙罗马柱产品',
  query: `seriesId=${selectedSeriesId.value || 'hot'}&componentType=${selectedComponentType.value}`,
}));
</script>

<style scoped>
.home-page {
  padding: 28rpx 22rpx 36rpx;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 4rpx 2rpx 18rpx;
}

.brand-kicker {
  color: #667085;
  font-size: 22rpx;
  font-weight: 700;
}

.brand-title {
  margin-top: 8rpx;
  color: #111827;
  font-size: 42rpx;
  font-weight: 900;
  line-height: 1.15;
}

.admin-entry {
  width: 110rpx;
  height: 58rpx;
  margin: 0;
  border-radius: 8rpx;
  background: #176b5b;
  color: #fff;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 58rpx;
}

.search-card {
  display: flex;
  align-items: center;
  gap: 14rpx;
  height: 76rpx;
  padding: 0 18rpx;
  border: 1rpx solid #d9e0dd;
  border-radius: 8rpx;
  background: #fff;
  box-sizing: border-box;
}

.search-label {
  color: #176b5b;
  font-size: 25rpx;
  font-weight: 900;
}

.search-input {
  flex: 1;
  height: 72rpx;
  color: #111827;
  font-size: 27rpx;
}

.search-clear {
  width: 74rpx;
  height: 52rpx;
  margin: 0;
  border-radius: 8rpx;
  background: #eef2f0;
  color: #667085;
  font-size: 22rpx;
  font-weight: 800;
  line-height: 52rpx;
}

.section-head {
  margin: 28rpx 2rpx 16rpx;
}

.section-title {
  color: #111827;
  font-size: 32rpx;
  font-weight: 900;
}

.section-note {
  margin-top: 6rpx;
  color: #667085;
  font-size: 24rpx;
}

.shelf {
  display: grid;
  grid-template-columns: 170rpx minmax(0, 1fr);
  gap: 18rpx;
  height: calc(100vh - 156rpx - env(safe-area-inset-bottom));
  min-height: 720rpx;
  margin-top: 18rpx;
}

.series-rail {
  height: 100%;
  border: 1rpx solid #d9e0dd;
  border-radius: 8rpx;
  background: #fff;
  box-sizing: border-box;
}

.series-item {
  padding: 16rpx 12rpx;
  border-left: 6rpx solid transparent;
}

.series-item.active {
  border-left-color: #176b5b;
  background: #e9f3f0;
}

.series-thumb {
  width: 118rpx;
  height: 92rpx;
  border-radius: 8rpx;
  background: #eef2f0;
}

.text-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #176b5b;
  font-size: 24rpx;
  font-weight: 900;
  text-align: center;
}

.series-name {
  margin-top: 8rpx;
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
  text-align: center;
}

.shelf-main {
  height: 100%;
}

.current-head {
  padding: 2rpx 2rpx 14rpx;
}

.current-title {
  color: #111827;
  font-size: 34rpx;
  font-weight: 900;
}

.current-subtitle {
  margin-top: 6rpx;
  color: #667085;
  font-size: 23rpx;
}

.type-tabs {
  width: 100%;
  margin-bottom: 14rpx;
  white-space: nowrap;
}

.type-row {
  display: flex;
  gap: 12rpx;
}

.type-tab {
  flex: none;
  min-width: 84rpx;
  padding: 14rpx 18rpx;
  border: 1rpx solid #d9e0dd;
  border-radius: 8rpx;
  background: #fff;
  color: #344054;
  font-size: 24rpx;
  font-weight: 900;
  text-align: center;
}

.type-tab.active {
  border-color: #176b5b;
  background: #176b5b;
  color: #fff;
}

.group-list,
.product-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.group-card,
.product-row {
  display: flex;
  gap: 16rpx;
  padding: 16rpx;
  border: 1rpx solid #d9e0dd;
  border-radius: 8rpx;
  background: #fff;
}

.group-cover,
.product-cover {
  width: 142rpx;
  height: 142rpx;
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
  font-weight: 800;
}

.group-body,
.product-body {
  flex: 1;
  min-width: 0;
}

.group-name,
.product-name {
  color: #111827;
  font-size: 29rpx;
  font-weight: 900;
  line-height: 1.35;
}

.group-meta,
.product-spec {
  margin-top: 8rpx;
  color: #667085;
  font-size: 23rpx;
}

.sample-row,
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-bottom: 8rpx;
}

.sample-row {
  margin-top: 12rpx;
}

.sample-pill,
.tag {
  max-width: 150rpx;
  padding: 6rpx 10rpx;
  border-radius: 8rpx;
  background: #eef2f0;
  color: #344054;
  font-size: 21rpx;
  font-weight: 800;
}

.tag {
  background: #e9f3f0;
  color: #176b5b;
}

.empty-card {
  margin-top: 24rpx;
  padding: 54rpx 28rpx;
  border: 1rpx solid #d9e0dd;
  border-radius: 8rpx;
  background: #fff;
  text-align: center;
}

.empty-card.slim {
  margin-top: 18rpx;
}

.empty-title {
  color: #111827;
  font-size: 29rpx;
  font-weight: 900;
}

.empty-text {
  margin-top: 10rpx;
  color: #667085;
  font-size: 24rpx;
}
</style>
