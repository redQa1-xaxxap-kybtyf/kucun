<template>
  <view class="page workspace-page safe-bottom">
    <view class="header">
      <view>
        <view class="eyebrow">{{ userName }}</view>
        <view class="title">管理工作台</view>
        <view class="desc">库存、产品、小程序展示设置</view>
      </view>
      <button class="logout" @tap="logout">退出</button>
    </view>

    <view class="primary-action" @tap="go('/pages/admin/inventory/index')">
      <view>
        <view class="action-title">查库存</view>
        <view class="action-desc">编码、名称、批次、库位</view>
      </view>
      <view class="arrow">›</view>
    </view>

    <view class="grid">
      <view class="action-card" @tap="comingSoon('销售单前端下一步迁移')">
        <view class="action-title">开销售单</view>
        <view class="action-desc">下一步迁移</view>
      </view>
      <view class="action-card" @tap="comingSoon('收款前端下一步迁移')">
        <view class="action-title">登记收款</view>
        <view class="action-desc">下一步迁移</view>
      </view>
    </view>

    <view class="section-title">资料维护</view>
    <view class="list">
      <view class="list-row" @tap="go('/pages/admin/products/index')">
        <view>
          <view class="list-title">产品维护</view>
          <view class="list-desc">先迁移产品列表，表单下一步接入</view>
        </view>
        <view class="arrow">›</view>
      </view>
      <view class="list-row" @tap="go('/pages/admin/catalog/index')">
        <view>
          <view class="list-title">小程序分类管理</view>
          <view class="list-desc">花色、品种、缩略图、排序、显隐</view>
        </view>
        <view class="arrow">›</view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';

import { clearAdminSession, getStoredAdmin } from '../../../utils/auth';

const user = ref(null);

const userName = computed(() => {
  const current = user.value || {};
  return current.name || current.username || '管理员';
});

function loadSession() {
  const session = getStoredAdmin();
  if (!session.token) {
    uni.navigateTo({ url: '/pages/admin/login/index' });
    return;
  }
  user.value = session.user || {};
}

function go(url) {
  uni.navigateTo({ url });
}

function comingSoon(title) {
  uni.showToast({ title, icon: 'none' });
}

function logout() {
  clearAdminSession();
  uni.navigateTo({ url: '/pages/admin/login/index' });
}

onShow(loadSession);
</script>

<style scoped>
.workspace-page {
  padding: 30rpx 24rpx 42rpx;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
  padding: 8rpx 2rpx 24rpx;
}

.eyebrow {
  color: #667085;
  font-size: 23rpx;
  font-weight: 800;
}

.title {
  margin-top: 8rpx;
  color: #111827;
  font-size: 42rpx;
  font-weight: 900;
}

.desc {
  margin-top: 8rpx;
  color: #667085;
  font-size: 25rpx;
}

.logout {
  width: 96rpx;
  height: 56rpx;
  margin: 0;
  border-radius: 8rpx;
  background: #eef2f0;
  color: #667085;
  font-size: 23rpx;
  font-weight: 900;
  line-height: 56rpx;
}

.primary-action,
.action-card,
.list-row {
  border: 1rpx solid #d9e0dd;
  border-radius: 8rpx;
  background: #fff;
}

.primary-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 142rpx;
  padding: 24rpx;
}

.action-title {
  color: #111827;
  font-size: 31rpx;
  font-weight: 900;
}

.action-desc,
.list-desc {
  margin-top: 8rpx;
  color: #667085;
  font-size: 23rpx;
}

.arrow {
  color: #98a2b3;
  font-size: 42rpx;
  font-weight: 300;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14rpx;
  margin-top: 14rpx;
}

.action-card {
  min-height: 124rpx;
  padding: 22rpx;
  box-sizing: border-box;
}

.section-title {
  margin: 34rpx 4rpx 14rpx;
  color: #111827;
  font-size: 30rpx;
  font-weight: 900;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  min-height: 118rpx;
  padding: 20rpx;
}

.list-title {
  color: #111827;
  font-size: 29rpx;
  font-weight: 900;
}
</style>
