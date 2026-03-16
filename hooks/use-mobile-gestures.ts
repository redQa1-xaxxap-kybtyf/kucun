'use client';

import { useRef, useCallback, useEffect } from 'react';

/**
 * 手势类型定义
 */
export type GestureType = 'swipe' | 'tap' | 'longPress' | 'pinch';
export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

/**
 * 手势配置选项
 */
interface GestureOptions {
  /** 滑动最小距离 */
  swipeThreshold?: number;
  /** 长按时间阈值 */
  longPressDelay?: number;
  /** 点击时间阈值 */
  tapDelay?: number;
  /** 缩放阈值 */
  pinchThreshold?: number;
  /** 是否阻止默认行为 */
  preventDefault?: boolean;
}

/**
 * 手势事件数据
 */
interface GestureEvent {
  type: GestureType;
  direction?: SwipeDirection;
  distance?: number;
  scale?: number;
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
  duration?: number;
}

/**
 * 手势回调函数类型
 */
interface GestureCallbacks {
  onSwipe?: (event: GestureEvent) => void;
  onTap?: (event: GestureEvent) => void;
  onLongPress?: (event: GestureEvent) => void;
  onPinch?: (event: GestureEvent) => void;
}

/**
 * 移动端手势Hook
 * 提供滑动、点击、长按、缩放等手势识别功能
 *
 * 内存管理优化:
 * - 组件卸载时自动清理所有定时器
 * - 组件卸载时自动移除所有事件监听器
 * - 使用ref存储清理函数，确保正确清理
 */
export function useMobileGestures(
  callbacks: GestureCallbacks,
  options: GestureOptions = {}
) {
  const {
    swipeThreshold = 50,
    longPressDelay = 500,
    tapDelay = 300,
    pinchThreshold = 0.1,
    preventDefault = false,
  } = options;

  const touchStartRef = useRef<{
    x: number;
    y: number;
    time: number;
    touches: number;
  } | null>(null);

  const touchEndRef = useRef<{
    x: number;
    y: number;
    time: number;
  } | null>(null);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialDistanceRef = useRef<number>(0);

  // 存储当前绑定的元素和清理函数
  const boundElementRef = useRef<HTMLElement | null>(null);
  const cleanupFnRef = useRef<(() => void) | null>(null);

  // 计算两点间距离
  const getDistance = useCallback((touch1: Touch, touch2: Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // 获取滑动方向
  const getSwipeDirection = useCallback(
    (
      startX: number,
      startY: number,
      endX: number,
      endY: number
    ): SwipeDirection => {
      const deltaX = endX - startX;
      const deltaY = endY - startY;

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        return deltaX > 0 ? 'right' : 'left';
      } else {
        return deltaY > 0 ? 'down' : 'up';
      }
    },
    []
  );

  // 触摸开始处理
  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      if (preventDefault) {
        event.preventDefault();
      }

      const touch = event.touches[0];
      const now = Date.now();

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: now,
        touches: event.touches.length,
      };

      // 多点触控时记录初始距离
      if (event.touches.length === 2) {
        initialDistanceRef.current = getDistance(
          event.touches[0],
          event.touches[1]
        );
      }

      // 设置长按定时器
      if (callbacks.onLongPress) {
        longPressTimerRef.current = setTimeout(() => {
          if (touchStartRef.current) {
            callbacks.onLongPress?.({
              type: 'longPress',
              startPoint: {
                x: touchStartRef.current.x,
                y: touchStartRef.current.y,
              },
              duration: Date.now() - touchStartRef.current.time,
            });
          }
        }, longPressDelay);
      }
    },
    [callbacks, longPressDelay, preventDefault, getDistance]
  );

  // 触摸移动处理
  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (preventDefault) {
        event.preventDefault();
      }

      // 清除长按定时器（移动时取消长按）
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      // 处理缩放手势
      if (
        event.touches.length === 2 &&
        callbacks.onPinch &&
        initialDistanceRef.current > 0
      ) {
        const currentDistance = getDistance(event.touches[0], event.touches[1]);
        const scale = currentDistance / initialDistanceRef.current;

        if (Math.abs(scale - 1) > pinchThreshold) {
          callbacks.onPinch({
            type: 'pinch',
            scale,
          });
        }
      }
    },
    [callbacks, preventDefault, getDistance, pinchThreshold]
  );

  // 触摸结束处理
  const handleTouchEnd = useCallback(
    (event: TouchEvent) => {
      if (preventDefault) {
        event.preventDefault();
      }

      // 清除长按定时器
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      const touchStart = touchStartRef.current;
      if (!touchStart) {
        return;
      }

      const touch = event.changedTouches[0];
      const now = Date.now();

      touchEndRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: now,
      };

      const deltaX = touch.clientX - touchStart.x;
      const deltaY = touch.clientY - touchStart.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const duration = now - touchStart.time;

      // 判断手势类型
      if (distance > swipeThreshold) {
        // 滑动手势
        if (callbacks.onSwipe) {
          const direction = getSwipeDirection(
            touchStart.x,
            touchStart.y,
            touch.clientX,
            touch.clientY
          );
          callbacks.onSwipe({
            type: 'swipe',
            direction,
            distance,
            startPoint: { x: touchStart.x, y: touchStart.y },
            endPoint: { x: touch.clientX, y: touch.clientY },
            duration,
          });
        }
      } else if (duration < tapDelay) {
        // 点击手势
        if (callbacks.onTap) {
          callbacks.onTap({
            type: 'tap',
            startPoint: { x: touchStart.x, y: touchStart.y },
            endPoint: { x: touch.clientX, y: touch.clientY },
            duration,
          });
        }
      }

      // 重置状态
      touchStartRef.current = null;
      touchEndRef.current = null;
      initialDistanceRef.current = 0;
    },
    [callbacks, swipeThreshold, tapDelay, preventDefault, getSwipeDirection]
  );

  /**
   * 清理所有事件监听器
   * SOLID-S: 单一职责 - 专门负责清理资源
   */
  const cleanupEventListeners = useCallback(() => {
    if (cleanupFnRef.current) {
      cleanupFnRef.current();
      cleanupFnRef.current = null;
    }
    boundElementRef.current = null;
  }, []);

  /**
   * 绑定事件监听器
   * 改进: 自动管理清理函数，防止内存泄漏
   */
  const bindGestures = useCallback(
    (element: HTMLElement | null) => {
      // 清理之前绑定的元素
      cleanupEventListeners();

      if (!element) {
        return;
      }

      // 绑定新的事件监听器
      element.addEventListener('touchstart', handleTouchStart, {
        passive: !preventDefault,
      });
      element.addEventListener('touchmove', handleTouchMove, {
        passive: !preventDefault,
      });
      element.addEventListener('touchend', handleTouchEnd, {
        passive: !preventDefault,
      });

      // 保存清理函数
      const cleanup = () => {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchmove', handleTouchMove);
        element.removeEventListener('touchend', handleTouchEnd);
      };

      cleanupFnRef.current = cleanup;
      boundElementRef.current = element;

      // 返回清理函数供手动调用（可选）
      return cleanup;
    },
    [
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      preventDefault,
      cleanupEventListeners,
    ]
  );

  /**
   * 组件卸载时的清理函数
   * 确保所有资源都被正确释放：
   * 1. 清理长按定时器
   * 2. 移除所有事件监听器
   * 3. 重置所有ref状态
   */
  useEffect(() => () => {
      // 清理定时器
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      // 清理事件监听器
      cleanupEventListeners();

      // 重置状态
      touchStartRef.current = null;
      touchEndRef.current = null;
      initialDistanceRef.current = 0;
    }, [cleanupEventListeners]);

  return {
    bindGestures,
    touchStart: touchStartRef.current,
    touchEnd: touchEndRef.current,
  };
}

/**
 * 滑动手势Hook
 * 专门用于处理滑动手势的简化版本
 */
export function useSwipeGesture(
  onSwipe: (direction: SwipeDirection, distance: number) => void,
  threshold: number = 50
) {
  return useMobileGestures(
    {
      onSwipe: event => {
        if (event.direction && event.distance) {
          onSwipe(event.direction, event.distance);
        }
      },
    },
    {
      swipeThreshold: threshold,
    }
  );
}

/**
 * 长按手势Hook
 * 专门用于处理长按手势的简化版本
 */
export function useLongPressGesture(
  onLongPress: () => void,
  delay: number = 500
) {
  return useMobileGestures(
    {
      onLongPress: () => onLongPress(),
    },
    {
      longPressDelay: delay,
    }
  );
}

/**
 * 点击手势Hook
 * 专门用于处理点击手势的简化版本
 */
export function useTapGesture(
  onTap: (point: { x: number; y: number }) => void
) {
  return useMobileGestures({
    onTap: event => {
      if (event.startPoint) {
        onTap(event.startPoint);
      }
    },
  });
}

/**
 * 缩放手势Hook
 * 专门用于处理缩放手势的简化版本
 */
export function usePinchGesture(
  onPinch: (scale: number) => void,
  threshold: number = 0.1
) {
  return useMobileGestures(
    {
      onPinch: event => {
        if (event.scale) {
          onPinch(event.scale);
        }
      },
    },
    {
      pinchThreshold: threshold,
    }
  );
}
