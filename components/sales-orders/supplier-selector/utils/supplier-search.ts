import type { Supplier } from '@/lib/types/supplier';
import {
  chineseToPinyinInitialsUppercase,
  chineseToPinyinUppercase,
} from '@/lib/utils/pinyin';

const collapseSpaces = (value: string) => value.replace(/\s+/g, '');

const toSafeLowerCase = (value: string | undefined | null) =>
  (value ?? '').toLowerCase();

export function filterSuppliers(
  suppliers: Supplier[],
  rawQuery: string
): Supplier[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return [];
  }

  const normalizedQueryNoSpaces = collapseSpaces(query);

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

    const fullPinyin = collapseSpaces(
      chineseToPinyinUppercase(name).toLowerCase()
    );
    if (fullPinyin && fullPinyin.includes(normalizedQueryNoSpaces)) {
      return true;
    }

    const initials = collapseSpaces(
      chineseToPinyinInitialsUppercase(name).toLowerCase()
    );
    if (initials && initials.includes(normalizedQueryNoSpaces)) {
      return true;
    }

    return false;
  });
}
