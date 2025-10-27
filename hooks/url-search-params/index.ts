/**
 * URL Search Params Hook - 核心实现
 *
 * 提供类型安全的URL参数管理
 * 自动同步URL与组件状态,支持防抖、验证、默认值处理
 *
 * ✅ 性能优化: 分离本地状态和URL同步
 * - 本地状态立即更新 (0ms延迟,UI即时响应)
 * - URL更新防抖处理 (避免频繁路由变更)
 */

'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import type { z } from 'zod';

import { logger } from '@/lib/utils/console-logger';

import {
  getDefaultParams,
  parseFromUrl,
  parseSchema,
  validateParams,
} from './schema-parser';
import type {
  ParamConfig,
  UseUrlSearchParamsOptions,
  UseUrlSearchParamsResult,
} from './types';
import {
  areParamsEqual,
  buildFullUrl,
  buildQueryString,
  mergeParams,
} from './url-builder';

/**
 * 通用URL参数管理Hook - Zod Schema重载
 */
export function useUrlSearchParams<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  options?: UseUrlSearchParamsOptions<z.infer<z.ZodObject<T>>>
): UseUrlSearchParamsResult<z.infer<z.ZodObject<T>>>;

/**
 * 通用URL参数管理Hook - 配置对象重载
 */
export function useUrlSearchParams<T extends Record<string, unknown>>(
  schema: Record<keyof T, ParamConfig>,
  options?: UseUrlSearchParamsOptions<T>
): UseUrlSearchParamsResult<T>;

/**
 * 通用URL参数管理Hook - 实现
 *
 * @example
 * ```typescript
 * const { params, setParam, updateParams } = useUrlSearchParams(
 *   salesOrderSchema,
 *   { basePath: '/sales-orders', debounceMs: 300 }
 * );
 *
 * // 类型安全的访问
 * console.log(params.search);
 *
 * // 更新单个参数
 * setParam('status', 'confirmed');
 *
 * // 批量更新参数
 * updateParams({ search: 'test', page: 1 });
 * ```
 */
// eslint-disable-next-line max-lines-per-function -- Core Hook implementation requires comprehensive logic
export function useUrlSearchParams<T extends Record<string, unknown>>(
  schema: z.ZodObject<z.ZodRawShape> | Record<keyof T, ParamConfig>,
  options: UseUrlSearchParamsOptions<T> = {}
): UseUrlSearchParamsResult<T> {
  const { basePath, debounceMs = 0, shallow = false, initialParams } = options;

  // Next.js hooks
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // 解析schema为统一的参数配置
  const configs = useMemo(() => parseSchema<T>(schema), [schema]);

  // 获取默认参数值
  const defaultParams = useMemo(() => getDefaultParams<T>(configs), [configs]);

  // 从URL或initialParams解析当前参数值
  const urlParams = useMemo<T>(() => {
    if (initialParams) {
      // 服务端传入的初始参数
      const validation = validateParams<T>(initialParams as T, schema);
      if (validation.success && validation.data) {
        return validation.data;
      }
    }

    // 从URL解析参数
    return parseFromUrl<T>(searchParams, configs);
  }, [searchParams, configs, schema, initialParams]);

  // ✅ 新增: 本地状态用于即时UI更新
  // 初始化时使用URL参数,后续由setParam/updateParams立即更新
  const [localParams, setLocalParams] = useState<T>(urlParams);

  // ✅ 同步URL变化到本地状态 (例如浏览器前进/后退)
  // ✅ 修复BUG: 只监听 urlParams,不监听 localParams
  // 之前的问题: 监听 localParams 导致用户输入时触发同步,把输入重置为URL参数
  // 现在: 只在URL参数变化时同步(例如浏览器前进/后退),不在本地输入时触发
  useEffect(() => {
    // 只有当URL参数真正变化时才更新本地状态
    if (!areParamsEqual(localParams, urlParams)) {
      setLocalParams(urlParams);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentionally only listen to urlParams, not localParams, to prevent input reset bug
  }, [urlParams]); // ✅ 只监听 urlParams,不监听 localParams

  // 使用ref保存最新的参数值,避免闭包陷阱
  const latestParamsRef = useRef<T>(localParams);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 更新ref以保持最新值
  useEffect(() => {
    latestParamsRef.current = localParams;
  }, [localParams]);

  /**
   * 内部函数: 更新URL
   */
  const replaceURL = useCallback(
    (newParams: T) => {
      // 验证参数
      const validation = validateParams<T>(newParams, schema);
      if (!validation.success) {
        logger.error(
          'hooks:url-search-params',
          '参数验证失败',
          validation.error
        );
        return;
      }

      // 构建新URL
      const effectiveBasePath = basePath || pathname;
      const newUrl = buildFullUrl(effectiveBasePath, newParams, configs, {
        includeDefaults: false,
      });

      // ✅ App Router最佳实践：当设置 shallow=true 时，使用 History API 做 URL 浅更新，避免一次完整导航
      // 参考：Next.js SPA/shallow routing 文档
      if (shallow && typeof window !== 'undefined') {
        // 不新增历史记录，避免返回键体验受影响
        window.history.replaceState(null, '', newUrl);
      } else {
        // 使用startTransition避免阻塞UI
        startTransition(() => {
          router.replace(newUrl, { scroll: false });
        });
      }
    },
    [basePath, pathname, configs, schema, router, shallow]
  );

  /**
   * 更新单个参数
   * ✅ 性能优化: 立即更新本地状态,防抖更新URL
   */
  const setParam = useCallback(
    <K extends keyof T>(key: K, value: T[K] | undefined) => {
      // 清除现有的防抖定时器
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // 1. ✅ 立即更新本地状态 (UI即时响应,0ms延迟)
      const updates = { [key]: value } as Partial<T>;
      const newParams = mergeParams(latestParamsRef.current, updates);
      setLocalParams(newParams);

      // 2. ✅ 防抖更新URL (避免频繁路由变更)
      if (debounceMs > 0) {
        debounceTimerRef.current = setTimeout(() => {
          replaceURL(newParams);
        }, debounceMs);
      } else {
        replaceURL(newParams);
      }
    },
    [debounceMs, replaceURL]
  );

  /**
   * 批量更新参数
   * ✅ 性能优化: 立即更新本地状态,防抖更新URL
   */
  const updateParams = useCallback(
    (updates: Partial<T>) => {
      // 清除现有的防抖定时器
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // 1. ✅ 立即更新本地状态 (UI即时响应,0ms延迟)
      const newParams = mergeParams(latestParamsRef.current, updates);
      setLocalParams(newParams);

      // 2. ✅ 防抖更新URL (避免频繁路由变更)
      if (debounceMs > 0) {
        debounceTimerRef.current = setTimeout(() => {
          replaceURL(newParams);
        }, debounceMs);
      } else {
        replaceURL(newParams);
      }
    },
    [debounceMs, replaceURL]
  );

  /**
   * 重置所有参数到默认值
   * ✅ 性能优化: 立即更新本地状态,同时更新URL
   */
  const resetParams = useCallback(() => {
    // 清除防抖定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // ✅ 立即更新本地状态
    setLocalParams(defaultParams);

    // 立即更新URL (重置操作不需要防抖)
    replaceURL(defaultParams);
  }, [defaultParams, replaceURL]);

  /**
   * 构建查询字符串 (不包含"?")
   */
  const buildQueryStringFn = useCallback(
    (overrides?: Partial<T>): string => {
      const params = overrides
        ? mergeParams(latestParamsRef.current, overrides)
        : latestParamsRef.current;

      return buildQueryString(params, configs, { includeDefaults: false });
    },
    [configs]
  );

  // 清理防抖定时器
  useEffect(
    () => () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    },
    []
  );

  return {
    params: localParams, // ✅ 返回本地状态,确保UI即时响应
    setParam,
    updateParams,
    resetParams,
    buildQueryString: buildQueryStringFn,
    isPending,
  };
}

// 导出所有类型
export * from './types';
export {
  parseSchema,
  parseFromUrl,
  validateParams,
  getDefaultParams,
} from './schema-parser';
export {
  serializeToUrlParams,
  buildQueryString,
  buildFullUrl,
  mergeParams,
  areParamsEqual,
  parseQueryString,
} from './url-builder';
