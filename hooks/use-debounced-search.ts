/**
 * 防抖搜索Hook
 * 提供搜索输入防抖功能，减少API调用频率，提升用户体验
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseDebouncedSearchOptions {
  /** 防抖延迟时间（毫秒），默认400ms */
  delay?: number;
  /** 最小搜索长度，默认0 */
  minLength?: number;
  /** 是否在组件卸载时取消防抖 */
  cancelOnUnmount?: boolean;
}

interface UseDebouncedSearchReturn {
  /** 当前输入值 */
  inputValue: string;
  /** 防抖后的搜索值 */
  debouncedValue: string;
  /** 是否正在防抖中 */
  isDebouncing: boolean;
  /** 设置输入值 */
  setInputValue: (value: string) => void;
  /** 立即触发搜索（跳过防抖） */
  triggerSearch: () => void;
  /** 清空搜索 */
  clearSearch: () => void;
}

/**
 * 防抖搜索Hook
 *
 * @example
 * ```tsx
 * const { inputValue, debouncedValue, isDebouncing, setInputValue } = useDebouncedSearch({
 *   delay: 400,
 *   minLength: 1
 * });
 *
 * // 监听防抖后的值变化
 * useEffect(() => {
 *   if (debouncedValue) {
 *     performSearch(debouncedValue);
 *   }
 * }, [debouncedValue]);
 * ```
 */
export function useDebouncedSearch(
  options: UseDebouncedSearchOptions = {}
): UseDebouncedSearchReturn {
  const { delay = 400, minLength = 0, cancelOnUnmount = true } = options;

  const [inputValue, setInputValue] = useState('');
  const [debouncedValue, setDebouncedValue] = useState('');
  const [isDebouncing, setIsDebouncing] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // 清理定时器
  const clearDebounceTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // 立即触发搜索
  const triggerSearch = useCallback(() => {
    clearDebounceTimeout();
    setIsDebouncing(false);
    setDebouncedValue(inputValue);
  }, [inputValue, clearDebounceTimeout]);

  // 清空搜索
  const clearSearch = useCallback(() => {
    clearDebounceTimeout();
    setInputValue('');
    setDebouncedValue('');
    setIsDebouncing(false);
  }, [clearDebounceTimeout]);

  // 防抖逻辑
  useEffect(() => {
    // 如果输入值长度小于最小长度，直接清空防抖值
    if (inputValue.length < minLength) {
      clearDebounceTimeout();
      setIsDebouncing(false);
      setDebouncedValue('');
      return;
    }

    // 如果输入值与防抖值相同，不需要防抖
    if (inputValue === debouncedValue) {
      setIsDebouncing(false);
      return;
    }

    setIsDebouncing(true);

    timeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setDebouncedValue(inputValue);
        setIsDebouncing(false);
      }
    }, delay);

    return () => {
      clearDebounceTimeout();
    };
  }, [inputValue, debouncedValue, delay, minLength, clearDebounceTimeout]);

  // 组件卸载时清理
  useEffect(
    () => () => {
      mountedRef.current = false;
      if (cancelOnUnmount) {
        clearDebounceTimeout();
      }
    },
    [cancelOnUnmount, clearDebounceTimeout]
  );

  return {
    inputValue,
    debouncedValue,
    isDebouncing,
    setInputValue,
    triggerSearch,
    clearSearch,
  };
}

/**
 * 简化版防抖Hook，只返回防抖后的值
 *
 * @param value 输入值
 * @param delay 防抖延迟时间
 * @returns 防抖后的值
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 防抖回调Hook
 *
 * @param callback 回调函数
 * @param delay 防抖延迟时间
 * @param deps 依赖数组
 * @returns 防抖后的回调函数
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay, ...deps]
  ) as T;

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  return debouncedCallback;
}
