/**
 * 打印设计器 - 标尺组件
 *
 * 显示 mm 刻度标尺
 */

'use client';

import { useMemo } from 'react';

import { mmToPx } from '../../renderer/utils';

interface RulerProps {
  /** 方向 */
  direction: 'horizontal' | 'vertical';
  /** 总长度 (mm) */
  length: number;
  /** 缩放比例 */
  zoom: number;
  /** 可见区域偏移 (px) - 用于虚拟滚动 */
  offset?: number;
}

export function Ruler({ direction, length, zoom, offset = 0 }: RulerProps) {
  // 计算刻度
  const ticks = useMemo(() => {
    const result: { position: number; label: string; isMajor: boolean }[] = [];

    // 根据缩放级别决定刻度间隔
    let interval = 10; // 默认每 10mm 一个主刻度
    if (zoom < 0.5) interval = 20;
    if (zoom < 0.3) interval = 50;
    if (zoom > 2) interval = 5;

    for (let mm = 0; mm <= length; mm += interval / 2) {
      const isMajor = mm % interval === 0;
      result.push({
        position: mmToPx(mm) * zoom,
        label: isMajor ? String(mm) : '',
        isMajor,
      });
    }

    return result;
  }, [length, zoom]);

  const isHorizontal = direction === 'horizontal';
  const size = mmToPx(length) * zoom;

  return (
    <div
      className="relative bg-slate-100 text-[10px] text-slate-500 select-none"
      style={{
        width: isHorizontal ? size : 20,
        height: isHorizontal ? 20 : size,
      }}
    >
      {ticks.map((tick, i) => {
        const pos = tick.position - offset;
        if (pos < -20 || pos > size + 20) return null; // 裁剪不可见区域

        return (
          <div
            key={i}
            className="absolute"
            style={
              isHorizontal
                ? {
                    left: pos,
                    bottom: 0,
                    height: tick.isMajor ? 12 : 6,
                    width: 1,
                    backgroundColor: tick.isMajor ? '#64748b' : '#94a3b8',
                  }
                : {
                    top: pos,
                    right: 0,
                    width: tick.isMajor ? 12 : 6,
                    height: 1,
                    backgroundColor: tick.isMajor ? '#64748b' : '#94a3b8',
                  }
            }
          >
            {tick.label && (
              <span
                className="absolute whitespace-nowrap"
                style={
                  isHorizontal
                    ? { left: 2, top: -10 }
                    : {
                        left: -18,
                        top: -4,
                        transform: 'rotate(-90deg)',
                        transformOrigin: 'right center',
                      }
                }
              >
                {tick.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
