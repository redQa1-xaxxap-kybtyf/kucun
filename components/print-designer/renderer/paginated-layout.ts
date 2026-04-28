/**
 * 打印设计器 - 自适应分页布局
 *
 * 目标：
 * 1. 明细较少时保持单页标准版式
 * 2. 明细略多时自动启用紧凑表格，尽量维持单页
 * 3. 明细过多时自动分页，并在每页重复页头元素
 */

import type {
  DesignElement,
  PrintTemplate,
  TableElement,
  TableStyle,
} from '@/lib/print-designer/schemas';

import { getNestedValue, ptToPx, pxToMm } from './utils';

export interface TableRenderOverride {
  rowNumberOffset?: number;
  summaryItems?: unknown[];
}

export interface PrintPageLayout {
  data: Record<string, unknown>;
  elements: DesignElement[];
  pageLabel?: string;
  tableOverrides: Record<string, TableRenderOverride>;
}

export interface PrintLayout {
  pages: PrintPageLayout[];
}

const SINGLE_PAGE_COMPACT_MIN_ROW_HEIGHT_MM = 5;
const PAGINATED_TARGET_ROW_HEIGHT_MM = 5.2;
const ROW_HEIGHT_SEARCH_STEP_MM = 0.2;

function isTableElement(element: DesignElement): element is TableElement {
  return element.type === 'table';
}

function roundToTenth(value: number) {
  return Math.round(value * 10) / 10;
}

function hasSummary(element: TableElement) {
  return Boolean(element.showSummary && element.summaryColumns?.length);
}

function getTableItems(
  data: Record<string, unknown>,
  dataSource: string
): unknown[] {
  const value = getNestedValue(data, dataSource);
  return Array.isArray(value) ? value : [];
}

function cloneDataWithSlice(
  data: Record<string, unknown>,
  path: string,
  rows: unknown[]
): Record<string, unknown> {
  const segments = path.split('.').filter(Boolean);

  if (segments.length === 0) {
    return data;
  }

  const root: Record<string, unknown> = { ...data };
  let currentClone: Record<string, unknown> = root;
  let currentSource: unknown = data;

  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      currentClone[segment] = rows;
      return;
    }

    const sourceValue =
      currentSource &&
      typeof currentSource === 'object' &&
      !Array.isArray(currentSource)
        ? (currentSource as Record<string, unknown>)[segment]
        : undefined;

    const nextClone =
      sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)
        ? { ...(sourceValue as Record<string, unknown>) }
        : {};

    currentClone[segment] = nextClone;
    currentClone = nextClone;
    currentSource = sourceValue;
  });

  return root;
}

function estimateTitleHeightMm(element: TableElement, style: TableStyle) {
  const trimmedTitle = element.title?.trim();
  if (!trimmedTitle) {
    return 0;
  }

  const titleFontPx = ptToPx(Math.min(style.headerFontSize + 1, 18));
  const titleBarStyle = element.titleBarStyle ?? 'plain';

  if (titleBarStyle === 'filled' || titleBarStyle === 'outlined') {
    return pxToMm(titleFontPx * 1.2 + 12);
  }

  return pxToMm(titleFontPx * 1.2 + 3);
}

function estimateFooterNoteHeightMm(element: TableElement, style: TableStyle) {
  const trimmedFooterNote = element.footerNote?.trim();
  if (!trimmedFooterNote) {
    return 0;
  }

  const footerFontPx = ptToPx(Math.max(8, style.bodyFontSize - 1));
  const footerStyle = element.footerNoteStyle ?? 'plain';

  if (footerStyle === 'filled' || footerStyle === 'outlined') {
    return pxToMm(footerFontPx * 1.35 + 12);
  }

  return pxToMm(footerFontPx * 1.35 + 4);
}

function estimateHeaderHeightMm(style: TableStyle) {
  return Math.max(
    style.rowHeight * 0.7,
    pxToMm(ptToPx(style.headerFontSize) * 1.25 + 4)
  );
}

function estimateSummaryHeightMm(style: TableStyle) {
  return Math.max(
    style.rowHeight,
    pxToMm(ptToPx(style.bodyFontSize) * 1.25 + 4)
  );
}

function estimateTableRowCapacity(
  element: TableElement,
  style: TableStyle,
  options: {
    includeSummary: boolean;
    includeFooterNote: boolean;
  }
) {
  const reservedHeight =
    estimateTitleHeightMm(element, style) +
    estimateHeaderHeightMm(style) +
    (options.includeSummary ? estimateSummaryHeightMm(style) : 0) +
    (options.includeFooterNote ? estimateFooterNoteHeightMm(element, style) : 0);

  const availableBodyHeight = Math.max(0, element.size.height - reservedHeight);
  return Math.max(1, Math.floor((availableBodyHeight + 0.05) / style.rowHeight));
}

function createAdaptiveTableStyle(
  baseStyle: TableStyle,
  targetRowHeight: number
): TableStyle {
  const ratio = targetRowHeight / Math.max(baseStyle.rowHeight, 0.1);

  return {
    ...baseStyle,
    rowHeight: roundToTenth(targetRowHeight),
    headerFontSize: roundToTenth(
      Math.max(7.5, baseStyle.headerFontSize * Math.max(0.85, ratio))
    ),
    bodyFontSize: roundToTenth(
      Math.max(7.2, baseStyle.bodyFontSize * Math.max(0.82, ratio))
    ),
  };
}

function findSinglePageCompactStyle(
  element: TableElement,
  requiredRows: number
): TableStyle | null {
  const minimumRowHeight = Math.min(
    element.style.rowHeight,
    SINGLE_PAGE_COMPACT_MIN_ROW_HEIGHT_MM
  );

  for (
    let rowHeight = roundToTenth(element.style.rowHeight - ROW_HEIGHT_SEARCH_STEP_MM);
    rowHeight >= minimumRowHeight;
    rowHeight = roundToTenth(rowHeight - ROW_HEIGHT_SEARCH_STEP_MM)
  ) {
    const candidateStyle = createAdaptiveTableStyle(element.style, rowHeight);
    const capacity = estimateTableRowCapacity(element, candidateStyle, {
      includeSummary: hasSummary(element),
      includeFooterNote: true,
    });

    if (requiredRows <= capacity) {
      return candidateStyle;
    }
  }

  return null;
}

function getPaginatedStyle(element: TableElement) {
  const targetRowHeight = Math.min(
    element.style.rowHeight,
    PAGINATED_TARGET_ROW_HEIGHT_MM
  );

  return createAdaptiveTableStyle(element.style, targetRowHeight);
}

function getPageRowDistribution(
  totalRows: number,
  regularCapacity: number,
  lastCapacity: number
) {
  if (totalRows <= 0) {
    return [0];
  }

  if (totalRows <= lastCapacity) {
    return [totalRows];
  }

  let totalPages = 2;
  while (totalRows > (totalPages - 1) * regularCapacity + lastCapacity) {
    totalPages += 1;
  }

  const rowsPerPage: number[] = [];
  let remainingRows = totalRows;

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    const pagesRemaining = totalPages - pageIndex;

    if (pagesRemaining === 1) {
      rowsPerPage.push(remainingRows);
      break;
    }

    const maxCapacityForRest =
      lastCapacity + Math.max(0, pagesRemaining - 2) * regularCapacity;
    const minimumCurrentRows = Math.max(1, remainingRows - maxCapacityForRest);
    const idealCurrentRows = Math.ceil(remainingRows / pagesRemaining);
    const currentRows = Math.min(
      regularCapacity,
      Math.max(minimumCurrentRows, idealCurrentRows)
    );

    rowsPerPage.push(currentRows);
    remainingRows -= currentRows;
  }

  return rowsPerPage;
}

function resolveDocumentReference(data: Record<string, unknown>) {
  const candidatePaths = [
    'order.orderNumber',
    'record.orderNumber',
    'order.returnNumber',
    'order.recordNumber',
    'sourceOrderNumber',
  ];

  for (const path of candidatePaths) {
    const value = getNestedValue(data, path);
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function buildPageLabel(
  data: Record<string, unknown>,
  currentPage: number,
  totalPages: number
) {
  const documentReference = resolveDocumentReference(data);

  if (documentReference) {
    return `单号 ${documentReference} · 第 ${currentPage} / ${totalPages} 页`;
  }

  return `第 ${currentPage} / ${totalPages} 页`;
}

function buildSinglePageLayout(
  data: Record<string, unknown>,
  elements: DesignElement[]
): PrintLayout {
  return {
    pages: [
      {
        data,
        elements,
        tableOverrides: {},
      },
    ],
  };
}

export function buildPrintLayout(
  template: PrintTemplate,
  data: Record<string, unknown>
): PrintLayout {
  const visibleElements = template.elements.filter(element => element.visible);
  const tableElements = visibleElements.filter(isTableElement);

  if (tableElements.length !== 1) {
    return buildSinglePageLayout(data, visibleElements);
  }

  const tableElement = tableElements[0];
  if (!tableElement) {
    return buildSinglePageLayout(data, visibleElements);
  }

  const items = getTableItems(data, tableElement.dataSource);
  const requiredSinglePageRows = Math.max(items.length, tableElement.minRows ?? 0);

  const standardCapacity = estimateTableRowCapacity(tableElement, tableElement.style, {
    includeSummary: hasSummary(tableElement),
    includeFooterNote: true,
  });

  if (requiredSinglePageRows <= standardCapacity) {
    return buildSinglePageLayout(data, visibleElements);
  }

  const compactSinglePageStyle = findSinglePageCompactStyle(
    tableElement,
    requiredSinglePageRows
  );

  if (compactSinglePageStyle) {
    const compactElements = visibleElements.map(element =>
      element.id === tableElement.id
        ? {
            ...tableElement,
            style: compactSinglePageStyle,
          }
        : element
    );

    return buildSinglePageLayout(data, compactElements);
  }

  const paginatedStyle = getPaginatedStyle(tableElement);
  const regularPageCapacity = estimateTableRowCapacity(tableElement, paginatedStyle, {
    includeSummary: false,
    includeFooterNote: false,
  });
  const lastPageCapacity = estimateTableRowCapacity(tableElement, paginatedStyle, {
    includeSummary: hasSummary(tableElement),
    includeFooterNote: true,
  });

  if (regularPageCapacity <= 0 || lastPageCapacity <= 0) {
    return buildSinglePageLayout(data, visibleElements);
  }

  const rowDistribution = getPageRowDistribution(
    items.length,
    regularPageCapacity,
    lastPageCapacity
  );

  const tableBottom = tableElement.position.y + tableElement.size.height;
  const repeatingElements = visibleElements.filter(
    element => element.id !== tableElement.id && element.position.y < tableBottom
  );
  const trailingElements = visibleElements.filter(
    element => element.id !== tableElement.id && element.position.y >= tableBottom
  );

  const pages: PrintPageLayout[] = [];
  let rowOffset = 0;

  rowDistribution.forEach((rowCount, pageIndex) => {
    const isLastPage = pageIndex === rowDistribution.length - 1;
    const rowSlice = items.slice(rowOffset, rowOffset + rowCount);
    const pageData = cloneDataWithSlice(data, tableElement.dataSource, rowSlice);
    const pageTable: TableElement = {
      ...tableElement,
      style: paginatedStyle,
      minRows: undefined,
      showSummary: isLastPage ? tableElement.showSummary : false,
      summaryColumns: isLastPage ? tableElement.summaryColumns : undefined,
      footerNote: isLastPage ? tableElement.footerNote : '',
    };

    pages.push({
      data: pageData,
      elements: isLastPage
        ? [...repeatingElements, pageTable, ...trailingElements]
        : [...repeatingElements, pageTable],
      pageLabel: buildPageLabel(data, pageIndex + 1, rowDistribution.length),
      tableOverrides: {
        [tableElement.id]: {
          rowNumberOffset: rowOffset,
          summaryItems: isLastPage ? items : undefined,
        },
      },
    });

    rowOffset += rowCount;
  });

  return { pages };
}
