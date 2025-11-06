import { navigationItems } from '../components/common/sidebar-navigation-config';
import { getAccessibleNavItems } from '../lib/utils/permissions';

const role = 'admin' as const;
const filtered = getAccessibleNavItems(navigationItems, role);

function extractAllIds(items: any[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    ids.push(item.id);
    if (item.children && item.children.length) {
      ids.push(...extractAllIds(item.children));
    }
  }
  return ids;
}

const ids = extractAllIds(filtered as any);
console.log('ids', ids);

function getNavItemsByIds(ids: string[], allItems: any[]) {
  const result: any[] = [];
  for (const item of allItems) {
    const childItems =
      item.children && item.children.length > 0
        ? getNavItemsByIds(ids, item.children)
        : undefined;
    const shouldIncludeSelf = ids.includes(item.id);
    const shouldIncludeChildren = Boolean(childItems && childItems.length > 0);
    if (!shouldIncludeSelf && !shouldIncludeChildren) {
      continue;
    }
    result.push({
      ...item,
      children: shouldIncludeChildren ? childItems : undefined,
    });
  }
  return result;
}

const rebuilt = getNavItemsByIds(ids, navigationItems);
console.log('rebuilt length', rebuilt.length);
console.log(
  'keys',
  rebuilt.map((item, index) => item.id || item.href || `${item.title}-${index}`)
);

rebuilt.forEach((item, index) => {
  if (item.children) {
    const childKeys = item.children.map(
      (child: any, childIndex: number) =>
        `${item.id}-${child.id ?? child.href ?? child.title}-${childIndex}`
    );
    console.log('child keys for', item.id, childKeys);
  }
});
