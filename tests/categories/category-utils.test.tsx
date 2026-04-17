import {
  buildCategoryLevelMap,
  buildCategoryPathMap,
} from '@/lib/utils/category-utils';

describe('分类层级工具', () => {
  test('可以生成完整分类路径', () => {
    const pathMap = buildCategoryPathMap([
      { id: '1', name: '瓷砖', code: 'tile', parentId: null },
      { id: '2', name: '抛光砖', code: 'polished', parentId: '1' },
      { id: '3', name: '柔抛', code: 'soft', parentId: '2' },
    ]);

    expect(pathMap.get('1')).toBe('瓷砖');
    expect(pathMap.get('2')).toBe('瓷砖 / 抛光砖');
    expect(pathMap.get('3')).toBe('瓷砖 / 抛光砖 / 柔抛');
  });

  test('可以生成稳定的层级值', () => {
    const levelMap = buildCategoryLevelMap([
      { id: '1', name: '瓷砖', code: 'tile', parentId: null },
      { id: '2', name: '抛光砖', code: 'polished', parentId: '1' },
      { id: '3', name: '柔抛', code: 'soft', parentId: '2' },
    ]);

    expect(levelMap.get('1')).toBe(0);
    expect(levelMap.get('2')).toBe(1);
    expect(levelMap.get('3')).toBe(2);
  });
});
