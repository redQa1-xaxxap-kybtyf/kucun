/**
 * Selector normalization helpers
 * Cleans up user-provided selectors and converts attribute-like inputs into valid selectors.
 */

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
  const entries = Object.entries(group).map(([key, value]) => [
    key,
    normalizeSelector(value),
  ]);
  return Object.fromEntries(entries) as { [K in keyof T]: string };
}
