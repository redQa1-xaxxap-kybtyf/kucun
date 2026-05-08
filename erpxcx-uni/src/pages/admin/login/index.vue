<template>
  <view class="page login-page safe-bottom">
    <view class="header">
      <view class="eyebrow">管理员</view>
      <view class="title">登录管理工作台</view>
      <view class="desc">库存、产品、小程序分类都从这里进入</view>
    </view>

    <view class="form-card">
      <view class="field">
        <view class="label">账号</view>
        <input
          v-model="username"
          class="input"
          placeholder="请输入管理员账号"
          @confirm="submit"
        />
      </view>
      <view class="field">
        <view class="label">密码</view>
        <input
          v-model="password"
          class="input"
          password
          placeholder="请输入密码"
          @confirm="submit"
        />
      </view>

      <button class="submit" :loading="loading" :disabled="loading" @tap="submit">
        登录
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';

import { login, saveAdminSession } from '../../../utils/auth';

const username = ref('');
const password = ref('');
const loading = ref(false);

async function submit() {
  const account = username.value.trim();
  if (!account || !password.value) {
    uni.showToast({ title: '请输入账号和密码', icon: 'none' });
    return;
  }

  loading.value = true;
  try {
    const data = await login(account, password.value);
    saveAdminSession(data);
    uni.showToast({ title: '已登录' });
    uni.switchTab({ url: '/pages/admin/workspace/index' });
  } catch (error) {
    uni.showToast({
      title: error.message || '登录失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  padding: 54rpx 26rpx 40rpx;
}

.header {
  padding: 28rpx 4rpx 34rpx;
}

.eyebrow {
  color: #667085;
  font-size: 24rpx;
  font-weight: 800;
}

.title {
  margin-top: 10rpx;
  color: #111827;
  font-size: 42rpx;
  font-weight: 900;
  line-height: 1.2;
}

.desc {
  margin-top: 10rpx;
  color: #667085;
  font-size: 25rpx;
}

.form-card {
  padding: 24rpx;
  border: 1rpx solid #d9e0dd;
  border-radius: 8rpx;
  background: #fff;
}

.field {
  margin-bottom: 24rpx;
}

.label {
  margin-bottom: 12rpx;
  color: #111827;
  font-size: 26rpx;
  font-weight: 900;
}

.input {
  height: 82rpx;
  padding: 0 18rpx;
  border-radius: 8rpx;
  background: #f5f7f6;
  color: #111827;
  font-size: 28rpx;
}

.submit {
  height: 82rpx;
  margin: 14rpx 0 0;
  border-radius: 8rpx;
  background: #176b5b;
  color: #fff;
  font-size: 29rpx;
  font-weight: 900;
  line-height: 82rpx;
}
</style>
