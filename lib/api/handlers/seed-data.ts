import { prisma } from '@/lib/db';

/**
 * 清理测试数据
 */
export async function cleanupTestData() {
  // 清理现有测试数据
  await prisma.inventory.deleteMany({
    where: {
      product: {
        code: {
          startsWith: 'TEST',
        },
      },
    },
  });
  
  await prisma.productVariant.deleteMany({
    where: {
      product: {
        code: {
          startsWith: 'TEST',
        },
      },
    },
  });
  
  await prisma.product.deleteMany({
    where: {
      code: {
        startsWith: 'TEST',
      },
    },
  });

  await prisma.category.deleteMany({
    where: {
      code: {
        startsWith: 'TEST',
      },
    },
  });

  await prisma.customer.deleteMany({
    where: {
      name: {
        startsWith: '测试',
      },
    },
  });

  await prisma.supplier.deleteMany({
    where: {
      name: {
        startsWith: '测试',
      },
    },
  });
}

/**
 * 创建测试分类
 */
export async function createTestCategories() {
  const categories = [
    { code: 'TEST-CAT-001', name: '测试分类A' },
    { code: 'TEST-CAT-002', name: '测试分类B' },
    { code: 'TEST-CAT-003', name: '测试分类C' },
  ];

  const createdCategories = [];
  for (const category of categories) {
    const created = await prisma.category.create({
      data: category,
    });
    createdCategories.push(created);
  }

  return createdCategories;
}

/**
 * 创建测试产品
 */
export async function createTestProducts(categories: any[]) {
  const products = [
    {
      code: 'TEST-PROD-001',
      name: '测试产品A',
      specification: '规格A',
      unit: '件',
      piecesPerUnit: 1,
      weight: 1.5,
      thickness: 0.5,
      categoryId: categories[0].id,
    },
    {
      code: 'TEST-PROD-002',
      name: '测试产品B',
      specification: '规格B',
      unit: '箱',
      piecesPerUnit: 10,
      weight: 2.0,
      thickness: 1.0,
      categoryId: categories[1].id,
    },
    {
      code: 'TEST-PROD-003',
      name: '测试产品C',
      specification: '规格C',
      unit: '包',
      piecesPerUnit: 5,
      weight: 0.8,
      thickness: 0.3,
      categoryId: categories[2].id,
    },
  ];

  const createdProducts = [];
  for (const product of products) {
    const created = await prisma.product.create({
      data: product,
    });
    createdProducts.push(created);
  }

  return createdProducts;
}

/**
 * 创建测试产品变体
 */
export async function createTestProductVariants(products: any[]) {
  const variants = [];
  
  for (const product of products) {
    const productVariants = [
      {
        productId: product.id,
        sku: `${product.code}-RED`,
        colorCode: 'RED',
        productionDate: new Date('2024-01-15'),
      },
      {
        productId: product.id,
        sku: `${product.code}-BLUE`,
        colorCode: 'BLUE',
        productionDate: new Date('2024-01-20'),
      },
    ];

    for (const variant of productVariants) {
      const created = await prisma.productVariant.create({
        data: variant,
      });
      variants.push(created);
    }
  }

  return variants;
}

/**
 * 创建测试客户
 */
export async function createTestCustomers() {
  const customers = [
    {
      name: '测试客户A',
      phone: '13800138001',
      email: 'customer-a@test.com',
      address: '测试地址A',
      contactPerson: '张三',
    },
    {
      name: '测试客户B',
      phone: '13800138002',
      email: 'customer-b@test.com',
      address: '测试地址B',
      contactPerson: '李四',
    },
    {
      name: '测试客户C',
      phone: '13800138003',
      email: 'customer-c@test.com',
      address: '测试地址C',
      contactPerson: '王五',
    },
  ];

  const createdCustomers = [];
  for (const customer of customers) {
    const created = await prisma.customer.create({
      data: customer,
    });
    createdCustomers.push(created);
  }

  return createdCustomers;
}

/**
 * 创建测试供应商
 */
export async function createTestSuppliers() {
  const suppliers = [
    {
      name: '测试供应商A',
      phone: '13900139001',
      email: 'supplier-a@test.com',
      address: '测试供应商地址A',
      contactPerson: '赵六',
    },
    {
      name: '测试供应商B',
      phone: '13900139002',
      email: 'supplier-b@test.com',
      address: '测试供应商地址B',
      contactPerson: '钱七',
    },
  ];

  const createdSuppliers = [];
  for (const supplier of suppliers) {
    const created = await prisma.supplier.create({
      data: supplier,
    });
    createdSuppliers.push(created);
  }

  return createdSuppliers;
}

/**
 * 创建测试库存记录
 */
export async function createTestInventory(products: any[], variants: any[]) {
  const inventoryRecords = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const productVariants = variants.filter(v => v.productId === product.id);

    for (const variant of productVariants) {
      const inventory = await prisma.inventory.create({
        data: {
          productId: product.id,
          variantId: variant.id,
          batchNumber: `BATCH-${product.code}-${variant.colorCode}-001`,
          quantity: Math.floor(Math.random() * 100) + 10,
          reservedQuantity: Math.floor(Math.random() * 10),
        },
      });
      inventoryRecords.push(inventory);
    }
  }

  return inventoryRecords;
}

/**
 * 生成完整的测试数据集
 */
export async function generateTestDataSet() {
  // 1. 清理现有测试数据
  await cleanupTestData();

  // 2. 创建测试分类
  const categories = await createTestCategories();

  // 3. 创建测试产品
  const products = await createTestProducts(categories);

  // 4. 创建测试产品变体
  const variants = await createTestProductVariants(products);

  // 5. 创建测试客户
  const customers = await createTestCustomers();

  // 6. 创建测试供应商
  const suppliers = await createTestSuppliers();

  // 7. 创建测试库存记录
  const inventory = await createTestInventory(products, variants);

  return {
    categories: categories.length,
    products: products.length,
    variants: variants.length,
    customers: customers.length,
    suppliers: suppliers.length,
    inventory: inventory.length,
  };
}
