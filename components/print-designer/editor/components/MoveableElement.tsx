/**
 * 打印设计器 - 可移动元素包装器
 *
 * 使用 react-moveable 提供 resize/rotate 功能
 */

'use client';

import { useEffect, useRef } from 'react';
import Moveable from 'react-moveable';

import type { DesignElement } from '@/lib/print-designer/schemas';

import { mmToPx, pxToMm } from '../../renderer/utils';
import { useDesignerStore } from '../stores';

interface MoveableElementProps {
  element: DesignElement;
  zoom: number;
  children: React.ReactNode;
}

export function MoveableElement({
  element,
  zoom,
  children,
}: MoveableElementProps) {
  const targetRef = useRef<HTMLDivElement>(null);
  const moveableRef = useRef<Moveable>(null);

  const selectedId = useDesignerStore(s => s.selectedElementId);
  const updateElement = useDesignerStore(s => s.updateElement);

  const isSelected = selectedId === element.id;

  // 当元素位置/尺寸更新时，通知 moveable
  useEffect(() => {
    if (moveableRef.current) {
      moveableRef.current.updateRect();
    }
  }, [element.position, element.size, zoom]);

  const x = mmToPx(element.position.x) * zoom;
  const y = mmToPx(element.position.y) * zoom;
  const width = mmToPx(element.size.width) * zoom;
  const height = mmToPx(element.size.height) * zoom;

  return (
    <>
      <div
        ref={targetRef}
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width,
          height,
          transform: element.rotation
            ? `rotate(${element.rotation}deg)`
            : undefined,
          transformOrigin: 'center center',
          zIndex: element.zIndex,
        }}
      >
        {children}
      </div>

      {isSelected && targetRef.current && (
        <Moveable
          ref={moveableRef}
          target={targetRef.current}
          draggable={!element.locked}
          resizable={!element.locked}
          rotatable={!element.locked}
          snappable
          origin={false}
          keepRatio={false}
          throttleDrag={0}
          throttleResize={0}
          throttleRotate={0}
          renderDirections={['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']}
          onDrag={({ beforeTranslate }) => {
            const [dx, dy] = beforeTranslate;
            const newX = pxToMm(x + dx) / zoom;
            const newY = pxToMm(y + dy) / zoom;

            updateElement(element.id, {
              position: {
                x: Math.max(0, newX),
                y: Math.max(0, newY),
              },
            });
          }}
          onResize={({ width: newWidth, height: newHeight, drag }) => {
            const newX = pxToMm(x + drag.beforeTranslate[0]) / zoom;
            const newY = pxToMm(y + drag.beforeTranslate[1]) / zoom;
            const newW = pxToMm(newWidth) / zoom;
            const newH = pxToMm(newHeight) / zoom;

            updateElement(element.id, {
              position: { x: Math.max(0, newX), y: Math.max(0, newY) },
              size: { width: Math.max(5, newW), height: Math.max(5, newH) },
            });
          }}
          onRotate={({ absoluteRotation }) => {
            updateElement(element.id, {
              rotation: absoluteRotation,
            });
          }}
        />
      )}
    </>
  );
}
