import type { ProductImage } from '@/lib/types/product';

const LOCAL_URL_BASE = 'https://local.kucun.invalid';

export function normalizeImageUrlForComparison(
  value: string | null | undefined
) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const url = raw.startsWith('/')
      ? new URL(raw, LOCAL_URL_BASE)
      : new URL(raw);
    const host =
      url.origin === LOCAL_URL_BASE
        ? ''
        : `${url.protocol.toLowerCase()}//${url.host.toLowerCase()}`;

    return `${host}${decodeURIComponent(url.pathname)}`.replace(/\/+$/, '');
  } catch (_error) {
    return raw.split(/[?#]/)[0].trim().replace(/\/+$/, '');
  }
}

export function isSameImageUrl(
  left: string | null | undefined,
  right: string | null | undefined
) {
  const leftKey = normalizeImageUrlForComparison(left);
  const rightKey = normalizeImageUrlForComparison(right);

  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

export function dedupeImageUrls(
  urls: Array<string | null | undefined>,
  excludedUrls: Array<string | null | undefined> = []
) {
  const seen = new Set(
    excludedUrls.map(url => normalizeImageUrlForComparison(url)).filter(Boolean)
  );
  const result: string[] = [];

  for (const url of urls) {
    const trimmed = String(url || '').trim();
    const key = normalizeImageUrlForComparison(trimmed);
    if (!trimmed || !key || seen.has(key)) continue;

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

export function dedupeProductImages(
  images: ProductImage[],
  excludedUrls: Array<string | null | undefined> = []
) {
  const seen = new Set(
    excludedUrls.map(url => normalizeImageUrlForComparison(url)).filter(Boolean)
  );
  const result: ProductImage[] = [];

  for (const image of images) {
    const url = String(image.url || '').trim();
    const key = normalizeImageUrlForComparison(url);
    if (!url || !key || seen.has(key)) continue;

    seen.add(key);
    result.push({
      ...image,
      url,
      alt: image.alt?.trim() || undefined,
      order: result.length,
    });
  }

  return result;
}
