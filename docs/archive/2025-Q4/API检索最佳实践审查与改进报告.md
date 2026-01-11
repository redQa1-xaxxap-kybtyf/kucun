# API 检索最佳实践审查与改进报告

更新时间：2025-12-16  
范围：Next.js App Router（`app/api/**/route.ts`）+ Prisma 数据检索（列表/查询类接口）

---

## 结论摘要

当前仓库在“列表检索类 API”上已经具备部分可复用能力（统一错误处理、分页校验、以及库存模块的混合分页实践），但在 `app/api` 下仍存在大量重复实现与并行方案，导致：

- 分页/检索参数解析分散，默认值、上限、合法性校验不一致；
- 多数接口仍用偏移分页（`skip=(page-1)*limit`），在大页码/大数据量下存在显著性能风险；
- 错误处理与响应结构存在多套实现（`withErrorHandling`/`ApiError`/`successResponse`/`NextResponse.json` 多种组合），日志与错误可追踪性难以统一；
- 相同的“检索最佳实践”（排序白名单、稳定排序、limit+1 判定 hasMore、可选 total 计算、索引友好 where）尚未形成一套可复制的标准模板。

本报告给出：真实代码盘点、重复模式审查、检索最佳实践规范，以及一套可渐进迁移的落地路线图。

---

## 现状盘点（基于仓库真实代码）

### 分页与检索参数

- `app/api` 下共有约 **157** 个 `route.ts`。
- 至少 **28** 个路由直接读取 `searchParams.get('page')`，**29** 个路由读取 `searchParams.get('limit')`，且解析方式不一致（`parseInt(...)`、手写 clamp、或使用不同的 Zod schema）。
- 已存在的可复用实现/参考：
  - **分页校验**：`lib/validations/base.ts` 的 `paginationValidations.query`（能接收 string 并转换）。
  - **产品列表分页元信息**：`lib/api/handlers/products-list.ts` 的 `buildPagination`。
  - **大表混合分页最佳实践**：`lib/api/inventory-query-builder-v2.ts`（前 N 页 offset + 后续 cursor + 软限制引导筛选）。

### 错误处理与响应规范

仓库里同时存在多套“错误处理/认证/响应”组合：

- `lib/api/middleware.ts`：`withErrorHandling` + `withAuth`（next-auth session）+ 标准化错误结构（含 `errorId`）。
- `lib/auth/api-helpers.ts`：`withAuth`（权限/CSRF/多来源兼容），也内置错误捕获与响应。
- `lib/api/response.ts`：`successResponse/errorResponse`（`{ success, data?, error? }`）。
- `lib/api-helpers.ts`：另一套 `successResponse/errorResponse/validateQueryParams/handleApiError`（与 `lib/api/response.ts` 与 `lib/api/middleware.ts` 并行）。

结果是：同类接口在失败时返回结构不一致、日志格式不一致，调用方（Web/小程序）难以形成稳定的错误处理与重试策略。

---

## 重复代码模式审查与改进建议

### 模式 1：分页逻辑重复（offset 分页）

**常见重复片段（示例）**

```ts
const page = parseInt(searchParams.get('page') || '1', 10);
const limit = parseInt(searchParams.get('limit') || '20', 10);
const skip = (page - 1) * limit;
```

**问题点**

1. **缺少统一上限**：有的接口 `limit` 可被拉到很大，导致数据库与网络压力激增。
2. **缺少统一合法性**：负数/NaN/空串等边界处理不一致。
3. **skip 性能隐患**：`skip` 在大页码下会退化（数据库仍需扫描/跳过大量行），日志、财务流水、出入库记录等“增长型表”尤其明显。
4. **排序不稳定风险**：当排序字段不唯一（如 `createdAt`）时，分页可能出现重复/丢失。

**改进建议（优先级从高到低）**

1. **统一解析与 clamp**：用一套可复用工具/Schema 固定 `page>=1`、`1<=limit<=maxPageSize`，默认值来自 `paginationConfig`。
2. **排序白名单 + 稳定排序**：限制 `sortBy` 只能取白名单；实际 `orderBy` 增加第二排序键（如 `id`）保证稳定。
3. **统一分页元信息**：
   - 轻量：`hasMore`（用 `take: limit+1` 推导）；
   - 完整：`total/totalPages`（需要额外 `count`，可按需开启）。
4. **引入混合分页策略**：参考 `lib/api/inventory-query-builder-v2.ts`，对大表设定 offset 页数阈值（如 50 页），超过阈值返回引导信息或改用 cursor。

---

### 模式 2：错误处理重复（try/catch + console.error）

**常见重复片段（示例）**

```ts
try {
  // 业务逻辑
} catch (error) {
  console.error('Error:', error);
  return NextResponse.json({ success: false, error: '操作失败' }, { status: 500 });
}
```

**问题点**

1. **日志不可追踪**：`console.error` 缺少结构化字段（url/method/user/errorId），排障困难。
2. **响应结构不统一**：有的接口返回 `{ success:false, error:'...' }`，有的返回 `{ success:false, error:{ type, message, ... } }`。
3. **数据库/校验错误未归一**：Prisma、Zod 的错误码与字段信息难以稳定暴露给调用方（尤其是表单提交场景）。

**改进建议**

1. **优先复用现有统一错误处理**：对 `app/api` 路由逐步迁移到 `lib/api/middleware.ts` 的 `withErrorHandling`（或选定另一套作为唯一入口），避免重复造轮子。
2. **业务主动抛 `ApiError`**：输入校验/权限/资源不存在等场景用 `ApiError.badRequest/notFound/forbidden...`，并由统一错误处理转换为响应。
3. **统一错误响应契约**：选择一种 `{ success:false, error: ... }` 的规范并固定字段（建议至少包含 `message` 与 `errorId`，开发环境可附 `details`）。

---

## 检索最佳实践（建议作为全局规范）

### 1) Query 解析与校验

- **只从一个入口解析**：统一用 `request.nextUrl.searchParams`（Next.js 原生），避免 `new URL(request.url)` 在不同运行时的细节差异。
- **使用 schema 解析字符串**：优先使用 `z.coerce.*` 或类似 `paginationValidations.query` 的 transform 方案，避免散落的 `parseInt`。
- **限制 search 长度**：比如 `search` 最多 100 字符，避免无界模糊查询拖垮数据库。

### 2) 分页策略（Offset / Cursor / Hybrid）

- **默认 offset（用户体验）**：支持跳页；但必须有 `limit` 上限。
- **大表优先 cursor（性能）**：用 `cursor + take`，避免 `skip` 退化。
- **推荐 Hybrid（折中）**：参考 `lib/api/inventory-query-builder-v2.ts`：
  - 前 N 页用 offset；
  - 超过 N 页提示用户用筛选缩小范围，或改用 cursor；
  - 可在响应里返回 `strategy` 字段辅助前端展示。

### 3) 排序与稳定性

- **sortBy 白名单**：避免用户传任意字段导致慢查询或越权（如按敏感字段排序）。
- **稳定排序**：当主排序字段可能重复时，追加 `id`（或唯一键）作为第二排序键。

### 4) 搜索与索引友好

- 避免对多个字段同时 `contains` 且无索引的组合查询在高并发下退化。
- 对“常用过滤条件”优先建立索引，并让 where 与索引方向一致（例如 `status + categoryId + createdAt` 等组合）。
- 需要更强搜索能力时考虑：
  - MySQL：FULLTEXT（对名称/编码/规格），或专用搜索服务；
  - PostgreSQL：GIN + tsvector。

### 5) Prisma 查询性能

- **select 优先**：列表页避免 `include: { ... }` 拉全量关联，按需 select 字段。
- **limit+1**：用 `take: limit + 1` 判断 `hasMore`，在不需要 total 的情况下可省掉 `count`。
- **并发查询**：需要 `count` 时用 `Promise.all`（当前已有不少接口在这么做）。

### 6) 响应契约（调用方友好）

建议固定一个“分页响应”结构（示例）：

- `data: items[]`
- `pagination: { page, limit, total?, totalPages?, hasMore, nextCursor? }`

并将 `total/totalPages` 作为可选字段：只有在前端确实需要“总数/页数”时才计算。

### 7) 可观测性与安全

- 统一日志字段：`route`, `method`, `userId`, `durationMs`, `errorId`。
- 对列表类接口进行速率限制（已存在 `checkRateLimit`，但应用范围不统一）。
- 对外暴露的错误信息做分层：用户可读 message + 可追踪 errorId；内部 details 仅开发环境返回。

---

## 推荐实现模板（供复制粘贴）

### 模板 A：标准列表检索（offset + 可选 total）

说明：仅展示结构与最佳实践点；具体用哪套 `withAuth/withErrorHandling/successResponse` 需要先确定“唯一真理源”。

```ts
export const GET = withAuth(
  withErrorHandling(async (request: NextRequest) => {
    const sp = request.nextUrl.searchParams;
    const { page, limit, search, sortBy, sortOrder } =
      paginationValidations.query.parse({
        page: sp.get('page'),
        limit: sp.get('limit'),
        search: sp.get('search'),
        sortBy: sp.get('sortBy'),
        sortOrder: sp.get('sortOrder'),
      });

    const skip = (page - 1) * limit;

    // Prisma: take limit+1 推导 hasMore（可选）
    const rows = await prisma.xxx.findMany({
      where: buildWhere({ search }),
      orderBy: buildOrderBy(sortBy, sortOrder), // sortBy 白名单 + 稳定排序
      skip,
      take: limit + 1,
      select: { /* 列表字段 */ },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return successResponse({
      items,
      pagination: { page, limit, hasMore },
    });
  })
);
```

### 模板 B：大表混合分页（建议对日志/流水/出入库记录类复用）

直接复用现有 `lib/api/inventory-query-builder-v2.ts` 的策略思想：

- `page<=N`：offset；
- `cursor`：cursor-based；
- 超过阈值：返回引导信息（建议用户加筛选条件）。

---

## 迁移路线图（渐进式，降低风险）

### 阶段 0：定规范（1 次决策）

1. 选定“唯一 API 包装器组合”（认证/错误/响应格式）：
   - 方案 1：以 `lib/api/middleware.ts` 为主（`withAuth/withErrorHandling`）。
   - 方案 2：以 `lib/auth/api-helpers.ts` 为主（`withAuth`），并将错误统一委托给 `withErrorHandling`（或反之）。
2. 固定分页响应契约：`items + pagination` 或 `successResponse({ items, pagination })` 等。

### 阶段 1：抽公共工具（不改业务）

- 抽出通用的分页解析/排序白名单/分页 meta 构建工具（可先以“新工具 + 老接口兼容”的方式落地）。
- 对 1~2 个典型接口做试点（例如 `logs`、`notifications`），确认前端不受影响。

### 阶段 2：批量迁移列表接口

- 优先迁移“新增/近期修改/频繁出错”的路由。
- 对增长型表优先引入 Hybrid 分页或 cursor 分页。

### 阶段 3：收敛并删除旧实现

- 清理重复的 `successResponse/errorResponse/handleApiError/validateQueryParams` 等并行实现。
- 文档化：在 `docs/` 固定“写新 API 的模板与 checklist”，避免回退。

---

## 附录：建议的公共工具清单（供后续实施）

- `lib/api/pagination.ts`：统一解析 `page/limit/cursor`、构建 `skip/take`、输出 `pagination` meta。
- `lib/api/sort.ts`：对每个资源定义 `sortBy` 白名单与稳定 `orderBy`。
- `lib/api/search.ts`：统一 `search` 的长度限制、字段映射与索引友好策略。
- `lib/api/route.ts`：一个“组合式 wrapper”，把 auth + error + validation 组装为单一入口，降低每个路由的样板代码。

