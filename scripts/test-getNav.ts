import { navigationItems } from '../components/common/sidebar-navigation-config';

function getNavItemsByIds(ids: string[], allItems: typeof navigationItems) {
  const result: any[] = [];
  for (const item of allItems) {
    const childItems =
      item.children && item.children.length > 0
        ? getNavItemsByIds(ids, item.children as any)
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

const ids = [
  'factory-shipments',
  'factory-shipments-customer-direct',
  'factory-shipments-warehouse-inbound',
];
const result = getNavItemsByIds(ids, navigationItems as any);
console.log(JSON.stringify(result, null, 2));
