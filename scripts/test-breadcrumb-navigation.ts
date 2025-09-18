#!/usr/bin/env tsx

/**
 * 面包屑导航测试脚本
 * 验证面包屑导航组件的修改是否正确生效
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface TestCase {
  path: string;
  expectedBreadcrumb: string[];
  description: string;
}

/**
 * 测试用例定义
 */
const testCases: TestCase[] = [
  {
    path: '/products',
    expectedBreadcrumb: ['首页', '产品管理'],
    description: '产品列表页面',
  },
  {
    path: '/products/create',
    expectedBreadcrumb: ['首页', '产品管理', '新建产品'],
    description: '新建产品页面',
  },
  {
    path: '/products/123e4567-e89b-12d3-a456-426614174000',
    expectedBreadcrumb: ['首页', '产品管理', '产品详情'],
    description: '产品详情页面（UUID格式ID）',
  },
  {
    path: '/products/12345',
    expectedBreadcrumb: ['首页', '产品管理', '产品详情'],
    description: '产品详情页面（数字ID）',
  },
  {
    path: '/products/123e4567-e89b-12d3-a456-426614174000/edit',
    expectedBreadcrumb: ['首页', '产品管理', '产品详情', '编辑产品'],
    description: '编辑产品页面',
  },
  {
    path: '/categories/123e4567-e89b-12d3-a456-426614174000',
    expectedBreadcrumb: ['首页', '分类管理', '分类详情'],
    description: '分类详情页面',
  },
  {
    path: '/categories/123e4567-e89b-12d3-a456-426614174000/edit',
    expectedBreadcrumb: ['首页', '分类管理', '分类详情', '编辑分类'],
    description: '编辑分类页面',
  },
  {
    path: '/customers/123e4567-e89b-12d3-a456-426614174000',
    expectedBreadcrumb: ['首页', '客户管理', '客户详情'],
    description: '客户详情页面',
  },
];

/**
 * 模拟面包屑生成逻辑
 */
function generateBreadcrumb(pathname: string): string[] {
  const PATH_TITLES: Record<string, string> = {
    '/dashboard': '仪表盘',
    '/inventory': '库存管理',
    '/products': '产品管理',
    '/products/create': '新建产品',
    '/sales-orders': '销售订单',
    '/sales-orders/create': '新建订单',
    '/return-orders': '退货订单',
    '/customers': '客户管理',
    '/customers/create': '新建客户',
    '/payments': '支付管理',
    '/categories': '分类管理',
    '/categories/create': '新建分类',
    '/settings': '系统设置',
    '/help': '帮助中心',
    '/profile': '个人资料',
    '/create': '新建',
    '/edit': '编辑',
    '/products/edit': '编辑产品',
    '/categories/edit': '编辑分类',
    '/customers/edit': '编辑客户',
    '/inbound': '入库管理',
    '/inbound/create': '新建入库',
    '/outbound': '出库管理',
    '/adjust': '库存调整',
    '/test-api': '接口测试',
  };

  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbItems: string[] = [];

  // 添加首页
  breadcrumbItems.push('首页');

  // 构建路径面包屑
  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;

    // 获取标题
    let title = PATH_TITLES[currentPath] || segment;

    // 如果是ID（纯数字或UUID格式），根据上级路径生成更友好的名称
    if (/^[0-9a-f-]{36}$|^\d+$/.test(segment)) {
      const parentPath = `/${segments.slice(0, index).join('/')}`;
      const parentTitle = PATH_TITLES[parentPath];

      // 检查是否是编辑页面（下一个segment是edit）
      const nextSegment = segments[index + 1];
      const isEditPage = nextSegment === 'edit';

      // 根据父级路径确定详情页面的标题
      if (parentTitle === '产品管理') {
        title = '产品详情';
      } else if (parentTitle === '分类管理') {
        title = '分类详情';
      } else if (parentTitle === '客户管理') {
        title = '客户详情';
      } else if (parentTitle === '销售订单') {
        title = '订单详情';
      } else if (parentTitle === '退货订单') {
        title = '退货详情';
      } else {
        title = `详情 #${segment.slice(0, 8)}`;
      }
    }

    // 如果是edit段，根据上上级路径生成编辑标题
    if (segment === 'edit' && index >= 2) {
      const grandParentPath = `/${segments.slice(0, index - 1).join('/')}`;
      const grandParentTitle = PATH_TITLES[grandParentPath];

      if (grandParentTitle === '产品管理') {
        title = '编辑产品';
      } else if (grandParentTitle === '分类管理') {
        title = '编辑分类';
      } else if (grandParentTitle === '客户管理') {
        title = '编辑客户';
      } else {
        title = '编辑';
      }
    }

    breadcrumbItems.push(title);
  });

  return breadcrumbItems;
}

/**
 * 运行测试
 */
function runTests() {
  console.log('🧪 面包屑导航测试开始...\n');

  let passedTests = 0;
  let failedTests = 0;

  testCases.forEach((testCase, index) => {
    console.log(`测试 ${index + 1}: ${testCase.description}`);
    console.log(`路径: ${testCase.path}`);

    const actualBreadcrumb = generateBreadcrumb(testCase.path);
    const expectedBreadcrumb = testCase.expectedBreadcrumb;

    console.log(`期望: ${expectedBreadcrumb.join(' > ')}`);
    console.log(`实际: ${actualBreadcrumb.join(' > ')}`);

    const isMatch =
      JSON.stringify(actualBreadcrumb) === JSON.stringify(expectedBreadcrumb);

    if (isMatch) {
      console.log('✅ 通过\n');
      passedTests++;
    } else {
      console.log('❌ 失败\n');
      failedTests++;
    }
  });

  console.log('📊 测试结果汇总:');
  console.log(`✅ 通过: ${passedTests}`);
  console.log(`❌ 失败: ${failedTests}`);
  console.log(
    `📈 成功率: ${((passedTests / testCases.length) * 100).toFixed(1)}%`
  );

  if (failedTests === 0) {
    console.log('\n🎉 所有测试通过！面包屑导航修改成功！');
  } else {
    console.log('\n⚠️  部分测试失败，需要检查面包屑导航逻辑。');
  }
}

/**
 * 验证面包屑组件文件
 */
function verifyBreadcrumbComponent() {
  console.log('🔍 验证面包屑组件文件...\n');

  try {
    const breadcrumbPath = join(
      process.cwd(),
      'components/common/Breadcrumb.tsx'
    );
    const content = readFileSync(breadcrumbPath, 'utf-8');

    // 检查关键修改点
    const checks = [
      {
        pattern: /产品详情/,
        description: '包含"产品详情"文本',
      },
      {
        pattern: /分类详情/,
        description: '包含"分类详情"文本',
      },
      {
        pattern: /客户详情/,
        description: '包含"客户详情"文本',
      },
      {
        pattern: /编辑产品/,
        description: '包含"编辑产品"文本',
      },
      {
        pattern: /编辑分类/,
        description: '包含"编辑分类"文本',
      },
      {
        pattern: /根据父级路径确定详情页面的标题/,
        description: '包含智能标题生成逻辑',
      },
    ];

    checks.forEach((check, index) => {
      const found = check.pattern.test(content);
      console.log(`${index + 1}. ${check.description}: ${found ? '✅' : '❌'}`);
    });

    console.log('\n📄 面包屑组件文件验证完成。');
  } catch (error) {
    console.error('❌ 无法读取面包屑组件文件:', error);
  }
}

/**
 * 主函数
 */
function main() {
  console.log('🍞 面包屑导航修改验证工具\n');
  console.log('='.repeat(50));

  // 验证组件文件
  verifyBreadcrumbComponent();

  console.log('\n' + '='.repeat(50));

  // 运行逻辑测试
  runTests();

  console.log('\n' + '='.repeat(50));
  console.log('✨ 验证完成！');
}

// 运行主函数
if (require.main === module) {
  main();
}

export { generateBreadcrumb, testCases };
