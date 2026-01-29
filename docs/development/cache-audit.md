# 缓存系统深度审计（2026-01）

## 范围

- 代码范围：`lib/cache/*`、`lib/redis/redis-client.ts`、`app/api/**` 中的缓存调用点
- 核心目标：一致性（及时失效/不串值）、并发安全（避免击穿/丢写）、可观测（可定位问题）

## 当前缓存分层（按请求链路）

1. **客户端（浏览器/小程序）**
   - TanStack Query：客户端请求级缓存 + 失效（QueryKey/Invalidate）
2. **Server Components**
   - React `cache()`：同一请求内的记忆化
   - Next `unstable_cache`：Next 运行时/构建缓存（目前仅封装，仓库内暂无实际调用点）
3. **API/服务端（Redis）**
   - `getOrSetJSON`：主流查询缓存（带随机 TTL、防穿透空值缓存）
   - `getOrSetWithLock`：热点 key 的击穿保护（分布式锁）
   - `scanDel`/`invalidateNamespace`：按 pattern 批量失效
4. **跨进程同步**
   - Redis Pub/Sub：失效/业务事件广播（订阅在进程启动时初始化）

## “硬性规范”（来自单测的可执行约束）

这些约束已经通过 `__tests__/unit/cache/*` 单测固化，属于 P0 行为规范：

- **失效必须立即执行**：API 端点触发缓存失效时不再使用 `setTimeout` 延迟。
- **null-cache TTL = 3600s**：对“确实不存在”的结果做负缓存，避免穿透反复回源。
- **分布式锁要求**
  - 获取锁必须使用 `PX`（毫秒 TTL）
  - 释放锁必须使用 Lua compare-and-del（仅 token 持有者可释放）
  - 获取失败需要重试（指数退避 + jitter）
- **库存汇总批量写缓存必须原子提交**：`WATCH` + `MULTI/EXEC`，并在 `exec=null` 时重试且记录观测字段。

## 关键风险清单（按严重度）

### P0（会导致数据不一致/并发异常/回归）

- **延迟失效引入“写后读旧”窗口**：对库存/订单到货入库等强一致链路风险极高。
- **锁释放非原子**：`GET` + `DEL` 存在竞态，可能误删他人锁或导致锁泄漏。
- **批量缓存写入非原子**：逐 key 写导致“部分新、部分旧”的读侧不一致，且并发下更明显。

> 上述 P0 项已按单测规范修复（见“已落地修复”）。

### P1（会导致失效不全/长期陈旧/维护成本上升）

- **Key schema 多套并存**
  - 典型表现：同一业务域同时存在 `products:detail:*` 与 `products:{id}` 两套前缀/标签约定；
  - 风险：失效系统按 tag/pattern 工作时，容易“删不到”或“删过头”。
- **失效机制双轨并存**
  - `lib/cache/revalidate.ts`（tag + Pub/Sub + Next revalidate）
  - `lib/cache/invalidation-strategy.ts`（pattern + 分级/预热）
  - 风险：同一事件触发两套失效，或者两套各删一半，出现“看似写了失效，实际上没删到关键 key”。
- **Redis 降级（内存缓存）一致性边界不清**
  - Redis 不可用时会落到进程内 memory cache；
  - 风险：跨进程不可见、失效不可广播、可能在恢复前持续陈旧（需业务确认是否可接受）。
- **跨权限/跨用户缓存污染风险（需逐端点复核）**
  - 对需要按用户/角色过滤的接口，缓存 key 必须包含权限边界（例如 userId/role/tenant）。
  - 现状：部分接口已显式包含 `user.id`（例如应收列表），但并非全量覆盖；建议建立“必须包含边界”的清单并加测试。

### P2（可观测与可运营性不足）

- 缺少统一的“key/TTL/失效触发点/级联关系”的台账；靠口口相传容易回归。
- 锁竞争、cache 命中率、scanDel 删除量等缺少统一指标输出（线上难定位雪崩/穿透/击穿）。

## 已落地修复（与单测一致）

- `lib/cache/cache.ts`
  - `NULL_CACHE_TTL` 对齐为 `3600`
  - 分布式锁：`PX` + Lua compare-and-del + 指数退避+jitter
- `lib/cache/inventory-cache.ts`
  - 批量写库存汇总缓存：`WATCH` + `MULTI/EXEC` 原子提交，`exec=null` 重试并打点
- `lib/cache/revalidate.ts`
  - 级联失效不再使用 `setTimeout` 延迟（异步执行但不延迟）

## 建议整改路线（可分期）

1. **统一 key/tag 的“真源”**
   - 以 `CacheTags` 为唯一来源，明确：Redis key 必须以 tag 为前缀（便于 `scanDel(${tag}*)` 精准失效）。
2. **收敛失效系统**
   - 要么将 `invalidation-strategy` 改造成调用 `revalidateCache/revalidateCaches` 的“策略层”，要么逐步下线双轨。
3. **为“权限/用户维度缓存”补齐护栏**
   - 建议增加规则：凡 `withAuth` 且数据与用户/角色有关，key 必须包含 `user.id`/`role`；
   - 用单测固化（类似 `revalidate-immediate-endpoints` 的 P0 测试方式）。
4. **Redis 降级策略复核**
   - 明确哪些数据允许 memory cache（低风险/可短暂陈旧），哪些必须“Redis 不可用就直接回源数据库且不缓存”。
