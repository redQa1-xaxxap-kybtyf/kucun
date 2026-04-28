/**
 * 打印设计器 - 键盘快捷键 Hook
 *
 * 实现文档中定义的所有快捷键
 */

'use client';

import { useEffect } from 'react';

import {
  useCanRedo,
  useCanUndo,
  useDesignerStore,
  useRedo,
  useUndo,
} from '../stores';

interface UseKeyboardShortcutsOptions {
  onSave?: () => void;
}

export function useKeyboardShortcuts({
  onSave,
}: UseKeyboardShortcutsOptions = {}) {
  const selectedElementId = useDesignerStore(s => s.selectedElementId);
  const selectedElementIds = useDesignerStore(s => s.selectedElementIds);
  const selectElement = useDesignerStore(s => s.selectElement);
  const removeSelectedElements = useDesignerStore(
    s => s.removeSelectedElements
  );
  const duplicateSelectedElements = useDesignerStore(
    s => s.duplicateSelectedElements
  );
  const copyElement = useDesignerStore(s => s.copyElement);
  const pasteElement = useDesignerStore(s => s.pasteElement);
  const nudgeSelectedElements = useDesignerStore(s => s.nudgeSelectedElements);
  const setZoom = useDesignerStore(s => s.setZoom);
  const zoom = useDesignerStore(s => s.zoom);
  const undo = useUndo();
  const redo = useRedo();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框中的按键
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const isMod = e.ctrlKey || e.metaKey;

      // Ctrl + S: 保存
      if (isMod && e.key === 's') {
        e.preventDefault();
        onSave?.();
        return;
      }

      // Ctrl + Z: 撤销 (TODO: 实现 zundo)
      if (isMod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
        return;
      }

      // Ctrl + Shift + Z: 重做 (TODO: 实现 zundo)
      if (isMod && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        if (canRedo) redo();
        return;
      }

      // Escape: 取消选中
      if (e.key === 'Escape') {
        selectElement(null);
        return;
      }

      // 以下需要选中元素
      if (selectedElementIds.length === 0) return;

      // Delete / Backspace: 删除
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeSelectedElements();
        return;
      }

      // Ctrl + C: 复制
      if (isMod && e.key === 'c' && selectedElementId) {
        e.preventDefault();
        copyElement(selectedElementId);
        return;
      }

      // Ctrl + V: 粘贴
      if (isMod && e.key === 'v') {
        e.preventDefault();
        pasteElement();
        return;
      }

      // Ctrl + D: 原位复制
      if (isMod && e.key === 'd') {
        e.preventDefault();
        duplicateSelectedElements();
        return;
      }

      // 方向键: 微移
      const step = e.shiftKey ? 10 : 1; // Shift = 10mm, 否则 1mm
      const arrowMoves: Record<string, { dx: number; dy: number }> = {
        ArrowUp: { dx: 0, dy: -step },
        ArrowDown: { dx: 0, dy: step },
        ArrowLeft: { dx: -step, dy: 0 },
        ArrowRight: { dx: step, dy: 0 },
      };

      if (arrowMoves[e.key]) {
        e.preventDefault();
        const { dx, dy } = arrowMoves[e.key];
        nudgeSelectedElements(dx, dy);
        return;
      }

      // Ctrl + = / -: 缩放
      if (isMod && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setZoom(zoom + 0.1);
        return;
      }
      if (isMod && e.key === '-') {
        e.preventDefault();
        setZoom(zoom - 0.1);
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedElementId,
    selectedElementIds,
    zoom,
    onSave,
    undo,
    redo,
    canUndo,
    canRedo,
    selectElement,
    removeSelectedElements,
    duplicateSelectedElements,
    copyElement,
    pasteElement,
    nudgeSelectedElements,
    setZoom,
  ]);
}
