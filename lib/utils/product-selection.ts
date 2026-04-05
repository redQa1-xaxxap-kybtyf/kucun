import type { Product } from '@/lib/types/product';

export function mergeProductsById(
  baseProducts: Product[],
  overrideProducts: Array<Product | null | undefined>
): Product[] {
  const merged = [...baseProducts];
  const indexById = new Map<string, number>();

  merged.forEach((product, index) => {
    if (product?.id) {
      indexById.set(product.id, index);
    }
  });

  overrideProducts.forEach(product => {
    if (!product?.id) {
      return;
    }

    const existingIndex = indexById.get(product.id);
    if (existingIndex === undefined) {
      indexById.set(product.id, merged.length);
      merged.push(product);
      return;
    }

    merged[existingIndex] = product;
  });

  return merged;
}
