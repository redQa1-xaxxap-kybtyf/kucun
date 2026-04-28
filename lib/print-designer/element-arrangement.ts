import type { DesignElement } from './schemas';

export type ElementArrangementMode =
  | 'align-left'
  | 'align-center'
  | 'align-right'
  | 'align-top'
  | 'align-middle'
  | 'align-bottom'
  | 'distribute-horizontal'
  | 'distribute-vertical'
  | 'match-width'
  | 'match-height';

export interface ElementArrangementUpdate {
  id: string;
  updates: Partial<DesignElement>;
}

type ElementBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

function getSelectionBounds(elements: DesignElement[]): ElementBounds {
  const left = Math.min(...elements.map(element => element.position.x));
  const top = Math.min(...elements.map(element => element.position.y));
  const right = Math.max(
    ...elements.map(element => element.position.x + element.size.width)
  );
  const bottom = Math.max(
    ...elements.map(element => element.position.y + element.size.height)
  );

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function sortByHorizontalPosition(elements: DesignElement[]) {
  return [...elements].sort((left, right) => {
    if (left.position.x === right.position.x) {
      return left.id.localeCompare(right.id);
    }

    return left.position.x - right.position.x;
  });
}

function sortByVerticalPosition(elements: DesignElement[]) {
  return [...elements].sort((top, bottom) => {
    if (top.position.y === bottom.position.y) {
      return top.id.localeCompare(bottom.id);
    }

    return top.position.y - bottom.position.y;
  });
}

function createPositionUpdate(
  element: DesignElement,
  position: { x?: number; y?: number }
): ElementArrangementUpdate {
  return {
    id: element.id,
    updates: {
      position: {
        x: position.x ?? element.position.x,
        y: position.y ?? element.position.y,
      },
    },
  };
}

export function arrangeElements(
  elements: DesignElement[],
  mode: ElementArrangementMode,
  referenceElementId?: string | null
): ElementArrangementUpdate[] {
  if (elements.length === 0) {
    return [];
  }

  const bounds = getSelectionBounds(elements);
  const referenceElement =
    elements.find(element => element.id === referenceElementId) ?? elements[0];

  switch (mode) {
    case 'align-left':
      return elements.map(element =>
        createPositionUpdate(element, { x: bounds.left })
      );
    case 'align-center': {
      const centerX = bounds.left + bounds.width / 2;
      return elements.map(element =>
        createPositionUpdate(element, {
          x: centerX - element.size.width / 2,
        })
      );
    }
    case 'align-right':
      return elements.map(element =>
        createPositionUpdate(element, {
          x: bounds.right - element.size.width,
        })
      );
    case 'align-top':
      return elements.map(element =>
        createPositionUpdate(element, { y: bounds.top })
      );
    case 'align-middle': {
      const middleY = bounds.top + bounds.height / 2;
      return elements.map(element =>
        createPositionUpdate(element, {
          y: middleY - element.size.height / 2,
        })
      );
    }
    case 'align-bottom':
      return elements.map(element =>
        createPositionUpdate(element, {
          y: bounds.bottom - element.size.height,
        })
      );
    case 'distribute-horizontal': {
      if (elements.length < 3) {
        return [];
      }

      const sortedElements = sortByHorizontalPosition(elements);
      const totalWidth = sortedElements.reduce(
        (sum, element) => sum + element.size.width,
        0
      );
      const gap = (bounds.width - totalWidth) / (sortedElements.length - 1);
      let currentX = bounds.left;

      return sortedElements.map(element => {
        const update = createPositionUpdate(element, { x: currentX });
        currentX += element.size.width + gap;
        return update;
      });
    }
    case 'distribute-vertical': {
      if (elements.length < 3) {
        return [];
      }

      const sortedElements = sortByVerticalPosition(elements);
      const totalHeight = sortedElements.reduce(
        (sum, element) => sum + element.size.height,
        0
      );
      const gap = (bounds.height - totalHeight) / (sortedElements.length - 1);
      let currentY = bounds.top;

      return sortedElements.map(element => {
        const update = createPositionUpdate(element, { y: currentY });
        currentY += element.size.height + gap;
        return update;
      });
    }
    case 'match-width':
      return elements.map(element => ({
        id: element.id,
        updates: {
          size: {
            ...element.size,
            width: referenceElement.size.width,
          },
        },
      }));
    case 'match-height':
      return elements.map(element => ({
        id: element.id,
        updates: {
          size: {
            ...element.size,
            height: referenceElement.size.height,
          },
        },
      }));
    default:
      return [];
  }
}
