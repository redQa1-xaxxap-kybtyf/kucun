'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 键盘导航配置选项
 */
interface KeyboardNavigationOptions {
  /** 是否启用键盘导航 */
  enabled?: boolean;
  /** 循环导航（到达末尾后回到开头） */
  loop?: boolean;
  /** 自定义键盘事件处理 */
  onKeyDown?: (event: KeyboardEvent, focusedIndex: number) => boolean;
  /** 焦点变化回调 */
  onFocusChange?: (index: number) => void;
  /** 选择项回调 */
  onSelect?: (index: number) => void;
}

/**
 * 键盘导航Hook
 * 提供方向键导航、回车选择等功能
 *
 * @param itemCount - 导航项总数
 * @param options - 配置选项
 * @returns 键盘导航状态和方法
 */
export function useKeyboardNavigation(
  itemCount: number,
  options: KeyboardNavigationOptions = {}
) {
  const {
    enabled = true,
    loop = true,
    onKeyDown,
    onFocusChange,
    onSelect,
  } = options;

  const [focusedIndex, setFocusedIndex] = useState(-1);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  // 设置焦点到指定索引
  const setFocus = (index: number) => {
    if (index >= 0 && index < itemCount) {
      setFocusedIndex(index);
      onFocusChange?.(index);

      // 滚动到可见区域
      const element = itemRefs.current[index];
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  };

  // 移动焦点
  const moveFocus = (direction: 'up' | 'down' | 'first' | 'last') => {
    if (itemCount === 0) {
      return;
    }

    let newIndex = focusedIndex;

    switch (direction) {
      case 'up':
        newIndex =
          focusedIndex <= 0 ? (loop ? itemCount - 1 : 0) : focusedIndex - 1;
        break;
      case 'down':
        newIndex =
          focusedIndex >= itemCount - 1
            ? loop
              ? 0
              : itemCount - 1
            : focusedIndex + 1;
        break;
      case 'first':
        newIndex = 0;
        break;
      case 'last':
        newIndex = itemCount - 1;
        break;
    }

    setFocus(newIndex);
  };

  // 选择当前焦点项
  const selectFocused = () => {
    if (focusedIndex >= 0 && focusedIndex < itemCount) {
      onSelect?.(focusedIndex);
    }
  };

  // 清除焦点
  const clearFocus = () => {
    setFocusedIndex(-1);
  };

  // 键盘事件处理
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // 如果有自定义处理器且返回true，则跳过默认处理
      if (onKeyDown?.(event, focusedIndex)) {
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          moveFocus('down');
          break;
        case 'ArrowUp':
          event.preventDefault();
          moveFocus('up');
          break;
        case 'Home':
          event.preventDefault();
          moveFocus('first');
          break;
        case 'End':
          event.preventDefault();
          moveFocus('last');
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          selectFocused();
          break;
        case 'Escape':
          event.preventDefault();
          clearFocus();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, focusedIndex, itemCount, loop, onKeyDown, onSelect]);

  // 重置焦点当项目数量变化时
  useEffect(() => {
    if (focusedIndex >= itemCount) {
      setFocusedIndex(itemCount > 0 ? itemCount - 1 : -1);
    }
  }, [itemCount, focusedIndex]);

  return {
    /** 当前焦点索引 */
    focusedIndex,
    /** 设置焦点 */
    setFocus,
    /** 移动焦点 */
    moveFocus,
    /** 选择当前项 */
    selectFocused,
    /** 清除焦点 */
    clearFocus,
    /** 项目引用数组 */
    itemRefs,
  };
}

/**
 * 列表键盘导航Hook
 * 专门用于列表组件的键盘导航
 *
 * @param items - 列表项数组
 * @param onSelect - 选择回调
 * @param options - 配置选项
 */
export function useListKeyboardNavigation<T>(
  items: T[],
  onSelect: (item: T, index: number) => void,
  options: Omit<KeyboardNavigationOptions, 'onSelect'> = {}
) {
  const navigation = useKeyboardNavigation(items.length, {
    ...options,
    onSelect: index => {
      const item = items[index];
      if (item) {
        onSelect(item, index);
      }
    },
  });

  return {
    ...navigation,
    /** 当前焦点项 */
    focusedItem:
      navigation.focusedIndex >= 0 ? items[navigation.focusedIndex] : null,
  };
}

/**
 * 菜单键盘导航Hook
 * 专门用于菜单组件的键盘导航，支持子菜单
 */
export function useMenuKeyboardNavigation(
  menuItems: Array<{ disabled?: boolean; children?: unknown[] }>,
  options: KeyboardNavigationOptions = {}
) {
  // 过滤掉禁用的项目
  const enabledItems = menuItems.filter(item => !item.disabled);

  return useKeyboardNavigation(enabledItems.length, {
    ...options,
    onKeyDown: (event, focusedIndex) => {
      // 自定义菜单键盘处理
      if (event.key === 'ArrowRight') {
        const item = enabledItems[focusedIndex];
        if (item?.children?.length) {
          // 展开子菜单
          event.preventDefault();
          return true;
        }
      }

      if (event.key === 'ArrowLeft') {
        // 关闭子菜单或返回上级
        event.preventDefault();
        return true;
      }

      // 调用用户自定义处理器
      return options.onKeyDown?.(event, focusedIndex) || false;
    },
  });
}
