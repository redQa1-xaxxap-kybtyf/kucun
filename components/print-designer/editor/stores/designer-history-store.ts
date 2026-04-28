/**
 * 打印设计器 - 历史记录（撤销/重做）
 *
 * 使用 zundo 为设计器提供撤销/重做（仅跟踪 template 变化）
 */

import { temporal } from 'zundo';
import { create, useStore } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import {
  arrangeElements,
  type ElementArrangementMode,
} from '@/lib/print-designer/element-arrangement';
import type {
  DesignElement,
  PageSettings,
  PrintTemplate,
} from '@/lib/print-designer/schemas';

// ============================================================================
// 状态类型定义
// ============================================================================

interface DesignerState {
  template: PrintTemplate | null;
  selectedElementId: string | null;
  selectedElementIds: string[];
  hoveredElementId: string | null;
  zoom: number;
  isDragging: boolean;
  isPreviewing: boolean;
  clipboard: DesignElement | null;
}

interface DesignerActions {
  setTemplate: (template: PrintTemplate) => void;
  updateTemplate: (
    updates: Partial<Pick<PrintTemplate, 'name' | 'type' | 'description'>>
  ) => void;
  updatePageSettings: (settings: Partial<PageSettings>) => void;
  addElement: (element: DesignElement) => void;
  addElements: (elements: DesignElement[]) => void;
  updateElement: (id: string, updates: Partial<DesignElement>) => void;
  updateElements: (
    updates: Array<{ id: string; updates: Partial<DesignElement> }>
  ) => void;
  removeElement: (id: string) => void;
  removeSelectedElements: () => void;
  duplicateElement: (id: string) => void;
  duplicateSelectedElements: () => void;
  selectElements: (ids: string[], primaryId?: string | null) => void;
  selectElement: (
    id: string | null,
    options?: { additive?: boolean }
  ) => void;
  setHoveredElement: (id: string | null) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  setZoom: (zoom: number) => void;
  setDragging: (isDragging: boolean) => void;
  setPreviewing: (isPreviewing: boolean) => void;
  copyElement: (id: string) => void;
  pasteElement: () => void;
  nudgeSelectedElements: (dx: number, dy: number) => void;
  moveElements: (options: {
    ids?: string[];
    startPositions: Record<string, { x: number; y: number }>;
    delta: { dx: number; dy: number };
    bounds?: { width: number; height: number };
  }) => void;
  arrangeSelectedElements: (mode: ElementArrangementMode) => void;
  reset: () => void;
}

type DesignerStore = DesignerState & DesignerActions;

// ============================================================================
// 初始状态
// ============================================================================

const initialState: DesignerState = {
  template: null,
  selectedElementId: null,
  selectedElementIds: [],
  hoveredElementId: null,
  zoom: 1,
  isDragging: false,
  isPreviewing: false,
  clipboard: null,
};

function clampValue(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// ============================================================================
// Store 创建 (带历史记录)
// ============================================================================

export const useDesignerStore = create<DesignerStore>()(
  temporal(
    immer((set, get) => ({
      ...initialState,

      setTemplate: (template: PrintTemplate) => {
        set({ template, selectedElementId: null, selectedElementIds: [] });
      },

      updateTemplate: (
        updates: Partial<Pick<PrintTemplate, 'name' | 'type' | 'description'>>
      ) => {
        set((state: DesignerStore) => {
          if (!state.template) return;
          Object.assign(state.template, updates);
        });
      },

      updatePageSettings: (settings: Partial<PageSettings>) => {
        set((state: DesignerStore) => {
          if (state.template) {
            Object.assign(state.template.pageSettings, settings);
          }
        });
      },

      addElement: (element: DesignElement) => {
        set((state: DesignerStore) => {
          if (state.template) {
            state.template.elements.push(element);
            state.selectedElementId = element.id;
            state.selectedElementIds = [element.id];
          }
        });
      },

      addElements: (elements: DesignElement[]) => {
        if (elements.length === 0) return;

        set((state: DesignerStore) => {
          if (state.template) {
            state.template.elements.push(...elements);
            state.selectedElementId = elements[elements.length - 1]?.id ?? null;
            state.selectedElementIds = state.selectedElementId
              ? [state.selectedElementId]
              : [];
          }
        });
      },

      updateElement: (id: string, updates: Partial<DesignElement>) => {
        set((state: DesignerStore) => {
          if (!state.template) return;
          const element = state.template.elements.find(el => el.id === id);
          if (element) {
            Object.assign(element, updates);
          }
        });
      },

      updateElements: (
        updates: Array<{ id: string; updates: Partial<DesignElement> }>
      ) => {
        if (updates.length === 0) return;

        set((state: DesignerStore) => {
          if (!state.template) return;

          updates.forEach(({ id, updates: nextUpdates }) => {
            const element = state.template?.elements.find(el => el.id === id);
            if (element) {
              Object.assign(element, nextUpdates);
            }
          });
        });
      },

      removeElement: (id: string) => {
        set((state: DesignerStore) => {
          if (!state.template) return;
          state.template.elements = state.template.elements.filter(
            el => el.id !== id
          );
          state.selectedElementIds = state.selectedElementIds.filter(
            selectedId => selectedId !== id
          );
          state.selectedElementId = state.selectedElementIds.includes(
            state.selectedElementId ?? ''
          )
            ? state.selectedElementId
            : state.selectedElementIds[state.selectedElementIds.length - 1] ??
              null;
        });
      },

      removeSelectedElements: () => {
        set((state: DesignerStore) => {
          if (!state.template || state.selectedElementIds.length === 0) return;

          const selectedIds = new Set(state.selectedElementIds);
          state.template.elements = state.template.elements.filter(
            element => !selectedIds.has(element.id)
          );
          state.selectedElementId = null;
          state.selectedElementIds = [];
        });
      },

      duplicateElement: (id: string) => {
        const state = get();
        if (!state.template) return;

        const element = state.template.elements.find(el => el.id === id);
        if (!element) return;

        const newElement: DesignElement = {
          ...JSON.parse(JSON.stringify(element)),
          id: crypto.randomUUID(),
          position: {
            x: element.position.x + 5,
            y: element.position.y + 5,
          },
        };

        set((s: DesignerStore) => {
          if (s.template) {
            s.template.elements.push(newElement);
            s.selectedElementId = newElement.id;
            s.selectedElementIds = [newElement.id];
          }
        });
      },

      duplicateSelectedElements: () => {
        const state = get();
        if (!state.template || state.selectedElementIds.length === 0) return;

        const selectedIds = new Set(state.selectedElementIds);
        const selectedElements = state.template.elements.filter(element =>
          selectedIds.has(element.id)
        );

        if (selectedElements.length === 0) return;

        const duplicatedElements = selectedElements.map(element => ({
          ...JSON.parse(JSON.stringify(element)),
          id: crypto.randomUUID(),
          position: {
            x: element.position.x + 5,
            y: element.position.y + 5,
          },
        })) as DesignElement[];

        set((s: DesignerStore) => {
          if (!s.template) return;
          s.template.elements.push(...duplicatedElements);
          s.selectedElementId =
            duplicatedElements[duplicatedElements.length - 1]?.id ?? null;
          s.selectedElementIds = duplicatedElements.map(element => element.id);
        });
      },

      selectElements: (ids: string[], primaryId?: string | null) => {
        set((state: DesignerStore) => {
          const uniqueIds = Array.from(
            new Set(ids.map(id => id?.trim()).filter(Boolean))
          );

          state.selectedElementIds = uniqueIds;
          state.selectedElementId =
            primaryId && uniqueIds.includes(primaryId)
              ? primaryId
              : uniqueIds[uniqueIds.length - 1] ?? null;
        });
      },

      selectElement: (id: string | null, options?: { additive?: boolean }) => {
        set((state: DesignerStore) => {
          if (!id) {
            state.selectedElementId = null;
            state.selectedElementIds = [];
            return;
          }

          if (!options?.additive) {
            state.selectedElementId = id;
            state.selectedElementIds = [id];
            return;
          }

          const alreadySelected = state.selectedElementIds.includes(id);
          if (alreadySelected) {
            state.selectedElementIds = state.selectedElementIds.filter(
              selectedId => selectedId !== id
            );
            state.selectedElementId =
              state.selectedElementIds[state.selectedElementIds.length - 1] ??
              null;
            return;
          }

          state.selectedElementIds = [...state.selectedElementIds, id];
          state.selectedElementId = id;
        });
      },

      setHoveredElement: (id: string | null) => {
        set({ hoveredElementId: id });
      },

      bringToFront: (id: string) => {
        set((state: DesignerStore) => {
          if (!state.template) return;
          const maxZ = Math.max(
            ...state.template.elements.map(el => el.zIndex)
          );
          const element = state.template.elements.find(el => el.id === id);
          if (element) {
            element.zIndex = maxZ + 1;
          }
        });
      },

      sendToBack: (id: string) => {
        set((state: DesignerStore) => {
          if (!state.template) return;
          const minZ = Math.min(
            ...state.template.elements.map(el => el.zIndex)
          );
          const element = state.template.elements.find(el => el.id === id);
          if (element) {
            element.zIndex = minZ - 1;
          }
        });
      },

      setZoom: (zoom: number) => {
        set({ zoom: Math.max(0.25, Math.min(4, zoom)) });
      },

      setDragging: (isDragging: boolean) => {
        set({ isDragging });
      },

      setPreviewing: (isPreviewing: boolean) => {
        set({ isPreviewing });
      },

      copyElement: (id: string) => {
        const state = get();
        if (!state.template) return;

        const element = state.template.elements.find(el => el.id === id);
        if (element) {
          set({ clipboard: JSON.parse(JSON.stringify(element)) });
        }
      },

      pasteElement: () => {
        const state = get();
        if (!state.clipboard || !state.template) return;

        const newElement: DesignElement = {
          ...JSON.parse(JSON.stringify(state.clipboard)),
          id: crypto.randomUUID(),
          position: {
            x: state.clipboard.position.x + 10,
            y: state.clipboard.position.y + 10,
          },
        };

        set((s: DesignerStore) => {
          if (s.template) {
            s.template.elements.push(newElement);
            s.selectedElementId = newElement.id;
            s.selectedElementIds = [newElement.id];
          }
        });
      },

      nudgeSelectedElements: (dx: number, dy: number) => {
        set((state: DesignerStore) => {
          if (!state.template || state.selectedElementIds.length === 0) return;

          const selectedIds = new Set(state.selectedElementIds);
          state.template.elements.forEach(element => {
            if (!selectedIds.has(element.id) || element.locked) {
              return;
            }

            element.position = {
              x: Math.max(0, element.position.x + dx),
              y: Math.max(0, element.position.y + dy),
            };
          });
        });
      },

      moveElements: ({ ids, startPositions, delta, bounds }) => {
        set((state: DesignerStore) => {
          if (!state.template) return;

          const targetIds = ids?.length
            ? ids
            : Object.keys(startPositions).filter(Boolean);
          if (targetIds.length === 0) return;

          const targetIdSet = new Set(targetIds);
          const elementsToMove = state.template.elements.filter(
            element =>
              targetIdSet.has(element.id) &&
              startPositions[element.id] !== undefined &&
              !element.locked
          );

          if (elementsToMove.length === 0) return;

          let nextDx = delta.dx;
          let nextDy = delta.dy;

          if (bounds) {
            const minX = Math.min(
              ...elementsToMove.map(element => startPositions[element.id]!.x)
            );
            const minY = Math.min(
              ...elementsToMove.map(element => startPositions[element.id]!.y)
            );
            const maxRight = Math.max(
              ...elementsToMove.map(
                element =>
                  startPositions[element.id]!.x + element.size.width
              )
            );
            const maxBottom = Math.max(
              ...elementsToMove.map(
                element =>
                  startPositions[element.id]!.y + element.size.height
              )
            );

            nextDx = clampValue(nextDx, -minX, bounds.width - maxRight);
            nextDy = clampValue(nextDy, -minY, bounds.height - maxBottom);
          }

          elementsToMove.forEach(element => {
            const startPosition = startPositions[element.id];
            if (!startPosition) return;

            element.position = {
              x: Math.max(0, startPosition.x + nextDx),
              y: Math.max(0, startPosition.y + nextDy),
            };
          });
        });
      },

      arrangeSelectedElements: (mode: ElementArrangementMode) => {
        set((state: DesignerStore) => {
          if (!state.template || state.selectedElementIds.length < 2) return;

          const selectedIds = new Set(state.selectedElementIds);
          const selectedElements = state.template.elements.filter(element =>
            selectedIds.has(element.id) && !element.locked
          );
          if (selectedElements.length < 2) return;

          const arrangedUpdates = arrangeElements(
            selectedElements,
            mode,
            selectedElements.some(
              element => element.id === state.selectedElementId
            )
              ? state.selectedElementId
              : selectedElements[selectedElements.length - 1]?.id
          );

          arrangedUpdates.forEach(({ id, updates }) => {
            const element = state.template?.elements.find(item => item.id === id);
            if (!element) return;
            Object.assign(element, updates);
          });
        });
      },

      reset: () => {
        set(initialState);
      },
    })),
    {
      // 只跟踪模板数据变化
      partialize: state => ({ template: state.template }),
      // template 未变化时不记录历史（避免选中/缩放等 UI 操作污染撤销栈）
      equality: (pastState, currentState) =>
        pastState.template === currentState.template,
      // 限制历史记录数量
      limit: 50,
    }
  )
);

// ============================================================================
// 历史记录 Hooks
// ============================================================================

export function useUndo() {
  return useStore(useDesignerStore.temporal, s => s.undo);
}

export function useRedo() {
  return useStore(useDesignerStore.temporal, s => s.redo);
}

export function useClearHistory() {
  return useStore(useDesignerStore.temporal, s => s.clear);
}

export function useCanUndo() {
  return useStore(useDesignerStore.temporal, s => s.pastStates.length > 0);
}

export function useCanRedo() {
  return useStore(useDesignerStore.temporal, s => s.futureStates.length > 0);
}

// ============================================================================
// 选择器 (Selectors)
// ============================================================================

// 稳定的空数组引用，避免每次返回新引用导致无限循环
const EMPTY_ELEMENTS: DesignElement[] = [];

/** 获取当前选中的元素 */
export const useSelectedElement = (): DesignElement | null | undefined =>
  useDesignerStore((state: DesignerStore) => {
    if (!state.template || !state.selectedElementId) return null;
    return state.template.elements.find(
      el => el.id === state.selectedElementId
    );
  });

/** 获取所有元素 */
export const useElements = (): DesignElement[] =>
  useDesignerStore(
    (state: DesignerStore) => state.template?.elements ?? EMPTY_ELEMENTS
  );

/** 获取当前多选元素 */
export const useSelectedElements = (): DesignElement[] =>
  useDesignerStore((state: DesignerStore) => {
    if (!state.template || state.selectedElementIds.length === 0) {
      return EMPTY_ELEMENTS;
    }

    const selectedIds = new Set(state.selectedElementIds);
    return state.template.elements.filter(element => selectedIds.has(element.id));
  });

/** 获取页面设置 */
export const usePageSettings = (): PageSettings | undefined =>
  useDesignerStore((state: DesignerStore) => state.template?.pageSettings);

// 兼容旧命名：历史版本曾导出 useDesignerStoreWithHistory
export const useDesignerStoreWithHistory = useDesignerStore;
