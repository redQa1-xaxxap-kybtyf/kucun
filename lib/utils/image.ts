export function shouldBypassImageOptimization(
  src: string | null | undefined
): boolean {
  if (!src) {
    return false;
  }

  try {
    const resolved = src.startsWith('http')
      ? new URL(src)
      : new URL(src, 'http://localhost');
    return resolved.pathname.startsWith('/api/uploads/');
  } catch {
    return src.startsWith('/api/uploads/');
  }
}
