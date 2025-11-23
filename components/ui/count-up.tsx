'use client';

import * as React from 'react';

interface CountUpProps {
  end: number;
  start?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  separator?: string;
}

/**
 * 数字滚动组件
 * 使用 requestAnimationFrame 实现平滑滚动
 */
export function CountUp({
  end,
  start = 0,
  duration = 1000,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  separator = ',',
}: CountUpProps) {
  const [value, setValue] = React.useState(start);
  const startTimeRef = React.useRef<number | null>(null);
  const requestRef = React.useRef<number | null>(null);
  const startValueRef = React.useRef(start);
  const endValueRef = React.useRef(end);

  const valueRef = React.useRef(value);
  valueRef.current = value;

  // 当目标值变化时，重置动画
  React.useEffect(() => {
    startValueRef.current = valueRef.current;
    endValueRef.current = end;
    startTimeRef.current = null;

    const animate = (time: number) => {
      if (!startTimeRef.current) startTimeRef.current = time;
      const progress = time - startTimeRef.current;
      const percentage = Math.min(progress / duration, 1);

      // Easing function: easeOutQuart
      const ease = 1 - Math.pow(1 - percentage, 4);

      const current =
        startValueRef.current +
        (endValueRef.current - startValueRef.current) * ease;
      setValue(current);

      if (progress < duration) {
        requestRef.current = requestAnimationFrame(animate);
      }
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [end, duration]);

  const formattedValue = React.useMemo(() => {
    const fixed = value.toFixed(decimals);
    const [int, dec] = fixed.split('.');
    const formattedInt = int.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    return `${prefix}${formattedInt}${dec ? `.${dec}` : ''}${suffix}`;
  }, [value, decimals, prefix, suffix, separator]);

  return <span className={className}>{formattedValue}</span>;
}
