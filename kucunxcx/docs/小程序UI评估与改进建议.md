# 小程序 UI 评估与改进建议（新版 UI）

评估日期：2025-12-17  
评估对象：小程序首页/产品列表等核心浏览链路（以“产品卡片 + 搜索/筛选/布局切换 + 浮动导航”为主）  
说明：以下为 UI 评估结论与改进建议的整理稿（含示例代码片段）。

---

## 评估概览

| 维度     |   评分 | 等级          |
| -------- | -----: | ------------- |
| 阅读性   | 85/100 | ⭐⭐⭐⭐ 优秀 |
| 使用性   | 78/100 | ⭐⭐⭐⭐ 良好 |
| 理解性   | 82/100 | ⭐⭐⭐⭐ 优秀 |
| 方便性   | 75/100 | ⭐⭐⭐ 良好   |
| 综合评分 | 80/100 | 良好偏优      |

---

## 1. 阅读性评估 (85/100)

### ✅ 优点

| 方面     | 具体表现                                          | 评分 |
| -------- | ------------------------------------------------- | ---: |
| 字体系统 | 使用系统字体 -apple-system, PingFang SC，渲染清晰 |   90 |
| 层次分明 | 主标题30rpx/700、正文26rpx/500、辅助文本24rpx/400 |   88 |
| 颜色对比 | 主文本 #1D1D1F 在白色背景上对比度 > 7:1           |   85 |
| 行间距   | 合理的 line-height: 1.5                           |   82 |
| 信息密度 | 卡片式布局，信息分组清晰                          |   85 |

### 具体示例

产品卡片文字层次：

- 产品编码 (#1a1a1a, 30rpx, bold) ← 最重要
- 产品名称 (#333, 26rpx, medium) ← 次重要
- 规格信息 (#666, 24rpx, regular) ← 辅助信息
- 库存状态 (#34c759, 24rpx, bold) ← 状态标识

### ⚠️ 问题与改进建议

| 问题               | 严重程度 | 改进建议                                                     |
| ------------------ | -------- | ------------------------------------------------------------ |
| 三列布局文字过小   | 中       | 三列网格下产品名称只有22rpx，老年用户阅读困难。建议最小24rpx |
| 次级文本对比度不足 | 低       | #86868B 在浅背景上对比度约 3.5:1，低于 WCAG AA 标准 4.5:1    |
| 长文本截断无提示   | 低       | 产品名称超过2行直接截断，无视觉提示用户还有更多内容          |

改进代码示例：

```css
/* 提高次级文本对比度 */
.product-spec {
  color: #636366; /* 从 #86868B 提升 */
}

/* 三列布局最小字号 */
.layout-grid-3 .product-name {
  font-size: 24rpx; /* 从 22rpx 提升 */
  -webkit-line-clamp: 1; /* 三列模式只显示1行 */
}

/* 截断文本添加渐变提示 */
.product-name {
  position: relative;
}
.product-name::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  width: 40rpx;
  height: 1.2em;
  background: linear-gradient(to right, transparent, white);
}
```

---

## 2. 使用性评估 (78/100)

### ✅ 优点

| 方面     | 具体表现                           | 评分 |
| -------- | ---------------------------------- | ---: |
| 搜索便捷 | 顶部固定搜索栏，一键触达           |   90 |
| 筛选直观 | Vant DropdownMenu 筛选菜单标准交互 |   85 |
| 布局切换 | 支持三种布局模式，记忆用户偏好     |   88 |
| 下拉刷新 | 支持原生下拉刷新                   |   82 |
| 无限滚动 | 自动加载更多，无需手动翻页         |   85 |

### ⚠️ 问题与改进建议

| 问题             | 严重程度 | 影响范围       | 改进建议                                   |
| ---------------- | -------- | -------------- | ------------------------------------------ |
| 浮动导航遮挡内容 | 高       | 首页、产品列表 | 底部增加 padding-bottom: 120rpx 占位       |
| 筛选状态不明显   | 中       | 产品列表       | 激活的筛选项应有视觉标识（如角标数字）     |
| 缺少返回顶部     | 中       | 长列表页面     | 滚动超过1屏后显示“返回顶部”按钮            |
| 登录后无引导     | 中       | 登录成功后     | 缺少功能引导流程，新用户可能不知道从哪开始 |
| 手势操作缺失     | 低       | 产品卡片       | 不支持左滑收藏/右滑分享等快捷操作          |

### 交互流程分析

当前搜索流程（需要 4 步）：

点击搜索框 → 输入关键词 → 点击搜索按钮 → 查看结果

优化后搜索流程（可减少到 2 步）：

点击搜索框 → 输入关键词（自动搜索，去抖300ms）

改进代码：

```ts
// 实时搜索 - 去抖处理
private searchTimer: number | null = null;

onSearchChange(e: any) {
  const value = e.detail;
  this.setData({ searchValue: value });

  // 清除之前的定时器
  if (this.searchTimer) {
    clearTimeout(this.searchTimer);
  }

  // 300ms 去抖
  this.searchTimer = setTimeout(() => {
    this.loadProducts();
  }, 300);
}
```

---

## 3. 理解性评估 (82/100)

### ✅ 优点

| 方面         | 具体表现                          | 评分 |
| ------------ | --------------------------------- | ---: |
| 图标语义明确 | 使用 Vant 标准图标，用户熟悉度高  |   88 |
| 颜色语义统一 | 绿色=有货、红色=缺货、蓝色=主操作 |   90 |
| 状态标签清晰 | van-tag 配合颜色区分状态          |   85 |
| 空状态提示   | 使用 van-empty 组件给予明确反馈   |   80 |
| 加载状态     | 有明确的加载中/加载完成提示       |   82 |

### 语义化颜色系统

- 🟢 #34C759 (iOS Green) → 成功、有货、正常
- 🔴 #FF3B30 (iOS Red) → 危险、缺货、异常
- 🟠 #FF9500 (iOS Orange) → 警告、库存预警
- 🔵 #0071E3 (iOS Blue) → 主操作、链接、选中
- 🟣 #AF52DE (iOS Purple) → 辅助、特殊状态
- ⚪ #86868B (iOS Gray) → 禁用、辅助文本

### ⚠️ 问题与改进建议

| 问题             | 严重程度 | 改进建议                                                             |
| ---------------- | -------- | -------------------------------------------------------------------- |
| 权限差异无解释   | 高       | 访客看不到具体库存数字，但没有解释原因。建议添加“登录后查看详细库存” |
| 极光按钮语义模糊 | 中       | 首页中间浮动按钮禁用时的极光动画含义不明确，用户可能误以为是加载中   |
| 分类层级不直观   | 低       | 二级分类收起时无法预知有多少子分类，建议显示子分类数量               |
| 筛选选项无说明   | 低       | 排序选项如“按库存”没有说明是升序还是降序                             |

改进示例：

```xml
<!-- 访客模式提示 -->
<view class="login-hint" wx:if="{{ !canViewNumericInventory }}">
  <van-icon name="info-o" size="14px" />
  <text>登录后可查看详细库存数量</text>
  <text class="login-link" bindtap="goToLogin">立即登录</text>
</view>
```

```xml
<!-- 浮动按钮 - 禁用状态 -->
<view class="dock-circle dock-circle-disabled" bindtap="showPermissionTip">
  <van-icon name="plus" color="#fff" />
</view>
```

```ts
showPermissionTip() {
  wx.showToast({
    title: '需要管理员权限',
    icon: 'none',
    duration: 2000,
  });
}
```

---

## 4. 方便性评估 (75/100)

### ✅ 优点

| 方面     | 具体表现                 | 评分 |
| -------- | ------------------------ | ---: |
| 首页直达 | 分类卡片一键进入产品列表 |   85 |
| 热门推荐 | 减少用户决策成本         |   80 |
| 布局记忆 | 记住用户偏好的布局模式   |   88 |
| 下拉刷新 | 符合用户习惯             |   85 |

### ⚠️ 问题与改进建议

| 问题       | 严重程度 | 影响操作   | 改进建议                          |
| ---------- | -------- | ---------- | --------------------------------- |
| 无快捷操作 | 高       | 收藏、分享 | 产品卡片支持左滑/长按显示快捷菜单 |
| 无最近搜索 | 高       | 重复搜索   | 搜索框下方显示最近5条搜索记录     |

| 返回后丢失滚动位置 | 中 | 详情页返回 | 从详情页返回列表时，重置到顶部而非之前位置 |

操作效率分析：

- 收藏一个产品（当前流程）：找到产品 → 点击进入详情 → 找到收藏按钮 → 点击收藏 → 返回列表（5步）
- 收藏一个产品（优化后）：找到产品 → 长按 → 点击“收藏”（3步）

改进代码示例：

```ts
// 存储搜索历史
saveSearchHistory(keyword: string) {
  let history = wx.getStorageSync('searchHistory') || [];
  // 去重并限制5条
  history = [keyword, ...history.filter((h: string) => h !== keyword)].slice(0, 5);
  wx.setStorageSync('searchHistory', history);
  this.setData({ searchHistory: history });
}

// 清除历史
clearSearchHistory() {
  wx.removeStorageSync('searchHistory');
  this.setData({ searchHistory: [] });
}
```

```xml
<view
  class="ios-product-card"
  bindtap="navigateToDetail"
  bindlongpress="showActionSheet"
  data-id="{{ item.id }}"
>
  <!-- 卡片内容 -->
</view>
```

```ts
showActionSheet(e: any) {
  const id = e.currentTarget.dataset.id;
  wx.showActionSheet({
    itemList: ['收藏', '分享', '查看库存'],
    success: res => {
      switch (res.tapIndex) {
        case 0:
          this.addToFavorites(id);
          break;
        case 1:
          this.shareProduct(id);
          break;
        case 2:
          this.viewInventory(id);
          break;
      }
    },
  });
}
```

```ts
// 离开页面前保存滚动位置
onHide() {
  this.setData({ savedScrollTop: this.data.scrollTop });
}

// 返回页面时恢复
onShow() {
  if (this.data.savedScrollTop > 0) {
    wx.pageScrollTo({
      scrollTop: this.data.savedScrollTop,
      duration: 0,
    });
  }
}
```

---

## 5. 综合问题优先级矩阵

| 优先级 | 问题                   | 影响维度 | 建议工期 |
| ------ | ---------------------- | -------- | -------: |
| P0     | 浮动导航遮挡内容       | 使用性   |    0.5天 |
| P0     | 权限差异无解释         | 理解性   |    0.5天 |
| P1     | 无搜索历史             | 方便性   |      1天 |
| P1     | 无快捷操作（长按菜单） | 方便性   |      1天 |
| P1     | 筛选状态不明显         | 使用性   |    0.5天 |
| P2     | 三列布局字号过小       | 阅读性   |    0.5天 |
| P2     | 无返回顶部按钮         | 使用性   |    0.5天 |
| P2     | 返回后丢失滚动位置     | 方便性   |    0.5天 |
| P3     | 次级文本对比度         | 阅读性   |    0.5天 |
| P3     | 极光按钮语义模糊       | 理解性   |    0.5天 |

---

## 6. 改进路线图

### 第一阶段：关键修复 (1-2天)

1. 修复浮动导航遮挡：添加底部占位
2. 添加权限提示：访客模式显示登录引导
3. 优化筛选状态：激活项添加视觉标识

### 第二阶段：体验增强 (3-5天)

1. 搜索历史功能：最近搜索、热门搜索
2. 长按快捷菜单：收藏、分享、查看库存
3. 返回顶部按钮：滚动超过1屏显示
4. 保持滚动位置：详情返回保持位置

### 第三阶段：细节打磨 (2-3天)

1. 提升对比度：次级文本、三列布局字号
2. 优化状态提示：禁用按钮点击反馈
3. 添加引导流程：新用户功能引导

---

## 7. 评估总结

### 设计亮点

- 视觉设计优秀：极光动画、玻璃拟态营造现代感
- iOS 风格统一：颜色、圆角、阴影遵循 Apple HIG
- 权限分层清晰：访客与认证用户差异化体验
- 性能优化到位：WXS 脚本、高性能滚动

### 主要短板

- 搜索体验待优化：缺少历史、实时搜索
- 快捷操作缺失：无长按菜单、手势操作
- 状态反馈不足：权限差异、禁用状态解释不清
- 导航体验：底部遮挡、返回丢失位置

### 最终建议

小程序整体 UI 设计水平较高，视觉表现力强，但在交互便捷性和状态反馈方面有提升空间。建议优先解决 P0/P1 级问题，预计投入 5-7 天可完成关键优化，将综合评分提升至 88-90 分。

---

## 8. 代码落地点（仓库定位）

> 目的：把“UI 建议”落到可直接改的文件/选择器/事件上，降低沟通成本。

### P0：优先修复

1. 浮动导航遮挡内容 / 底部安全区
   - 首页浮动 Dock：`kucunxcx/miniprogram/pages/index/index.wxml:169`（`<view class="floating-dock">`）
   - 首页样式：`kucunxcx/miniprogram/pages/index/index.wxss:333`（`.floating-dock` 固定定位）
   - 产品列表容器：`kucunxcx/miniprogram/pages/products/list.wxml:53`（`scroll-view.scroll-container`）
   - 产品列表样式：`kucunxcx/miniprogram/pages/products/list.wxss:72`（`.product-list-wrapper`，建议补 `padding-bottom` 预留空间）

2. 权限差异无解释（访客看不到库存数字/禁用按钮无提示）
   - 产品列表库存数字控制：`kucunxcx/miniprogram/pages/products/list.wxml:83`（`wx:if="{{ item.inventory && canViewNumericInventory }}"`）
   - 首页中间按钮禁用无反馈：`kucunxcx/miniprogram/pages/index/index.ts:239`（`navigateToCreateProduct()` 访客直接 return）
   - 建议：在上述位置增加提示视图/Toast（避免用户误解“加载中/卡住”）

### P1：体验增强

1. 实时搜索（去抖 300ms）
   - 搜索输入事件：`kucunxcx/miniprogram/pages/products/list.ts:247`（`onSearchChange` 当前只 `setData`）
   - 建议：在 `onSearchChange` 内加 timer 去抖并触发 `loadProducts(true)`

2. 返回顶部按钮（长列表）
   - 列表滚动容器：`kucunxcx/miniprogram/pages/products/list.wxml:53`（`scroll-view`）
   - 建议：增加 `bindscroll` 记录 scrollTop + 悬浮按钮；回顶用 `scroll-top="{{scrollTop}}"` 或 `wx.pageScrollTo`（注意当前是 `scroll-view` 场景）

3. 快捷操作（长按菜单/手势）
   - 产品卡片：`kucunxcx/miniprogram/pages/products/list.wxml:63`（`.ios-product-card`）
   - 建议：增加 `bindlongpress="showActionSheet"`，用 `wx.showActionSheet` 提供“收藏/分享/查看库存”等动作

4. 筛选状态不明显
   - 筛选条：`kucunxcx/miniprogram/pages/products/list.wxml:25`（`van-dropdown-menu`）
   - 建议：当 `filterCategory/filterStatus/filterSort` 非默认值时，在“筛选”按钮处显示角标/计数，或将已激活项高亮（不仅仅是 active-color）

### P2：细节打磨

1. 三列布局字号与截断提示
   - 三列字体：`kucunxcx/miniprogram/pages/products/list.wxss:199`（`.layout-grid-3 .product-name { font-size: 22rpx; }`）
   - 建议：提升到 24rpx；必要时只保留 1 行并增加“渐变遮罩”提示（需验证小程序 CSS 兼容）

2. 次级文本对比度
   - 规格颜色：`kucunxcx/miniprogram/pages/products/list.wxss:239`（`.product-spec { color: #888888; }`）
   - 首页搜索图标：`kucunxcx/miniprogram/pages/index/index.wxml:58`（`color="#86868b"`）
   - 建议：统一次级文本色阶（例如更接近 `#636366`），并抽样验证对比度
