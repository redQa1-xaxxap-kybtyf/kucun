#!/usr/bin/env tsx
/* eslint-disable no-console */

/**
 * 面包屑中文化测试脚本
 * 验证所有路径段都能正确显示为中文
 */

interface BreadcrumbTestCase {
  path: string;
  expectedBreadcrumbs: string[];
  description: string;
}

// 测试用例
const testCases: BreadcrumbTestCase[] = [
  {
    path: '/dashboard',
    expectedBreadcrumbs: ['首页'],
    description: '仪表盘首页',
  },
  {
    path: '/inventory',
    expectedBreadcrumbs: ['首页', '库存管理'],
    description: '库存管理页面',
  },
  {
    path: '/inventory/inbound',
    expectedBreadcrumbs: ['首页', '库存管理', '入库管理'],
    description: '入库管理页面',
  },
  {
    path: '/inventory/inbound/create',
    expectedBreadcrumbs: ['首页', '库存管理', '入库管理', '产品入库'],
    description: '产品入库页面',
  },
  {
    path: '/inventory/outbound',
    expectedBreadcrumbs: ['首页', '库存管理', '出库管理'],
    description: '出库管理页面',
  },
  {
    path: '/inventory/adjust',
    expectedBreadcrumbs: ['首页', '库存管理', '库存调整'],
    description: '库存调整页面',
  },
  {
    path: '/products',
    expectedBreadcrumbs: ['首页', '产品管理'],
    description: '产品管理页面',
  },
  {
    path: '/products/create',
    expectedBreadcrumbs: ['首页', '产品管理', '新建产品'],
    description: '新建产品页面',
  },
  {
    path: '/customers',
    expectedBreadcrumbs: ['首页', '客户管理'],
    description: '客户管理页面',
  },
  {
    path: '/customers/create',
    expectedBreadcrumbs: ['首页', '客户管理', '新建客户'],
    description: '新建客户页面',
  },
  {
    path: '/sales-orders',
    expectedBreadcrumbs: ['首页', '销售订单'],
    description: '销售订单页面',
  },
  {
    path: '/sales-orders/create',
    expectedBreadcrumbs: ['首页', '销售订单', '新建订单'],
    description: '新建销售订单页面',
  },
  {
    path: '/return-orders',
    expectedBreadcrumbs: ['首页', '退货订单'],
    description: '退货订单页面',
  },
  {
    path: '/categories',
    expectedBreadcrumbs: ['首页', '分类管理'],
    description: '分类管理页面',
  },
  {
    path: '/auth/signin',
    expectedBreadcrumbs: ['首页', '认证', '登录'],
    description: '登录页面',
  },
];

// 路径标题映射（从Breadcrumb组件复制）
const PATH_TITLES: Record<string, string> = {
  // 主要页面
  '/dashboard': '仪表盘',
  '/inventory': '库存管理',
  '/products': '产品管理',
  '/sales-orders': '销售订单',
  '/return-orders': '退货订单',
  '/customers': '客户管理',
  '/payments': '支付管理',
  '/settings': '系统设置',
  '/help': '帮助中心',
  '/profile': '个人资料',
  '/categories': '分类管理',

  // 库存管理子页面
  '/inventory/inbound': '入库管理',
  '/inventory/inbound/create': '产品入库',
  '/inventory/outbound': '出库管理',
  '/inventory/adjust': '库存调整',

  // 产品管理子页面
  '/products/create': '新建产品',
  '/products/categories': '产品分类',

  // 客户管理子页面
  '/customers/create': '新建客户',

  // 销售订单子页面
  '/sales-orders/create': '新建订单',

  // 退货订单子页面
  '/return-orders/create': '新建退货',

  // 认证相关页面
  '/auth': '认证',
  '/auth/signin': '登录',
  '/auth/register': '注册',
  '/auth/error': '认证错误',

  // 通用操作
  '/create': '新建',
  '/edit': '编辑',
  '/view': '查看',
  '/details': '详情',

  // 路径段映射（用于处理单独的路径段）
  'dashboard': '仪表盘',
  'inventory': '库存管理',
  'products': '产品管理',
  'sales-orders': '销售订单',
  'return-orders': '退货订单',
  'customers': '客户管理',
  'payments': '支付管理',
  'settings': '系统设置',
  'categories': '分类管理',
  'inbound': '入库管理',
  'outbound': '出库管理',
  'adjust': '库存调整',
  'create': '新建',
  'edit': '编辑',
  'view': '查看',
  'details': '详情',
  'auth': '认证',
  'signin': '登录',
  'register': '注册',
  'error': '错误',
};

/**
 * 模拟面包屑生成逻辑
 */
function generateBreadcrumbs(pathname: string, showHome = true): string[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbItems: string[] = [];

  // 添加首页
  if (showHome) {
    breadcrumbItems.push('首页');
  }

  // 如果当前就在仪表盘页面，不需要添加额外的路径段
  if (pathname === '/dashboard') {
    return breadcrumbItems;
  }

  // 构建路径面包屑
  let currentPath = '';
  segments.forEach((segment) => {
    currentPath += `/${segment}`;

    // 获取标题 - 优先使用完整路径映射，然后使用路径段映射
    let title = PATH_TITLES[currentPath] || PATH_TITLES[segment] || segment;

    // 如果是ID（纯数字或UUID格式），尝试获取更友好的名称
    if (/^[0-9a-f-]{36}$|^\d+$/.test(segment)) {
      title = `详情 #${segment.slice(0, 8)}`;
    }

    breadcrumbItems.push(title);
  });

  return breadcrumbItems;
}

/**
 * 运行测试
 */
function runTests() {
  console.log('🍞 开始面包屑中文化测试...\n');

  let passedTests = 0;
  let failedTests = 0;

  testCases.forEach((testCase, index) => {
    const actualBreadcrumbs = generateBreadcrumbs(testCase.path);
    const isMatch = JSON.stringify(actualBreadcrumbs) === JSON.stringify(testCase.expectedBreadcrumbs);

    if (isMatch) {
      console.log(`✅ 测试 ${index + 1}: ${testCase.description}`);
      console.log(`   路径: ${testCase.path}`);
      console.log(`   面包屑: ${actualBreadcrumbs.join(' > ')}\n`);
      passedTests++;
    } else {
      console.log(`❌ 测试 ${index + 1}: ${testCase.description}`);
      console.log(`   路径: ${testCase.path}`);
      console.log(`   期望: ${testCase.expectedBreadcrumbs.join(' > ')}`);
      console.log(`   实际: ${actualBreadcrumbs.join(' > ')}\n`);
      failedTests++;
    }
  });

  // 测试总结
  console.log('📊 测试总结:');
  console.log(`   总测试数: ${testCases.length}`);
  console.log(`   通过: ${passedTests}`);
  console.log(`   失败: ${failedTests}`);
  console.log(`   成功率: ${((passedTests / testCases.length) * 100).toFixed(1)}%`);

  if (failedTests === 0) {
    console.log('\n🎉 所有面包屑都已正确中文化！');
  } else {
    console.log('\n⚠️  部分面包屑需要进一步优化');
  }
}

// 运行测试
runTests();
