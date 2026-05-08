<template>
  <view class="page catalog-page safe-bottom">
    <view class="header">
      <view class="eyebrow">小程序</view>
      <view class="title">分类管理</view>
      <view class="desc">客户前台按“花色 → 品种 → 规格”找产品</view>
    </view>

    <view class="flow">
      <view class="flow-step">花色</view>
      <view class="flow-arrow">›</view>
      <view class="flow-step">品种</view>
      <view class="flow-arrow">›</view>
      <view class="flow-step">规格</view>
    </view>

    <view class="tip">
      <view class="tip-title">只管理小程序前台展示</view>
      <view class="tip-text">{{ note }}</view>
    </view>

    <view v-if="error" class="notice">{{ error }}</view>
    <view v-if="loading" class="empty">正在加载设置...</view>

    <block v-else>
      <view class="section-head">
        <view>
          <view class="section-title">花色入口</view>
          <view class="section-note">例如雅士白、米黄、青石</view>
        </view>
        <button class="add-btn" @tap="addSeries">新增</button>
      </view>

      <view class="category-list">
        <view
          v-for="item in colorSeries"
          :key="item.id"
          class="category-row"
          @tap="openEditor('series', item)"
        >
          <image
            v-if="item.coverUrl"
            class="cover"
            :src="item.coverUrl"
            mode="aspectFill"
          />
          <view v-else class="cover fallback">图</view>
          <view class="category-main">
            <view class="category-top">
              <view class="category-title line-1">{{ item.title }}</view>
              <view v-if="!item.builtIn" class="chip">自定义</view>
            </view>
            <view class="category-desc">
              {{ item.count }} 个产品 · 排序 {{ item.sortOrder }}
            </view>
          </view>
          <view :class="['status', item.visible ? 'active' : '']">
            {{ item.visible ? '显示' : '隐藏' }}
          </view>
        </view>
      </view>

      <view class="section-head">
        <view>
          <view class="section-title">品种入口</view>
          <view class="section-note">例如罗马柱、转角石、线条</view>
        </view>
        <button class="add-btn" @tap="addComponent">新增</button>
      </view>

      <view class="category-list">
        <view
          v-for="item in componentTypes"
          :key="item.id"
          class="category-row"
          @tap="openEditor('component', item)"
        >
          <image
            v-if="item.coverUrl"
            class="cover"
            :src="item.coverUrl"
            mode="aspectFill"
          />
          <view v-else class="cover type-cover">{{ item.shortTitle }}</view>
          <view class="category-main">
            <view class="category-top">
              <view class="category-title line-1">{{ item.title }}</view>
              <view v-if="!item.builtIn" class="chip">自定义</view>
            </view>
            <view class="category-desc">
              {{ item.count }} 个产品 · 排序 {{ item.sortOrder }}
            </view>
          </view>
          <view :class="['status', item.visible ? 'active' : '']">
            {{ item.visible ? '显示' : '隐藏' }}
          </view>
        </view>
      </view>

      <view class="section-head preview-head">
        <view>
          <view class="section-title">前台产品组预览</view>
          <view class="section-note">花色 + 品种生成客户看到的入口</view>
        </view>
      </view>

      <view v-if="groupPreview.length === 0" class="preview-empty">
        暂无可展示产品组
      </view>
      <view v-else class="preview-list">
        <view v-for="item in groupPreview" :key="item.id" class="preview-row">
          <image
            v-if="item.coverUrl"
            class="preview-cover"
            :src="item.coverUrl"
            mode="aspectFill"
          />
          <view v-else class="preview-cover fallback">图</view>
          <view class="preview-main">
            <view class="preview-title line-1">{{ item.title }}</view>
            <view class="preview-desc line-1">
              {{ item.seriesName }} · {{ item.componentLabel }} ·
              {{ item.specificationCount }} 种规格
            </view>
          </view>
          <view class="preview-count">{{ item.productCount }}</view>
        </view>
      </view>
    </block>

    <view v-if="editorVisible" class="sheet-mask" @tap="closeEditor">
      <view class="editor-sheet" @tap.stop>
        <view class="sheet-handle"></view>
        <view class="sheet-title">{{ editorTitle }}</view>

        <view class="field">
          <view class="label">{{ editorType === 'series' ? '花色名称' : '品种名称' }}</view>
          <input
            v-model="editor.displayName"
            class="input"
            maxlength="30"
            :placeholder="editorType === 'series' ? '如雅士白' : '如罗马柱'"
          />
        </view>

        <view class="field">
          <view class="label">分类缩略图</view>
          <view class="cover-editor">
            <image
              v-if="editor.coverUrl"
              class="cover-preview"
              :src="editor.coverUrl"
              mode="aspectFill"
            />
            <view v-else class="cover-preview placeholder">缩略图</view>
            <view class="cover-actions">
              <button
                class="upload-btn"
                :loading="uploading"
                :disabled="uploading || saving"
                @tap="uploadCover"
              >
                上传图片
              </button>
              <button
                class="clear-btn"
                :disabled="uploading || saving"
                @tap="editor.coverUrl = ''"
              >
                清空
              </button>
            </view>
          </view>
          <input
            v-model="editor.coverUrl"
            class="input url-input"
            placeholder="也可以粘贴图片地址"
          />
        </view>

        <view class="field row-field">
          <view>
            <view class="label">前台显示</view>
            <view class="hint">
              {{ editor.visible ? '客户可以看到这个入口' : '客户不会看到这个入口' }}
            </view>
          </view>
          <switch
            :checked="editor.visible"
            color="#176B5B"
            @change="editor.visible = $event.detail.value"
          />
        </view>

        <view class="field">
          <view class="label">排序</view>
          <input v-model="editor.sortOrder" class="input" type="number" />
        </view>

        <view class="sheet-actions">
          <button class="cancel-btn" :disabled="saving || uploading" @tap="closeEditor">
            取消
          </button>
          <button
            class="save-btn"
            :loading="saving"
            :disabled="saving || uploading"
            @tap="saveEditor"
          >
            保存
          </button>
        </view>

        <button
          v-if="editor.canDelete"
          class="delete-btn"
          :disabled="saving || uploading"
          @tap="deleteEditor"
        >
          删除这个自定义分类
        </button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app';

import { getCatalog } from '../../../utils/catalog';
import {
  getCatalogSettings,
  updateCatalogSettings,
} from '../../../utils/catalog-settings';
import { requireAdminSession } from '../../../utils/auth';
import { uploadProductImage } from '../../../utils/upload';

const loading = ref(true);
const saving = ref(false);
const uploading = ref(false);
const error = ref('');
const note = ref('');
const colorSeries = ref([]);
const componentTypes = ref([]);
const groupPreview = ref([]);
const editorVisible = ref(false);
const editorType = ref('');
const editorTitle = ref('');
const editor = reactive({});

function createCustomId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function getNextSortOrder(items) {
  return (
    (items || []).reduce((max, item) => {
      const sortOrder = Number(item.sortOrder) || 0;
      return Math.max(max, sortOrder);
    }, 0) + 1
  );
}

function replaceEditorState(item) {
  Object.keys(editor).forEach(key => {
    delete editor[key];
  });
  Object.assign(editor, {
    ...item,
    displayName: item.name || item.label || item.title || '',
    sortOrder: String(item.sortOrder || 1),
  });
}

function mergeCount(items, counts) {
  const countMap = new Map((counts || []).map(item => [item.id, item]));
  return (items || []).map(item => {
    const matched = countMap.get(item.id) || {};
    const title = item.name || item.label || '';
    return {
      ...item,
      count: matched.productCount || 0,
      coverUrl: item.coverUrl || matched.coverUrl || '',
      title,
      shortTitle: String(title).slice(0, 2),
      builtIn: item.builtIn === true,
      canDelete: item.canDelete === true && item.builtIn !== true,
    };
  });
}

function buildGroupPreview(groups) {
  return (groups || []).slice(0, 12).map(group => ({
    id: group.id,
    title: group.title,
    coverUrl: group.coverUrl || '',
    productCount: group.productCount || 0,
    specificationCount: group.specificationCount || group.productCount || 0,
    seriesName: group.colorSeries ? group.colorSeries.name : '',
    componentLabel: group.componentType ? group.componentType.label : '',
  }));
}

async function loadData() {
  loading.value = true;
  error.value = '';

  try {
    const [settings, catalog] = await Promise.all([
      getCatalogSettings(),
      getCatalog(),
    ]);
    colorSeries.value = mergeCount(
      settings.colorSeries || [],
      (catalog.series || []).filter(item => item.id !== 'hot')
    );
    componentTypes.value = mergeCount(
      settings.componentTypes || [],
      (catalog.components || []).filter(item => item.id !== 'all')
    );
    groupPreview.value = buildGroupPreview(catalog.groups);
    note.value = settings.note || '';
  } catch (err) {
    error.value = err.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

function openEditor(type, item) {
  editorType.value = type;
  editorTitle.value = `${item.id && item.count === 0 && !item.title ? '新增' : '编辑'}${
    type === 'series' ? '花色' : '品种'
  }`;
  replaceEditorState(item);
  editorVisible.value = true;
}

function addSeries() {
  openEditor('series', {
    builtIn: false,
    canDelete: true,
    count: 0,
    coverUrl: '',
    id: createCustomId('custom-series'),
    name: '',
    sortOrder: getNextSortOrder(colorSeries.value),
    title: '',
    visible: true,
  });
  editorTitle.value = '新增花色';
}

function addComponent() {
  openEditor('component', {
    builtIn: false,
    canDelete: true,
    count: 0,
    coverUrl: '',
    id: createCustomId('custom-component'),
    label: '',
    sortOrder: getNextSortOrder(componentTypes.value),
    title: '',
    visible: true,
  });
  editorTitle.value = '新增品种';
}

function closeEditor() {
  if (saving.value || uploading.value) return;
  editorVisible.value = false;
}

function normalizeColorSeriesForSave(list) {
  return (list || []).map(item => ({
    id: item.id,
    name: item.name || item.title,
    coverUrl: item.coverUrl || null,
    sortOrder: Number(item.sortOrder) || 1,
    visible: item.visible !== false,
  }));
}

function normalizeComponentTypesForSave(list) {
  return (list || []).map(item => ({
    id: item.id,
    label: item.label || item.title,
    coverUrl: item.coverUrl || null,
    sortOrder: Number(item.sortOrder) || 1,
    visible: item.visible !== false,
  }));
}

async function saveCatalogLists(nextSeries, nextComponents, toastTitle) {
  saving.value = true;
  try {
    await updateCatalogSettings({
      colorSeries: normalizeColorSeriesForSave(nextSeries),
      componentTypes: normalizeComponentTypesForSave(nextComponents),
    });
    colorSeries.value = nextSeries;
    componentTypes.value = nextComponents;
    closeEditor();
    uni.showToast({ title: toastTitle || '已保存' });
    loadData();
  } catch (err) {
    uni.showToast({ title: err.message || '保存失败', icon: 'none' });
  } finally {
    saving.value = false;
  }
}

async function saveEditor() {
  const displayName = String(editor.displayName || '').trim();
  if (!displayName) {
    uni.showToast({ title: '请输入名称', icon: 'none' });
    return;
  }

  const nextItem = {
    ...editor,
    coverUrl: editor.coverUrl || '',
    sortOrder: Number(editor.sortOrder) || 1,
    title: displayName,
    visible: editor.visible !== false,
  };

  let nextSeries = colorSeries.value;
  let nextComponents = componentTypes.value;

  if (editorType.value === 'series') {
    nextItem.name = displayName;
    nextSeries = nextSeries.some(item => item.id === editor.id)
      ? nextSeries.map(item => (item.id === editor.id ? nextItem : item))
      : nextSeries.concat(nextItem);
  } else {
    nextItem.label = displayName;
    nextComponents = nextComponents.some(item => item.id === editor.id)
      ? nextComponents.map(item => (item.id === editor.id ? nextItem : item))
      : nextComponents.concat(nextItem);
  }

  await saveCatalogLists(nextSeries, nextComponents, '已保存');
}

function deleteEditor() {
  if (!editor.canDelete) {
    uni.showToast({ title: '基础分类不能删除', icon: 'none' });
    return;
  }

  if (Number(editor.count) > 0) {
    uni.showToast({ title: '已有产品绑定，先调整产品', icon: 'none' });
    return;
  }

  uni.showModal({
    title: '删除分类',
    content: `删除“${editor.displayName || editor.title}”？`,
    confirmColor: '#B42318',
    success(result) {
      if (!result.confirm) return;
      const nextSeries =
        editorType.value === 'series'
          ? colorSeries.value.filter(item => item.id !== editor.id)
          : colorSeries.value;
      const nextComponents =
        editorType.value === 'component'
          ? componentTypes.value.filter(item => item.id !== editor.id)
          : componentTypes.value;
      saveCatalogLists(nextSeries, nextComponents, '已删除');
    },
  });
}

function chooseImageFile() {
  return new Promise((resolve, reject) => {
    uni.chooseImage({
      count: 1,
      sourceType: ['album', 'camera'],
      success(result) {
        resolve((result.tempFilePaths || [])[0] || '');
      },
      fail(error) {
        reject(error);
      },
    });
  });
}

async function uploadCover() {
  if (uploading.value) return;

  try {
    const filePath = await chooseImageFile();
    if (!filePath) return;
    uploading.value = true;
    editor.coverUrl = await uploadProductImage(filePath, 'thumbnail');
    uni.showToast({ title: '缩略图已上传' });
  } catch (err) {
    if (err && err.errMsg && err.errMsg.includes('cancel')) return;
    uni.showToast({ title: err.message || '上传失败', icon: 'none' });
  } finally {
    uploading.value = false;
  }
}

onLoad(() => {
  if (!requireAdminSession()) return;
  loadData();
});

onPullDownRefresh(() => {
  loadData().finally(() => uni.stopPullDownRefresh());
});
</script>

<style scoped>
.catalog-page {
  padding: 30rpx 24rpx 52rpx;
}

.header {
  padding: 8rpx 2rpx 22rpx;
}

.eyebrow {
  color: #667085;
  font-size: 22rpx;
  font-weight: 800;
}

.title {
  margin-top: 8rpx;
  color: #111827;
  font-size: 40rpx;
  font-weight: 900;
}

.desc {
  margin-top: 8rpx;
  color: #667085;
  font-size: 25rpx;
}

.flow,
.tip,
.category-row,
.preview-row {
  border: 1rpx solid #d9e0dd;
  border-radius: 8rpx;
  background: #fff;
}

.flow {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 18rpx;
}

.flow-step {
  flex: 1;
  height: 58rpx;
  border-radius: 8rpx;
  background: #e9f3f0;
  color: #176b5b;
  font-size: 25rpx;
  font-weight: 900;
  line-height: 58rpx;
  text-align: center;
}

.flow-arrow {
  color: #a15c20;
  font-size: 36rpx;
}

.tip {
  margin-top: 18rpx;
  padding: 22rpx;
}

.tip-title {
  color: #111827;
  font-size: 28rpx;
  font-weight: 900;
}

.tip-text {
  margin-top: 10rpx;
  color: #667085;
  font-size: 24rpx;
  line-height: 1.55;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16rpx;
  margin: 32rpx 4rpx 14rpx;
}

.preview-head {
  margin-top: 36rpx;
}

.section-title {
  color: #111827;
  font-size: 30rpx;
  font-weight: 900;
}

.section-note {
  margin-top: 6rpx;
  color: #667085;
  font-size: 22rpx;
  font-weight: 700;
}

.add-btn {
  width: 116rpx;
  height: 60rpx;
  margin: 0;
  border-radius: 8rpx;
  background: #176b5b;
  color: #fff;
  font-size: 25rpx;
  font-weight: 900;
  line-height: 60rpx;
}

.category-list,
.preview-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.category-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-height: 116rpx;
  padding: 16rpx;
  box-sizing: border-box;
}

.cover {
  width: 92rpx;
  height: 92rpx;
  flex: none;
  border-radius: 8rpx;
  background: #eef2f0;
}

.fallback,
.type-cover {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a15c20;
  font-size: 24rpx;
  font-weight: 900;
}

.type-cover {
  background: #e9f3f0;
  color: #176b5b;
}

.category-main {
  flex: 1;
  min-width: 0;
}

.category-top {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.category-title {
  min-width: 0;
  color: #111827;
  font-size: 29rpx;
  font-weight: 900;
}

.chip {
  flex: none;
  height: 34rpx;
  padding: 0 10rpx;
  border-radius: 8rpx;
  background: #eef4ff;
  color: #175cd3;
  font-size: 20rpx;
  font-weight: 900;
  line-height: 34rpx;
}

.category-desc {
  margin-top: 8rpx;
  color: #667085;
  font-size: 23rpx;
}

.status {
  flex: none;
  min-width: 74rpx;
  padding: 8rpx 12rpx;
  border-radius: 8rpx;
  background: #eef2f0;
  color: #667085;
  font-size: 22rpx;
  font-weight: 900;
  text-align: center;
}

.status.active {
  background: #e9f3f0;
  color: #176b5b;
}

.preview-empty {
  padding: 36rpx 20rpx;
  border: 1rpx solid #d9e0dd;
  border-radius: 8rpx;
  background: #fff;
  color: #667085;
  font-size: 25rpx;
  text-align: center;
}

.preview-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-height: 104rpx;
  padding: 14rpx;
}

.preview-cover {
  width: 76rpx;
  height: 76rpx;
  flex: none;
  border-radius: 8rpx;
  background: #eef2f0;
}

.preview-main {
  flex: 1;
  min-width: 0;
}

.preview-title {
  color: #111827;
  font-size: 27rpx;
  font-weight: 900;
}

.preview-desc {
  margin-top: 6rpx;
  color: #667085;
  font-size: 22rpx;
}

.preview-count {
  width: 54rpx;
  height: 54rpx;
  flex: none;
  border-radius: 8rpx;
  background: #eef2f0;
  color: #344054;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 54rpx;
  text-align: center;
}

.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  background: rgba(17, 24, 39, 0.42);
}

.editor-sheet {
  width: 100%;
  max-height: 86vh;
  overflow-y: auto;
  padding: 18rpx 24rpx 34rpx;
  border-radius: 16rpx 16rpx 0 0;
  background: #fff;
  box-sizing: border-box;
}

.sheet-handle {
  width: 72rpx;
  height: 8rpx;
  margin: 0 auto 20rpx;
  border-radius: 999rpx;
  background: #d0d5dd;
}

.sheet-title {
  color: #111827;
  font-size: 32rpx;
  font-weight: 900;
}

.field {
  margin-top: 24rpx;
}

.label {
  margin-bottom: 12rpx;
  color: #111827;
  font-size: 25rpx;
  font-weight: 900;
}

.input {
  width: 100%;
  height: 76rpx;
  padding: 0 18rpx;
  border-radius: 8rpx;
  background: #f5f7f6;
  color: #111827;
  font-size: 27rpx;
  box-sizing: border-box;
}

.url-input {
  margin-top: 14rpx;
  font-size: 24rpx;
}

.cover-editor {
  display: flex;
  gap: 16rpx;
}

.cover-preview {
  width: 156rpx;
  height: 156rpx;
  flex: none;
  border-radius: 8rpx;
  background: #eef2f0;
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a15c20;
  font-size: 25rpx;
  font-weight: 900;
}

.cover-actions {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 12rpx;
}

.upload-btn,
.clear-btn {
  height: 68rpx;
  margin: 0;
  border-radius: 8rpx;
  font-size: 25rpx;
  font-weight: 900;
  line-height: 68rpx;
}

.upload-btn {
  background: #176b5b;
  color: #fff;
}

.clear-btn {
  border: 1rpx solid #b9c7c2;
  background: #fff;
  color: #667085;
}

.row-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.hint {
  color: #667085;
  font-size: 23rpx;
}

.sheet-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14rpx;
  margin-top: 30rpx;
}

.cancel-btn,
.save-btn {
  height: 78rpx;
  margin: 0;
  border-radius: 8rpx;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 78rpx;
}

.cancel-btn {
  border: 1rpx solid #b9c7c2;
  background: #fff;
  color: #667085;
}

.save-btn {
  background: #176b5b;
  color: #fff;
}

.delete-btn {
  width: 100%;
  height: 74rpx;
  margin: 22rpx 0 0;
  border-radius: 8rpx;
  background: #fff1f0;
  color: #b42318;
  font-size: 26rpx;
  font-weight: 900;
  line-height: 74rpx;
}
</style>
