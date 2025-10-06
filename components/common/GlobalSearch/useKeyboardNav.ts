/**
 * 键盘导航 Hook
 * 提供搜索结果的键盘导航功能
 */

import { useCallback, useState } from 'react';

interface UseKeyboardNavOptions {
  totalItems: number;
  onSelect: (index: number) => void;
  onClose: () => void;
  onSearch?: () => void;
}

export function useKeyboardNav({
  totalItems,
  onSelect,
  onClose,
  onSearch,
}: UseKeyboardNavOptions) {
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex(prev => (prev + 1) % totalItems);
          break;

        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex(prev => (prev - 1 + totalItems) % totalItems);
          break;

        case 'Enter':
          event.preventDefault();
          if (selectedIndex >= 0) {
            onSelect(selectedIndex);
          } else if (onSearch) {
            onSearch();
          }
          break;

        case 'Escape':
          event.preventDefault();
          onClose();
          break;

        default:
          break;
      }
    },
    [totalItems, selectedIndex, onSelect, onClose, onSearch]
  );

  return {
    selectedIndex,
    setSelectedIndex,
    handleKeyDown,
  };
}
