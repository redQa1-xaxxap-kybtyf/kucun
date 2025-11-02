/**
 * Selector normalization helpers
 * Cleans up user-provided selectors and converts attribute-like inputs into valid selectors.
 */

// cspell:ignore shipstatus logisticsstatus currentstatus arrivalport destinationport estimatedtime arrivaltime deliverytime lastupdatetime lastupdated updatetime lastupdate

import type { ExtractField, ExtractSelectors } from '@/lib/types/shipping';

const CODE_WRAPPER_PATTERNS: RegExp[] = [
  /(?:await\s+)?(?:page\.)?waitForXPath\s*\(\s*(['"`])([^'"`]+)\1/i,
  /(?:await\s+)?(?:page\.)?\$x\s*\(\s*(['"`])([^'"`]+)\1/i,
  /document\.evaluate\s*\(\s*(['"`])([^'"`]+)\1/i,
  /(?:await\s+)?(?:page\.)?waitForSelector\s*\(\s*(['"`])([^'"`]+)\1/i,
  /(?:await\s+)?(?:page\.)?\$\s*\(\s*(['"`])([^'"`]+)\1/i,
  /document\.querySelector(?:All)?\s*\(\s*(['"`])([^'"`]+)\1/i,
];

const QUOTED_STRING = /^(['"`])(.+)\1$/;

export function sanitizeSelectorInput(raw?: string | null): string {
  if (!raw) {
    return '';
  }

  let trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }

  for (const pattern of CODE_WRAPPER_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      trimmed = match[2];
      break;
    }
  }

  trimmed = trimmed.replace(/;+\s*$/, '').trim();

  const quotedMatch = trimmed.match(QUOTED_STRING);
  if (quotedMatch) {
    trimmed = quotedMatch[2].trim();
  }

  return trimmed;
}

export function normalizeSelector(raw?: string | null): string {
  const sanitized = sanitizeSelectorInput(raw);
  if (!sanitized) {
    return '';
  }

  // Already a valid CSS selector (starts with #, ., [, etc.)
  if (/^[.#\[]/.test(sanitized)) {
    return sanitized;
  }

  // Matches patterns like id="value" or class=foo
  const attrMatch = sanitized.match(
    /^([a-zA-Z_][\w-]*)\s*=\s*["']?([^"'`]+)["']?$/
  );
  if (attrMatch) {
    const attr = attrMatch[1].toLowerCase();
    const value = attrMatch[2].trim();
    if (!value) {
      return '';
    }

    if (attr === 'id') {
      return `#${value}`;
    }

    if (attr === 'class') {
      return value
        .split(/\s+/)
        .filter(Boolean)
        .map(part => `.${part}`)
        .join('');
    }

    return `[${attr}="${value}"]`;
  }

  return sanitized;
}

export function normalizeSelectorGroup<
  T extends { [K in keyof T]: string | undefined },
>(group: T): { [K in keyof T]: string } {
  const entries = (Object.entries(group) as Array<[keyof T, T[keyof T]]>).map(
    ([key, value]) => [
      key,
      normalizeSelector(value as string | null | undefined),
    ]
  );
  return Object.fromEntries(entries) as { [K in keyof T]: string };
}

const CANONICAL_KEYS = ['status', 'destination', 'estimatedArrival', 'updateTime'] as const;
type CanonicalKey = (typeof CANONICAL_KEYS)[number];

const SHIPPING_SELECTOR_ALIASES: Record<CanonicalKey, string[]> = {
  status: ['shipstatus', 'logisticsstatus', 'currentstatus', 'state'],
  destination: ['dest', 'location', 'arrivalport', 'port', 'to', 'destinationport'],
  estimatedArrival: [
    'eta',
    'estimatedtime',
    'estimated-arrival',
    'arrival',
    'arrivaltime',
    'arrival-time',
    'deliverytime',
    'delivery-time',
  ],
  updateTime: [
    'lastupdatetime',
    'lastupdated',
    'update-time',
    'updatetime',
    'timestamp',
    'lastupdate',
  ],
};

function toSelectorObject(
  raw?:
    | ExtractSelectors
    | Partial<ExtractSelectors>
    | ExtractField[]
    | Record<string, string>
    | null
): Record<string, string> {
  if (!raw) {
    return {};
  }

  if (Array.isArray(raw)) {
    return raw.reduce<Record<string, string>>((acc, field) => {
      if (field?.key) {
        acc[field.key] = field.selector ?? '';
      }
      return acc;
    }, {});
  }

  return Object.entries(raw).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === 'string') {
      acc[key] = value;
    }
    return acc;
  }, {});
}

export function normalizeShippingExtractSelectors(
  raw?:
    | ExtractSelectors
    | Partial<ExtractSelectors>
    | ExtractField[]
    | Record<string, string>
    | null
): Record<string, string> {
  const selectorObject = toSelectorObject(raw);
  const normalized = normalizeSelectorGroup(selectorObject);
  const result: Record<string, string> = { ...normalized };

  const lowercaseKeyMap = new Map<string, string>();
  for (const key of Object.keys(normalized)) {
    lowercaseKeyMap.set(key.toLowerCase(), key);
  }

  for (const canonicalKey of CANONICAL_KEYS) {
    const existing = result[canonicalKey];
    if (existing && existing.trim()) {
      continue;
    }

    const aliases = [canonicalKey, ...SHIPPING_SELECTOR_ALIASES[canonicalKey]];
    const matchedAlias = aliases.find(alias => {
      const realKey = lowercaseKeyMap.get(alias.toLowerCase());
      if (!realKey) {
        return false;
      }
      const value = normalized[realKey];
      return Boolean(value);
    });

    if (matchedAlias) {
      const realKey = lowercaseKeyMap.get(matchedAlias.toLowerCase());
      if (realKey) {
        result[canonicalKey] = normalized[realKey];
      }
    }
  }

  return result;
}
