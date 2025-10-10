'use client';

import React from 'react';

interface PerformanceMonitorProps {
  componentName: string;
  enabled?: boolean;
}

/**
 * 性能监控组件
 * 用于调试组件渲染性能
 */
export function PerformanceMonitor({
  componentName,
  enabled = process.env.NODE_ENV === 'development',
}: PerformanceMonitorProps) {
  const renderCount = React.useRef(0);
  const lastRenderTime = React.useRef(Date.now());
  const renderTimes = React.useRef<number[]>([]);

  React.useEffect(() => {
    if (!enabled) return;

    renderCount.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;

    renderTimes.current.push(timeSinceLastRender);
    if (renderTimes.current.length > 10) {
      renderTimes.current.shift();
    }

    const avgRenderTime =
      renderTimes.current.reduce((a, b) => a + b, 0) /
      renderTimes.current.length;

    console.log(
      `[性能监控] ${componentName}:`,
      `\n  渲染次数: ${renderCount.current}`,
      `\n  距上次渲染: ${timeSinceLastRender}ms`,
      `\n  平均间隔: ${avgRenderTime.toFixed(2)}ms`
    );

    // 警告：渲染过于频繁
    if (timeSinceLastRender < 50 && renderCount.current > 5) {
      console.warn(
        `⚠️ ${componentName} 渲染过于频繁！间隔仅 ${timeSinceLastRender}ms`
      );
    }
  });

  return null;
}

/**
 * 输入性能监控 Hook
 * 监控输入延迟
 */
export function useInputPerformance(componentName: string) {
  const inputStartTime = React.useRef<number>(0);
  const inputDelays = React.useRef<number[]>([]);

  const onInputStart = React.useCallback(() => {
    inputStartTime.current = performance.now();
  }, []);

  const onInputEnd = React.useCallback(() => {
    if (inputStartTime.current === 0) return;

    const delay = performance.now() - inputStartTime.current;
    inputDelays.current.push(delay);

    if (inputDelays.current.length > 20) {
      inputDelays.current.shift();
    }

    const avgDelay =
      inputDelays.current.reduce((a, b) => a + b, 0) /
      inputDelays.current.length;

    console.log(
      `[输入性能] ${componentName}:`,
      `\n  本次延迟: ${delay.toFixed(2)}ms`,
      `\n  平均延迟: ${avgDelay.toFixed(2)}ms`
    );

    if (delay > 50) {
      console.warn(
        `⚠️ ${componentName} 输入延迟过高: ${delay.toFixed(2)}ms (建议 < 50ms)`
      );
    }

    inputStartTime.current = 0;
  }, [componentName]);

  return { onInputStart, onInputEnd };
}

/**
 * 渲染原因追踪 Hook
 * 帮助找出导致重渲染的原因
 */
export function useWhyDidYouUpdate(
  componentName: string,
  props: Record<string, unknown>
) {
  const previousProps = React.useRef<Record<string, unknown>>();

  React.useEffect(() => {
    if (previousProps.current) {
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      const changedProps: Record<string, { from: unknown; to: unknown }> = {};

      allKeys.forEach(key => {
        if (previousProps.current![key] !== props[key]) {
          changedProps[key] = {
            from: previousProps.current![key],
            to: props[key],
          };
        }
      });

      if (Object.keys(changedProps).length > 0) {
        console.log(`[重渲染原因] ${componentName}:`, changedProps);
      }
    }

    previousProps.current = props;
  });
}

