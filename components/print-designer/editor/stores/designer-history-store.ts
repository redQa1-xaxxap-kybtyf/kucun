/**
 * 打印设计器 - 历史记录（撤销/重做）
 *
 * 使用 zundo 为设计器提供撤销/重做（仅跟踪 template 变化）
 */

import { temporal } from 'zundo';
import { create, useStore } from 'zustand';
import { immer } from 'zustand/middleware/immer';

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
  updateElement: (id: string, updates: Partial<DesignElement>) => void;
  removeElement: (id: string) => void;
  duplicateElement: (id: string) => void;
  selectElement: (id: string | null) => void;
  setHoveredElement: (id: string | null) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  setZoom: (zoom: number) => void;
  setDragging: (isDragging: boolean) => void;
  setPreviewing: (isPreviewing: boolean) => void;
  copyElement: (id: string) => void;
  pasteElement: () => void;
  reset: () => void;
}

type DesignerStore = DesignerState & DesignerActions;

// ============================================================================
// 初始状态
// ============================================================================

const initialState: DesignerState = {
  template: null,
  selectedElementId: null,
  hoveredElementId: null,
  zoom: 1,
  isDragging: false,
  isPreviewing: false,
  clipboard: null,
};

// ============================================================================
// Store 创建 (带历史记录)
// ============================================================================

export const useDesignerStore = create<DesignerStore>()(
  temporal(
    immer((set, get) => ({
      ...initialState,

      setTemplate: (template: PrintTemplate) => {
        set({ template, selectedElementId: null });
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
          }
        });
      },

      updateElement: (id: string, updates: Partial<DesignElement>) => {
        set((state: DesignerStore) => {
          if (!state.template) return;
          const element = state.template.elements.find((el) => el.id === id);
          if (element) {
            Object.assign(element, updates);
          }
        });
      },

      removeElement: (id: string) => {
        set((state: DesignerStore) => {
          if (!state.template) return;
          state.template.elements = state.template.elements.filter(
            (el) => el.id !== id
          );
          if (state.selectedElementId === id) {
            state.selectedElementId = null;
          }
        });
      },

      duplicateElement: (id: string) => {
        const state = get();
        if (!state.template) return;

        const element = state.template.elements.find((el) => el.id === id);
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
          }
        });
      },

      selectElement: (id: string | null) => {
        set({ selectedElementId: id });
      },

      setHoveredElement: (id: string | null) => {
        set({ hoveredElementId: id });
      },

      bringToFront: (id: string) => {
        set((state: DesignerStore) => {
          if (!state.template) return;
          const maxZ = Math.max(
            ...state.template.elements.map((el) => el.zIndex)
          );
          const element = state.template.elements.find((el) => el.id === id);
          if (element) {
            element.zIndex = maxZ + 1;
          }
        });
      },

      sendToBack: (id: string) => {
        set((state: DesignerStore) => {
          if (!state.template) return;
          const minZ = Math.min(
            ...state.template.elements.map((el) => el.zIndex)
          );
          const element = state.template.elements.find((el) => el.id === id);
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

        const element = state.template.elements.find((el) => el.id === id);
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
          }
        });
      },

      reset: () => {
        set(initialState);
      },
    })),
    {
      // 只跟踪模板数据变化
      partialize: (state) => ({ template: state.template }),
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
  return useStore(useDesignerStore.temporal, (s) => s.undo);
}

export function useRedo() {
  return useStore(useDesignerStore.temporal, (s) => s.redo);
}

export function useClearHistory() {
  return useStore(useDesignerStore.temporal, (s) => s.clear);
}

export function useCanUndo() {
  return useStore(
    useDesignerStore.temporal,
    (s) => s.pastStates.length > 0
  );
}

export function useCanRedo() {
  return useStore(
    useDesignerStore.temporal,
    (s) => s.futureStates.length > 0
  );
}

// ============================================================================
// 选择器 (Selectors)
// ============================================================================

// 稳定的空数组引用，避免每次返回新引用导致无限循环
const EMPTY_ELEMENTS: DesignElement[] = [];

/** 获取当前选中的元素 */
export const useSelectedElement = (): DesignElement | null | undefined => useDesignerStore((state: DesignerStore) => {
    if (!state.template || !state.selectedElementId) return null;
    return state.template.elements.find((el) => el.id === state.selectedElementId);
  });

/** 获取所有元素 */
export const useElements = (): DesignElement[] => useDesignerStore(
    (state: DesignerStore) => state.template?.elements ?? EMPTY_ELEMENTS
  );

/** 获取页面设置 */
export const usePageSettings = (): PageSettings | undefined => useDesignerStore((state: DesignerStore) => state.template?.pageSettings);

// 兼容旧命名：历史版本曾导出 useDesignerStoreWithHistory
export const useDesignerStoreWithHistory = useDesignerStore;
