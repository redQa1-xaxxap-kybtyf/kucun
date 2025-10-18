import React from 'react';

import { formatPieceSummary } from '@/lib/utils/piece-calculation';
import {
  chineseToPinyinInitialsUppercase,
  chineseToPinyinUppercase,
} from '@/lib/utils/pinyin';
import { ProductDataUtils } from '@/lib/utils/product-data';

import type { ProductWithInventory } from '../types';

export const MAX_SEARCH_RESULTS = 50;

export interface ProductSearchIndexEntry {
  product: ProductWithInventory;
  normalized: NormalizedSearchFields;
}

export interface NormalizedSearchFields {
  code: string;
  codePinyin: string;
  codeInitials: string;
  name: string;
  namePinyin: string;
  nameInitials: string;
  specification: string;
  specificationPinyin: string;
  specificationInitials: string;
  id: string;
  status?: string;
  availableInventory: number;
}

export interface SearchTokenInfo {
  original: string;
  normalized: string;
  pinyin: string;
  initials: string;
}

export function buildProductSearchIndex(products: ProductWithInventory[]) {
  const productMap = new Map<string, ProductWithInventory>();
  const entries: ProductSearchIndexEntry[] = products.map(product => {
    productMap.set(product.id, product);
    const specification = formatProductSpecification(product.specification);
    return {
      product,
      normalized: {
        code: (product.code || '').toLowerCase(),
        codePinyin: chineseToPinyinUppercase(product.code || '').toLowerCase(),
        codeInitials: chineseToPinyinInitialsUppercase(
          product.code || ''
        ).toLowerCase(),
        name: (product.name || '').toLowerCase(),
        namePinyin: chineseToPinyinUppercase(product.name || '').toLowerCase(),
        nameInitials: chineseToPinyinInitialsUppercase(
          product.name || ''
        ).toLowerCase(),
        specification: specification.toLowerCase(),
        specificationPinyin:
          chineseToPinyinUppercase(specification).toLowerCase(),
        specificationInitials:
          chineseToPinyinInitialsUppercase(specification).toLowerCase(),
        id: product.id.toLowerCase(),
        status: product.status,
        availableInventory: product.inventory?.availableInventory ?? 0,
      },
    };
  });

  return {
    entries,
    productMap,
  };
}

export function searchProducts(
  entries: ProductSearchIndexEntry[],
  query: string
): ProductWithInventory[] {
  const tokens = computeSearchTokens(query);
  if (tokens.length === 0) {
    return [];
  }

  const MIN_SCORE = 2;

  return entries
    .map(entry => ({
      product: entry.product,
      score: scoreProduct(entry.normalized, tokens),
      availableInventory: entry.normalized.availableInventory,
    }))
    .filter(result => result.score >= MIN_SCORE)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (b.availableInventory !== a.availableInventory) {
        return b.availableInventory - a.availableInventory;
      }
      return a.product.name.localeCompare(b.product.name, 'zh-CN');
    })
    .slice(0, MAX_SEARCH_RESULTS)
    .map(item => item.product);
}

export function computeSearchTokens(query: string): SearchTokenInfo[] {
  return query
    .split(/\s+/)
    .map(token => token.trim().toLowerCase())
    .filter(Boolean)
    .map(token => {
      const pinyinValue = chineseToPinyinUppercase(token).toLowerCase();
      const initialsValue =
        chineseToPinyinInitialsUppercase(token).toLowerCase();
      return {
        original: token,
        normalized: token,
        pinyin: pinyinValue !== token ? pinyinValue : '',
        initials: initialsValue !== token ? initialsValue : '',
      };
    });
}

export function scoreProduct(
  fields: NormalizedSearchFields,
  tokens: SearchTokenInfo[]
): number {
  let score = 0;

  tokens.forEach(token => {
    score += matchText(fields.code, token.normalized, {
      exact: 18,
      prefix: 9,
      contains: 6,
    });
    score += matchText(fields.name, token.normalized, {
      exact: 14,
      prefix: 7,
      contains: 4,
    });
    score += matchText(fields.specification, token.normalized, {
      exact: 8,
      prefix: 4,
      contains: 2,
    });

    if (token.pinyin) {
      score += matchText(fields.namePinyin, token.pinyin, {
        exact: 6,
        prefix: 3,
        contains: 1.5,
      });
      score += matchText(fields.specificationPinyin, token.pinyin, {
        exact: 4,
        prefix: 2,
        contains: 1,
      });
      score += matchText(fields.codePinyin, token.pinyin, {
        exact: 5,
        prefix: 2.5,
        contains: 1,
      });
    }

    if (token.initials) {
      score += matchText(fields.nameInitials, token.initials, {
        exact: 8,
        prefix: 4,
        contains: 2,
      });
      score += matchText(fields.specificationInitials, token.initials, {
        exact: 5,
        prefix: 2.5,
        contains: 1,
      });
      score += matchText(fields.codeInitials, token.initials, {
        exact: 5,
        prefix: 2.5,
        contains: 1,
      });
    }
  });

  if (fields.status === 'active') {
    score += 0.5;
  } else if (fields.status === 'inactive') {
    score -= 0.5;
  }

  if (fields.availableInventory > 0) {
    score += Math.min(fields.availableInventory / 100, 1);
  }

  return score;
}

export interface MatchWeights {
  exact: number;
  prefix: number;
  contains: number;
}

export function matchText(
  text: string,
  token: string,
  weights: MatchWeights
): number {
  if (!text || !token) {
    return 0;
  }

  if (text === token) {
    return weights.exact;
  }
  if (text.startsWith(token)) {
    return weights.prefix;
  }
  if (text.includes(token)) {
    return weights.contains;
  }
  return 0;
}

export function buildHighlightTokens(query: string): string[] {
  if (!query) {
    return [];
  }

  const tokens = Array.from(
    new Set(
      query
        .split(/\s+/)
        .map(token => token.trim())
        .filter(Boolean)
    )
  );

  return tokens.sort((a, b) => b.length - a.length);
}

export function renderHighlightedText(
  text: string | undefined,
  tokens: string[]
): React.ReactNode {
  if (!text || tokens.length === 0) {
    return text ?? null;
  }

  const pattern = new RegExp(
    `(${tokens.map(token => escapeRegExp(token)).join('|')})`,
    'ig'
  );

  const segments = text.split(pattern).filter(segment => segment.length > 0);

  return segments.map((segment, index) => {
    const isMatch = tokens.some(
      token => segment.toLowerCase() === token.toLowerCase()
    );

    if (isMatch) {
      return (
        <mark
          key={`highlight-${segment}-${index}`}
          className="rounded bg-amber-100 px-0.5 text-amber-900"
        >
          {segment}
        </mark>
      );
    }

    return (
      <React.Fragment key={`segment-${segment}-${index}`}>
        {segment}
      </React.Fragment>
    );
  });
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatProductSpecification(
  spec?: string | null,
  truncateTo?: number
) {
  const formatted =
    ProductDataUtils.formatter.formatSpecification(spec ?? '') || '';
  const sanitized = formatted.trim();

  if (
    !sanitized ||
    sanitized === '-' ||
    sanitized.toLowerCase() === '规格详情'
  ) {
    return '';
  }

  if (truncateTo && sanitized.length > truncateTo) {
    return `${sanitized.slice(0, truncateTo)}...`;
  }

  return sanitized;
}

export function formatInventoryQuantity(
  quantity: number,
  piecesPerUnit: number
) {
  return formatPieceSummary(quantity, piecesPerUnit, {
    fallbackUnit: '片',
    zeroDisplay: '0片',
  });
}

export function buildProductKeywords(
  product: ProductWithInventory,
  specification: string
) {
  return [product.code, product.name, specification, product.id].filter(
    (token): token is string => Boolean(token)
  );
}
