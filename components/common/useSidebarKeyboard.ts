import * as React from 'react';

interface UseSidebarKeyboardParams {
  isOpen: boolean;
  totalItems: number;
  navItemsRef: React.MutableRefObject<(HTMLAnchorElement | null)[]>;
}

/**
 * 键盘导航 Hook
 * 提取键盘导航逻辑,减少主组件复杂度
 */
export function useSidebarKeyboard({
  isOpen,
  totalItems,
  navItemsRef,
}: UseSidebarKeyboardParams) {
  const [focusedIndex, setFocusedIndex] = React.useState(-1);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) {
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex(prev => (prev + 1) % totalItems);
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex(prev => (prev - 1 + totalItems) % totalItems);
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          setFocusedIndex(current => {
            if (current >= 0 && navItemsRef.current[current]) {
              navItemsRef.current[current]?.click();
            }
            return current;
          });
          break;
        case 'Escape':
          setFocusedIndex(-1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, totalItems, navItemsRef]);

  return { focusedIndex, setFocusedIndex };
}
