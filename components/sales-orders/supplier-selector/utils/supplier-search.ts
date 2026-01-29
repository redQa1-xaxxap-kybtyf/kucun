import type { Supplier } from '@/lib/types/supplier';
import type { PinyinUtils } from '@/lib/utils/pinyin-loader';

const collapseSpaces = (value: string) => value.replace(/\s+/g, '');

const toSafeLowerCase = (value: string | undefined | null) =>
  (value ?? '').toLowerCase();

export function filterSuppliers(
  suppliers: Supplier[],
  rawQuery: string,
  pinyinUtils?: PinyinUtils
): Supplier[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return [];
  }

  const normalizedQueryNoSpaces = collapseSpaces(query);

  const shouldUsePinyin = Boolean(pinyinUtils && /[a-z]/i.test(query));

  return suppliers.filter(supplier => {
    const name = supplier.name ?? '';
    const nameLower = name.toLowerCase();

    if (nameLower.includes(query)) {
      return true;
    }

    if (supplier.phone && supplier.phone.includes(query)) {
      return true;
    }

    const addressLower = toSafeLowerCase(supplier.address);
    if (addressLower.includes(query)) {
      return true;
    }

    if (shouldUsePinyin && pinyinUtils) {
      const fullPinyin = collapseSpaces(
        pinyinUtils.chineseToPinyinUppercase(name).toLowerCase()
      );
      if (fullPinyin && fullPinyin.includes(normalizedQueryNoSpaces)) {
        return true;
      }

      const initials = collapseSpaces(
        pinyinUtils.chineseToPinyinInitialsUppercase(name).toLowerCase()
      );
      if (initials && initials.includes(normalizedQueryNoSpaces)) {
        return true;
      }
    }

    return false;
  });
}
