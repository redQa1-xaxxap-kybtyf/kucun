import {
  navigationItems,
  bottomNavigationItems,
} from '../components/common/sidebar-navigation-config';

function flatten(items) {
  const arr: { id: string; title: string }[] = [];
  const stack = [...items];
  while (stack.length) {
    const item = stack.shift()!;
    arr.push({ id: item.id, title: item.title });
    if (item.children) {
      stack.push(...item.children);
    }
  }
  return arr;
}

const main = flatten(navigationItems);
const bottom = flatten(bottomNavigationItems);

console.log('main', main);
console.log('bottom', bottom);
