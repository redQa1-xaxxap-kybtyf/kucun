# 库存管理ERP - Android版本

> 基于2025年最佳实践的现代化Android应用

## 📱 项目概述

这是瓷砖行业库存管理工具的Android原生客户端，采用现代化Android开发技术栈构建，提供流畅的移动端ERP管理体验。

## 🎯 核心目标

- **原生性能**：充分利用Android平台能力，提供流畅的用户体验
- **离线优先**：支持离线操作，网络恢复后自动同步
- **实时同步**：与Web端数据实时同步，确保数据一致性
- **现代化UI**：采用Material Design 3设计语言
- **安全可靠**：完善的身份认证和数据加密机制

## 🏗️ 技术架构

### 核心技术栈

#### UI层

- **Jetpack Compose** - 声明式UI框架
- **Material Design 3** - 现代化设计系统
- **Compose Navigation** - 类型安全的导航系统
- **Accompanist** - Compose辅助库（权限、系统UI控制等）

#### 架构模式

- **Clean Architecture** - 清晰的层次划分
- **MVVM Pattern** - Model-View-ViewModel架构
- **Repository Pattern** - 数据访问抽象层
- **Use Cases** - 业务逻辑封装

#### 依赖注入

- **Hilt** - 官方推荐的依赖注入框架
- 模块化配置
- 编译时验证

#### 异步处理

- **Kotlin Coroutines** - 协程处理异步操作
- **Flow** - 响应式数据流
- **StateFlow/SharedFlow** - 状态管理
- **Channel** - 事件通信

#### 本地存储

- **Room Database** - 类型安全的SQLite抽象层
- **DataStore** - 现代化的数据存储方案（替代SharedPreferences）
- **加密存储** - 敏感数据加密（使用EncryptedSharedPreferences）

#### 网络层

- **Retrofit** - REST API客户端
- **OkHttp** - HTTP客户端
- **Kotlin Serialization** - JSON序列化（性能优于Gson）
- **Coil** - 图片加载库（Compose优化）

#### 实时通信

- **Socket.IO Client** - WebSocket通信
- **Server-Sent Events** - 服务器推送

#### 测试

- **JUnit5** - 单元测试框架
- **MockK** - Kotlin Mock框架
- **Turbine** - Flow测试工具
- **Compose UI Testing** - UI测试
- **Hilt Testing** - 依赖注入测试

#### 工具链

- **Gradle Version Catalog** - 统一依赖管理
- **Detekt** - Kotlin代码静态分析
- **ktlint** - Kotlin代码格式化
- **Gradle KTS** - Kotlin DSL构建脚本

## 📂 项目结构

```
anzhuo/
├── app/                                    # 应用模块
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/kucun/erp/
│   │   │   │   ├── KucunApplication.kt   # Application类
│   │   │   │   ├── di/                    # 依赖注入模块
│   │   │   │   │   ├── AppModule.kt
│   │   │   │   │   ├── NetworkModule.kt
│   │   │   │   │   ├── DatabaseModule.kt
│   │   │   │   │   └── RepositoryModule.kt
│   │   │   │   ├── MainActivity.kt        # 主Activity
│   │   │   │   └── navigation/            # 导航配置
│   │   │   │       ├── NavGraph.kt
│   │   │   │       └── NavigationRoutes.kt
│   │   │   ├── res/                       # 资源文件
│   │   │   └── AndroidManifest.xml
│   │   ├── test/                          # 单元测试
│   │   └── androidTest/                   # UI测试
│   └── build.gradle.kts
│
├── core/                                   # 核心模块
│   ├── common/                            # 通用工具
│   │   ├── util/                          # 工具类
│   │   ├── extension/                     # Kotlin扩展
│   │   └── constants/                     # 常量定义
│   ├── network/                           # 网络层
│   │   ├── api/                           # API定义
│   │   ├── interceptor/                   # 拦截器
│   │   └── model/                         # 网络模型
│   ├── database/                          # 数据库
│   │   ├── dao/                           # 数据访问对象
│   │   ├── entity/                        # 数据库实体
│   │   └── KucunDatabase.kt
│   ├── datastore/                         # 本地存储
│   │   └── PreferencesManager.kt
│   └── domain/                            # 领域层
│       ├── model/                         # 领域模型
│       ├── repository/                    # Repository接口
│       └── usecase/                       # 用例
│
├── feature/                               # 功能模块
│   ├── auth/                              # 认证模块
│   │   ├── data/
│   │   │   ├── repository/
│   │   │   └── source/
│   │   ├── domain/
│   │   │   ├── model/
│   │   │   └── usecase/
│   │   └── ui/
│   │       ├── login/
│   │       └── profile/
│   │
│   ├── inventory/                         # 库存管理
│   │   ├── data/
│   │   ├── domain/
│   │   └── ui/
│   │       ├── list/                      # 库存列表
│   │       ├── detail/                    # 库存详情
│   │       ├── adjust/                    # 库存调整
│   │       └── inbound/                   # 入库记录
│   │
│   ├── product/                           # 产品管理
│   │   ├── data/
│   │   ├── domain/
│   │   └── ui/
│   │       ├── list/
│   │       ├── detail/
│   │       └── create/
│   │
│   ├── sales/                             # 销售订单
│   │   ├── data/
│   │   ├── domain/
│   │   └── ui/
│   │       ├── list/
│   │       ├── detail/
│   │       └── create/
│   │
│   ├── customer/                          # 客户管理
│   │   ├── data/
│   │   ├── domain/
│   │   └── ui/
│   │
│   ├── supplier/                          # 供应商管理
│   │   ├── data/
│   │   ├── domain/
│   │   └── ui/
│   │
│   ├── finance/                           # 财务管理
│   │   ├── data/
│   │   ├── domain/
│   │   └── ui/
│   │       ├── statement/                 # 对账单
│   │       ├── payment/                   # 收付款
│   │       └── report/                    # 财务报表
│   │
│   └── dashboard/                         # 仪表盘
│       ├── data/
│       ├── domain/
│       └── ui/
│
├── design-system/                         # 设计系统
│   ├── component/                         # 通用组件
│   │   ├── button/
│   │   ├── card/
│   │   ├── dialog/
│   │   ├── textfield/
│   │   └── topbar/
│   ├── theme/                             # 主题配置
│   │   ├── Color.kt
│   │   ├── Type.kt
│   │   └── Theme.kt
│   └── icon/                              # 图标资源
│
├── gradle/                                # Gradle配置
│   └── libs.versions.toml                # 版本目录
│
├── build.gradle.kts                       # 根构建脚本
├── settings.gradle.kts                    # Gradle设置
├── gradle.properties                      # Gradle属性
└── README.md
```

## 🔄 数据流架构

### 三层架构

```
┌─────────────────────────────────────────┐
│           UI Layer (Compose)            │
│  ┌─────────────────────────────────┐   │
│  │  Screen (Composable)            │   │
│  │  ↓                               │   │
│  │  ViewModel (StateFlow)          │   │
│  └─────────────────────────────────┘   │
└─────────────────┬───────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│         Domain Layer (Use Cases)        │
│  ┌─────────────────────────────────┐   │
│  │  Use Case (Business Logic)      │   │
│  │  ↓                               │   │
│  │  Repository Interface           │   │
│  └─────────────────────────────────┘   │
└─────────────────┬───────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────┐
│          Data Layer (Repository)        │
│  ┌─────────────────────────────────┐   │
│  │  Repository Implementation      │   │
│  │  ↙              ↘                │   │
│  │ Local         Remote             │   │
│  │ (Room)        (Retrofit)         │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 数据同步策略

#### 单一真相来源 (Single Source of Truth)

- **数据库为主**：本地Room数据库作为唯一数据源
- **网络为辅**：API数据更新本地数据库
- **UI观察**：UI层观察数据库Flow

#### 同步流程

```kotlin
// Repository实现示例
class InventoryRepositoryImpl(
    private val api: InventoryApi,
    private val dao: InventoryDao,
    private val ioDispatcher: CoroutineDispatcher
) : InventoryRepository {

    // UI观察数据库Flow
    override fun getInventoryList(): Flow<List<Inventory>> {
        return dao.observeAll()
    }

    // 刷新逻辑：先从API获取，再更新数据库
    override suspend fun refresh() = withContext(ioDispatcher) {
        try {
            val items = api.getInventoryList()
            dao.insertAll(items.map { it.toEntity() })
            Result.Success(Unit)
        } catch (e: Exception) {
            Result.Error(e)
        }
    }
}
```

## 🎨 UI/UX设计原则

### Material Design 3

- **动态配色**：支持Material You主题
- **自适应布局**：支持手机、平板多种屏幕
- **深色模式**：完整的深色主题支持

### 交互设计

- **手势操作**：滑动删除、下拉刷新
- **即时反馈**：操作立即响应
- **错误恢复**：友好的错误提示和重试机制
- **加载状态**：明确的加载指示器

### 性能优化

- **懒加载**：LazyColumn虚拟化长列表
- **图片优化**：Coil自动缓存和压缩
- **后台工作**：WorkManager处理后台任务
- **内存管理**：及时释放资源

## 🔐 安全机制

### 身份认证

- **JWT Token**：与Web端统一的认证机制
- **Token刷新**：自动刷新过期Token
- **安全存储**：EncryptedDataStore存储Token

### 数据安全

- **HTTPS**：强制使用加密传输
- **证书固定**：防止中间人攻击
- **本地加密**：敏感数据SQLCipher加密
- **权限最小化**：仅申请必要权限

### 代码安全

- **ProGuard/R8**：代码混淆
- **签名验证**：防止应用篡改
- **Root检测**：检测越狱设备

## 📊 监控与分析

### 崩溃监控

- **Firebase Crashlytics**：崩溃日志收集
- **自定义日志**：业务关键点日志

### 性能监控

- **App Startup**：启动性能分析
- **Baseline Profiles**：性能优化配置
- **Systrace**：系统级性能追踪

### 用户分析

- **Firebase Analytics**：用户行为分析
- **自定义事件**：业务关键指标

## 🚀 部署流程

### 构建变体

- **Debug**：开发调试版本
- **Staging**：测试环境版本
- **Release**：生产环境版本

### CI/CD

- **GitHub Actions**：自动化构建和测试
- **自动签名**：Gradle配置签名
- **版本管理**：语义化版本号

### 发布渠道

- **内部测试**：Alpha测试轨道
- **公开测试**：Beta测试轨道
- **正式发布**：生产轨道

## 📝 开发规范

### Kotlin编码规范

- 遵循官方Kotlin编码规范
- 使用ktlint自动格式化
- Detekt静态代码分析

### Compose规范

- 无状态Composable优先
- 状态提升原则
- 副作用正确使用

### Git规范

- 功能分支开发
- Commit Message规范
- Code Review流程

## 🧪 测试策略

### 单元测试

- Repository测试（使用Fake实现）
- ViewModel测试（使用Turbine）
- Use Case测试

### UI测试

- Compose UI测试
- 关键业务流程测试
- 无障碍功能测试

### 集成测试

- API集成测试
- 数据库迁移测试
- 端到端测试

## 📚 参考资源

### 官方文档

- [Android开发者文档](https://developer.android.com)
- [Jetpack Compose文档](https://developer.android.com/compose)
- [Material Design 3](https://m3.material.io)

### 学习资源

- [Now in Android](https://github.com/android/nowinandroid) - Google官方示例项目
- [Android Architecture Samples](https://github.com/android/architecture-samples)

### 社区资源

- [Android Weekly](https://androidweekly.net)
- [Kotlin Weekly](https://kotlinweekly.net)

## 📄 许可证

MIT License - 与Web版本保持一致
