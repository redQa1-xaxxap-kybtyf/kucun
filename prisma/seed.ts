import { faker } from '@faker-js/faker';
import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

type BulkSeedContext = {
  adminUser: { id: string };
  salesUser: { id: string };
  baseProducts: Array<{
    id: string;
    code: string;
    piecesPerUnit: number | null;
    specification?: string | null;
  }>;
  baseCustomers: Array<{ id: string }>;
};

const BULK_CONFIG = {
  customers: 80,
  suppliers: 40,
  products: 120,
  salesOrders: 220,
  returnOrders: 90,
  refunds: 70,
};

const INVENTORY_LOCATIONS = ['A-01', 'A-03', 'B-05', 'C-02', 'D-04', 'E-01'];
const ORDER_STATUSES = [
  'draft',
  'confirmed',
  'shipped',
  'completed',
  'cancelled',
];
const RETURN_TYPES = [
  'quality_issue',
  'wrong_product',
  'customer_change',
  'damage_in_transit',
  'remaining_return',
];
const RETURN_PROCESS_TYPES = ['refund', 'exchange', 'credit'];
const REFUND_STATUSES = [
  'pending',
  'processing',
  'completed',
  'rejected',
  'cancelled',
];
const REFUND_TYPES = ['full_refund', 'partial_refund', 'exchange_refund'];
const REFUND_METHODS = ['cash', 'bank_transfer', 'original_payment', 'other'];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, fractionDigits = 2): number {
  return Number((Math.random() * (max - min) + min).toFixed(fractionDigits));
}

function pickRandomElements<T>(source: T[], min: number, max: number): T[] {
  if (source.length === 0) {
    return [];
  }
  const count = randomInt(min, Math.min(max, source.length));
  return faker.helpers.shuffle(source).slice(0, count);
}

async function generateBulkTestData({
  adminUser,
  salesUser,
  baseProducts,
  baseCustomers,
}: BulkSeedContext) {
  console.log('📈 批量生成测试数据（高容量）...');

  // 批量客户
  const extraCustomers = [];
  for (let i = 0; i < BULK_CONFIG.customers; i++) {
    const customer = await prisma.customer.create({
      data: {
        name: `${faker.company.name()} 客户${i + 1}`,
        phone: faker.phone.number({ style: 'national' }),
        address: faker.location.streetAddress(),
        extendedInfo: JSON.stringify({
          credit_limit: randomInt(30000, 150000),
          payment_terms: `${faker.number.int({ min: 15, max: 45 })}天`,
          tags: pickRandomElements(
            ['批发', '零售', '月结', '预付', '重点客户', '渠道商'],
            1,
            3
          ),
        }),
      },
    });
    extraCustomers.push(customer);
  }
  console.log(`✅ 批量创建客户 ${extraCustomers.length} 个`);

  // 批量供应商
  const extraSuppliers = [];
  for (let i = 0; i < BULK_CONFIG.suppliers; i++) {
    const supplier = await prisma.supplier.create({
      data: {
        name: `${faker.company.name()} 供应商${i + 1}`,
        supplierCode: `SUP-${String(i + 1).padStart(4, '0')}`,
        phone: faker.phone.number({ style: 'national' }),
        address: faker.location.streetAddress(),
        status: faker.helpers.arrayElement(['active', 'active', 'inactive']),
      },
    });
    extraSuppliers.push(supplier);
  }
  console.log(`✅ 批量创建供应商 ${extraSuppliers.length} 个`);

  // 批量产品
  const extraProducts = [];
  for (let i = 0; i < BULK_CONFIG.products; i++) {
    const code = `TC${String(100 + i)}`;
    const product = await prisma.product.create({
      data: {
        code,
        name: `${faker.commerce.productMaterial()} 瓷砖 ${i + 1}`,
        specification: JSON.stringify({
          size: faker.helpers.arrayElement([
            '600x600mm',
            '800x800mm',
            '300x600mm',
            '1200x600mm',
          ]),
          thickness: `${randomFloat(6, 12, 1)}mm`,
          surface: faker.helpers.arrayElement([
            'matte',
            'polished',
            'textured',
          ]),
          colors: pickRandomElements(
            ['white', 'grey', 'beige', 'black', 'blue', 'green', 'cream'],
            1,
            4
          ),
          properties: {
            water_absorption: `${randomFloat(0.1, 0.8, 2)}%`,
            slip_resistance: faker.helpers.arrayElement(['R9', 'R10', 'R11']),
            frost_resistance: faker.datatype.boolean(),
          },
        }),
        unit: faker.helpers.arrayElement(['piece', 'sheet']),
        piecesPerUnit: randomInt(1, 10),
        weight: randomFloat(8, 25, 1),
        status: 'active',
      },
    });
    extraProducts.push(product);
  }
  console.log(`✅ 批量创建产品 ${extraProducts.length} 个`);

  // 批量库存 & 入库
  const inventoryPayload: Prisma.InventoryCreateManyInput[] = [];
  const inboundPayload: Prisma.InboundRecordCreateManyInput[] = [];

  for (const product of extraProducts) {
    const batchCount = randomInt(2, 4);
    for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
      const pastDate = faker.date.past({ years: 1 });
      const batchNumber = `${product.code}-${pastDate.toISOString().slice(0, 10).replace(/-/g, '')}-${String(batchIndex + 1).padStart(3, '0')}`;
      const quantity = randomInt(40, 400);
      const unitCost = randomFloat(12, 95);
      const reserved = randomInt(0, Math.floor(quantity / 5));

      inventoryPayload.push({
        productId: product.id,
        batchNumber,
        quantity,
        reservedQuantity: reserved,
        unitCost,
        location: faker.helpers.arrayElement(INVENTORY_LOCATIONS),
      });

      inboundPayload.push({
        recordNumber: `RK-BULK-${faker.string.alphanumeric(10).toUpperCase()}`,
        productId: product.id,
        quantity,
        unitCost,
        totalCost: Number((quantity * unitCost).toFixed(2)),
        location: faker.helpers.arrayElement([
          '主仓',
          '辅仓',
          '调拨仓',
          '临时仓',
        ]),
        reason: faker.helpers.arrayElement(['purchase', 'surplus', 'transfer']),
        remarks: faker.lorem.sentence(),
        userId: adminUser.id,
        batchNumber,
        createdAt: pastDate,
        updatedAt: pastDate,
      });
    }
  }

  if (inventoryPayload.length) {
    await prisma.inventory.createMany({ data: inventoryPayload });
  }
  if (inboundPayload.length) {
    await prisma.inboundRecord.createMany({ data: inboundPayload });
  }
  console.log(`✅ 批量生成库存记录 ${inventoryPayload.length} 条`);
  console.log(`✅ 批量生成入库记录 ${inboundPayload.length} 条`);

  const allProducts = [...baseProducts, ...extraProducts];
  const allCustomers = [...baseCustomers, ...extraCustomers];

  // 批量销售订单
  const bulkOrders = [];
  for (let i = 0; i < BULK_CONFIG.salesOrders; i++) {
    const customer = faker.helpers.arrayElement(allCustomers);
    const orderType =
      extraSuppliers.length > 0 && Math.random() < 0.25 ? 'TRANSFER' : 'NORMAL';
    const itemsCount = randomInt(1, 4);
    const orderItemsData = [];

    for (let j = 0; j < itemsCount; j++) {
      const product = faker.helpers.arrayElement(allProducts);
      const quantity = randomInt(8, 250);
      const unitPrice = randomFloat(18, 180);
      const subtotal = Number((quantity * unitPrice).toFixed(2));
      orderItemsData.push({
        productId: product.id,
        productCode: product.code,
        quantity,
        unitPrice,
        subtotal,
        batchNumber: `${product.code}-${faker.string.alphanumeric(6).toUpperCase()}`,
        colorCode: `C${String(randomInt(1, 999)).padStart(3, '0')}`,
        productionDate: faker.date
          .past({ years: 2 })
          .toISOString()
          .slice(0, 10),
        displayUnit: faker.helpers.arrayElement(['件', '箱', '托']),
        displayQuantity: quantity,
        piecesPerUnit: product.piecesPerUnit ?? 1,
        specification:
          typeof product.specification === 'string'
            ? product.specification
            : null,
      });
    }

    const itemsAmount = orderItemsData.reduce(
      (sum, item) => sum + item.subtotal,
      0
    );
    const additionalFees = Math.random() < 0.45 ? randomFloat(50, 500) : 0;
    const roundingAdjustment = randomFloat(-8, 8);
    const costAmount =
      orderType === 'TRANSFER'
        ? Number((itemsAmount * randomFloat(0.55, 0.85)).toFixed(2))
        : 0;
    const profitAmount =
      orderType === 'TRANSFER'
        ? Number((itemsAmount - costAmount).toFixed(2))
        : Number((itemsAmount * randomFloat(0.15, 0.35)).toFixed(2));

    let totalAmount = Number(
      (itemsAmount + additionalFees + roundingAdjustment).toFixed(2)
    );
    if (totalAmount <= 0) {
      totalAmount = Number((itemsAmount + additionalFees).toFixed(2));
    }

    const status = faker.helpers.arrayElement(ORDER_STATUSES);
    const usePrepayment = Math.random() < 0.18;
    const prepaymentAmount = usePrepayment
      ? Math.min(
          totalAmount,
          Number((totalAmount * randomFloat(0.1, 0.4)).toFixed(2))
        )
      : 0;
    const paidRatio = status === 'completed' ? 1 : randomFloat(0.25, 0.85);
    const paidAmount =
      status === 'draft'
        ? 0
        : Number(Math.min(totalAmount, totalAmount * paidRatio).toFixed(2));

    const feeItemsData =
      additionalFees > 0
        ? [
            {
              feeType: faker.helpers.arrayElement([
                'shipping',
                'processing',
                'other',
              ]),
              feeName: faker.commerce.productMaterial(),
              feeAmount: additionalFees,
              remarks: faker.lorem.words(4),
            },
          ]
        : [];

    const supplier =
      orderType === 'TRANSFER' && extraSuppliers.length
        ? faker.helpers.arrayElement(extraSuppliers)
        : null;

    const order = await prisma.salesOrder.create({
      data: {
        orderNumber: `SO-BULK-${String(i + 1).padStart(6, '0')}`,
        customerId: customer.id,
        userId: salesUser.id,
        supplierId: supplier?.id,
        status,
        orderType,
        itemsAmount,
        additionalFees,
        totalAmount,
        paidAmount,
        roundingAdjustment,
        costAmount,
        profitAmount,
        usePrepayment,
        prepaymentAmount,
        remarks: faker.commerce.productDescription(),
        shippedAt:
          status === 'shipped' || status === 'completed'
            ? faker.date.recent({ days: 90 })
            : null,
        items: {
          create: orderItemsData,
        },
        feeItems: feeItemsData.length
          ? {
              create: feeItemsData,
            }
          : undefined,
      },
      include: {
        items: true,
      },
    });

    bulkOrders.push(order);
  }
  console.log(`✅ 批量创建销售订单 ${bulkOrders.length} 单`);

  // 批量退货单
  const bulkReturnOrders = [];
  for (let i = 0; i < BULK_CONFIG.returnOrders; i++) {
    const order = faker.helpers.arrayElement(bulkOrders);
    if (!order.items.length) {
      continue;
    }

    const itemsForReturn = pickRandomElements(
      order.items,
      1,
      Math.min(3, order.items.length)
    );

    const returnItemsData = itemsForReturn.map(item => {
      const returnRatio = randomFloat(0.1, 0.6);
      const baseQty = Number((item.quantity * returnRatio).toFixed(2));
      const returnQuantity = Number(
        Math.min(item.quantity, Math.max(0.5, baseQty)).toFixed(2)
      );
      const damagedQuantity = Number(
        Math.min(returnQuantity, returnQuantity * randomFloat(0, 0.15)).toFixed(
          2
        )
      );
      const subtotal = Number(
        (returnQuantity * Number(item.unitPrice)).toFixed(2)
      );
      return {
        salesOrderItemId: item.id,
        productId: item.productId ?? allProducts[0].id,
        colorCode: item.colorCode,
        productionDate: item.productionDate,
        returnQuantity,
        damagedQuantity,
        originalQuantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal,
        reason: faker.helpers.arrayElement([
          '色差',
          '破损',
          '规格不符',
          '客户要求变更',
        ]),
      };
    });

    const totalReturnAmount = returnItemsData.reduce(
      (sum, item) => sum + item.subtotal,
      0
    );
    const returnStatus = faker.helpers.arrayElement([
      'draft',
      'submitted',
      'approved',
      'processing',
      'completed',
      'cancelled',
    ]);

    const approvedAt =
      returnStatus === 'approved' ||
      returnStatus === 'processing' ||
      returnStatus === 'completed'
        ? faker.date.recent({ days: 70 })
        : null;
    const processedAt =
      returnStatus === 'processing' || returnStatus === 'completed'
        ? faker.date.recent({ days: 60 })
        : null;
    const completedAt =
      returnStatus === 'completed' ? faker.date.recent({ days: 45 }) : null;

    const returnOrder = await prisma.returnOrder.create({
      data: {
        returnNumber: `RT-BULK-${String(i + 1).padStart(6, '0')}`,
        returnMode: 'single_order',
        salesOrderId: order.id,
        customerId: order.customerId,
        userId: salesUser.id,
        type: faker.helpers.arrayElement(RETURN_TYPES),
        processType: faker.helpers.arrayElement(RETURN_PROCESS_TYPES),
        status: returnStatus,
        reason: faker.commerce.productDescription(),
        totalAmount: Number(totalReturnAmount.toFixed(2)),
        refundAmount: Number(
          (totalReturnAmount * randomFloat(0.5, 1)).toFixed(2)
        ),
        remarks: faker.lorem.sentence(),
        submittedAt: faker.date.recent({ days: 120 }),
        approvedAt,
        processedAt,
        completedAt,
        items: {
          create: returnItemsData,
        },
      },
      include: {
        items: true,
      },
    });

    bulkReturnOrders.push(returnOrder);
  }
  console.log(`✅ 批量创建退货单 ${bulkReturnOrders.length} 单`);

  // 批量退款记录
  let refundCount = 0;
  const refundCandidates = pickRandomElements(
    bulkReturnOrders,
    Math.min(10, bulkReturnOrders.length),
    Math.min(BULK_CONFIG.refunds, bulkReturnOrders.length)
  );
  for (const returnOrder of refundCandidates) {
    if (!returnOrder.salesOrderId) {
      continue;
    }

    const refundStatus = faker.helpers.arrayElement(REFUND_STATUSES);
    const orderRefundAmount = Number(returnOrder.refundAmount ?? 0);
    const baseRefundAmount =
      orderRefundAmount > 0 ? orderRefundAmount : randomFloat(80, 600);
    const refundAmount = Number(
      Math.max(20, baseRefundAmount).toFixed(2)
    );
    const processedAmount =
      refundStatus === 'completed'
        ? refundAmount
        : Number((refundAmount * randomFloat(0, 0.7)).toFixed(2));
    const remainingAmount = Number(
      Math.max(refundAmount - processedAmount, 0).toFixed(2)
    );

    await prisma.refundRecord.create({
      data: {
        refundNumber: `RF-BULK-${String(refundCount + 1).padStart(6, '0')}`,
        returnOrderId: returnOrder.id,
        returnOrderNumber: returnOrder.returnNumber,
        salesOrderId: returnOrder.salesOrderId,
        customerId: returnOrder.customerId,
        userId: salesUser.id,
        refundType: faker.helpers.arrayElement(REFUND_TYPES),
        refundMethod: faker.helpers.arrayElement(REFUND_METHODS),
        refundAmount,
        processedAmount,
        remainingAmount,
        refundDate: faker.date.recent({ days: 120 }),
        processedDate:
          refundStatus === 'completed' || refundStatus === 'processing'
            ? faker.date.recent({ days: 60 })
            : null,
        status: refundStatus,
        reason: faker.lorem.sentence(),
        remarks: faker.lorem.words(5),
        bankInfo: faker.finance.iban(),
      },
    });
    refundCount += 1;
  }
  console.log(`✅ 批量创建退款记录 ${refundCount} 条`);

  console.log('📊 批量测试数据生成完成');
}

async function main() {
  console.log('🌱 开始数据库种子数据初始化...');

  // 1. 创建默认管理员用户
  console.log('👤 创建默认用户...');

  const adminPasswordHash = await bcrypt.hash('admin123456', 10);
  const salesPasswordHash = await bcrypt.hash('sales123456', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@inventory.com' },
    update: {},
    create: {
      email: 'admin@inventory.com',
      username: 'admin',
      name: '系统管理员',
      passwordHash: adminPasswordHash,
      role: 'admin',
      status: 'active',
    },
  });

  const salesUser = await prisma.user.upsert({
    where: { email: 'sales@inventory.com' },
    update: {},
    create: {
      email: 'sales@inventory.com',
      username: 'sales',
      name: '销售员',
      passwordHash: salesPasswordHash,
      role: 'sales',
      status: 'active',
    },
  });

  console.log(`✅ 创建用户: ${adminUser.name} (${adminUser.email})`);
  console.log(`✅ 创建用户: ${salesUser.name} (${salesUser.email})`);

  console.log('🧹 清理历史业务数据...');
  await prisma.refundRecord.deleteMany();
  await prisma.returnOrderItem.deleteMany();
  await prisma.returnOrder.deleteMany();
  await prisma.paymentRecord.deleteMany();
  await prisma.outboundRecord.deleteMany();
  await prisma.salesOrderItem.deleteMany();
  await prisma.salesOrderFeeItem.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.inboundRecord.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.statementTransaction.deleteMany();
  await prisma.accountStatement.deleteMany();

  // 2. 创建示例产品（包含JSON规格）
  console.log('📦 创建示例产品...');

  const products = await Promise.all([
    prisma.product.upsert({
      where: { code: 'TC001' },
      update: {},
      create: {
        code: 'TC001',
        name: '抛光砖',
        specification: JSON.stringify({
          size: '800x800mm',
          thickness: '10mm',
          surface: 'polished',
          colors: ['white', 'grey', 'black'],
          properties: {
            water_absorption: '0.1%',
            slip_resistance: 'R9',
            frost_resistance: true,
          },
        }),
        unit: 'piece',
        piecesPerUnit: 4,
        weight: 15.5,
        status: 'active',
      },
    }),
    prisma.product.upsert({
      where: { code: 'TC002' },
      update: {},
      create: {
        code: 'TC002',
        name: '仿古砖',
        specification: JSON.stringify({
          size: '600x600mm',
          thickness: '9mm',
          surface: 'matte',
          colors: ['brown', 'beige', 'terracotta'],
          properties: {
            water_absorption: '0.5%',
            slip_resistance: 'R10',
            frost_resistance: true,
          },
        }),
        unit: 'piece',
        piecesPerUnit: 6,
        weight: 12.0,
        status: 'active',
      },
    }),
    prisma.product.upsert({
      where: { code: 'TC003' },
      update: {},
      create: {
        code: 'TC003',
        name: '马赛克',
        specification: JSON.stringify({
          size: '300x300mm',
          thickness: '8mm',
          surface: 'textured',
          colors: ['blue', 'green', 'mixed'],
          properties: {
            water_absorption: '0.3%',
            slip_resistance: 'R11',
            frost_resistance: true,
          },
        }),
        unit: 'sheet',
        piecesPerUnit: 1,
        weight: 8.5,
        status: 'active',
      },
    }),
  ]);

  console.log(`✅ 创建产品: ${products.map(p => p.name).join(', ')}`);

  // 3. 创建示例客户（包含JSON扩展信息）
  console.log('👥 创建示例客户...');

  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { id: 'customer-1' },
      update: {},
      create: {
        id: 'customer-1',
        name: '建材批发商A',
        phone: '13800138001',
        address: '北京市朝阳区建材市场1号',
        extendedInfo: JSON.stringify({
          credit_limit: 100000,
          payment_terms: '30天',
          preferred_delivery: {
            time: '09:00-17:00',
            address_type: 'warehouse',
          },
          tags: ['VIP', '长期合作', '批发商'],
        }),
      },
    }),
    prisma.customer.upsert({
      where: { id: 'customer-2' },
      update: {},
      create: {
        id: 'customer-2',
        name: '装修公司B',
        phone: '13900139002',
        address: '上海市浦东新区装修大厦2楼',
        extendedInfo: JSON.stringify({
          credit_limit: 50000,
          payment_terms: '15天',
          preferred_delivery: {
            time: '08:00-18:00',
            address_type: 'construction_site',
          },
          tags: ['装修公司', '月结客户'],
        }),
      },
    }),
  ]);

  console.log(`✅ 创建客户: ${customers.map(c => c.name).join(', ')}`);

  // 4. 创建初始库存
  console.log('📊 创建初始库存...');

  const inventoryRecords = await Promise.all([
    // TC001 抛光砖库存
    prisma.inventory.create({
      data: {
        productId: products[0].id,
        batchNumber: 'BATCH-2024-001',
        quantity: 100,
        reservedQuantity: 0,
      },
    }),
    prisma.inventory.create({
      data: {
        productId: products[0].id,
        batchNumber: 'BATCH-2024-002',
        quantity: 80,
        reservedQuantity: 0,
      },
    }),
    // TC002 仿古砖库存
    prisma.inventory.create({
      data: {
        productId: products[1].id,
        batchNumber: 'BATCH-2024-003',
        quantity: 150,
        reservedQuantity: 0,
      },
    }),
    // TC003 马赛克库存
    prisma.inventory.create({
      data: {
        productId: products[2].id,
        batchNumber: 'BATCH-2024-004',
        quantity: 200,
        reservedQuantity: 0,
      },
    }),
  ]);

  console.log(`✅ 创建库存记录: ${inventoryRecords.length} 条`);

  // 5. 创建入库记录
  console.log('📥 创建入库记录...');

  const inboundRecords = await Promise.all([
    prisma.inboundRecord.create({
      data: {
        recordNumber: 'RK20240115001',
        productId: products[0].id,
        quantity: 100,
        reason: 'purchase',
        remarks: '初始库存入库',
        userId: adminUser.id,
      },
    }),
    prisma.inboundRecord.create({
      data: {
        recordNumber: 'RK20240120001',
        productId: products[1].id,
        quantity: 150,
        reason: 'purchase',
        remarks: '新批次入库',
        userId: adminUser.id,
      },
    }),
  ]);

  console.log(`✅ 创建入库记录: ${inboundRecords.length} 条`);

  console.log('🧾 创建销售订单及往来记录...');

  const order1 = await prisma.salesOrder.create({
    data: {
      orderNumber: 'SO20240125001',
      customerId: customers[0].id,
      userId: salesUser.id,
      status: 'completed',
      orderType: 'NORMAL',
      itemsAmount: 980,
      additionalFees: 50,
      totalAmount: 1030,
      paidAmount: 1030,
      remarks: '首单销售，已全额结清',
      shippedAt: new Date('2024-01-25T09:00:00Z'),
      items: {
        create: [
          {
            productId: products[0].id,
            productCode: products[0].code,
            batchNumber: 'BATCH-2024-001',
            quantity: 20,
            unitPrice: 35,
            subtotal: 700,
            displayUnit: '箱',
            displayQuantity: 20,
            piecesPerUnit: 4,
            specification: '800x800mm',
            remarks: '工程用砖',
          },
          {
            productId: products[1].id,
            productCode: products[1].code,
            batchNumber: 'BATCH-2024-003',
            quantity: 10,
            unitPrice: 28,
            subtotal: 280,
            displayUnit: '箱',
            displayQuantity: 10,
            piecesPerUnit: 6,
            specification: '600x600mm',
            remarks: '样板间使用',
          },
        ],
      },
      feeItems: {
        create: [
          {
            feeType: 'shipping',
            feeName: '物流运费',
            feeAmount: 50,
            remarks: '整车配送',
          },
        ],
      },
    },
    include: {
      items: true,
    },
  });

  await prisma.paymentRecord.create({
    data: {
      paymentNumber: 'SK20240126001',
      salesOrderId: order1.id,
      customerId: customers[0].id,
      userId: adminUser.id,
      paymentType: 'order_payment',
      paymentMethod: 'bank_transfer',
      paymentAmount: 1030,
      actualPaymentAmount: 1030,
      roundingAmount: 0,
      paymentDate: new Date('2024-01-26T10:00:00Z'),
      status: 'confirmed',
      remarks: '客户转账到账',
    },
  });

  await prisma.outboundRecord.create({
    data: {
      recordNumber: 'CK20240126001',
      productId: products[0].id,
      inventoryId: inventoryRecords[0].id,
      batchNumber: 'BATCH-2024-001',
      quantity: 20,
      unitCost: 25,
      totalCost: 500,
      reason: 'sales_outbound',
      notes: '首批次发货',
      customerId: customers[0].id,
      salesOrderId: order1.id,
      operatorId: adminUser.id,
    },
  });

  await prisma.outboundRecord.create({
    data: {
      recordNumber: 'CK20240126002',
      productId: products[1].id,
      inventoryId: inventoryRecords[2].id,
      batchNumber: 'BATCH-2024-003',
      quantity: 10,
      unitCost: 18,
      totalCost: 180,
      reason: 'sales_outbound',
      notes: '一起发货',
      customerId: customers[0].id,
      salesOrderId: order1.id,
      operatorId: adminUser.id,
    },
  });

  await prisma.refundRecord.create({
    data: {
      refundNumber: 'RF20240128001',
      salesOrderId: order1.id,
      customerId: customers[0].id,
      userId: adminUser.id,
      refundType: 'partial_refund',
      refundMethod: 'bank_transfer',
      refundAmount: 120,
      processedAmount: 120,
      remainingAmount: 0,
      refundDate: new Date('2024-01-28T11:00:00Z'),
      processedDate: new Date('2024-01-28T12:00:00Z'),
      status: 'completed',
      reason: '运费补差',
      remarks: '客户要求运费补差',
    },
  });

  await prisma.inventory.update({
    where: { id: inventoryRecords[0].id },
    data: { quantity: inventoryRecords[0].quantity - 20 },
  });
  await prisma.inventory.update({
    where: { id: inventoryRecords[2].id },
    data: { quantity: inventoryRecords[2].quantity - 10 },
  });

  const order2 = await prisma.salesOrder.create({
    data: {
      orderNumber: 'SO20240205001',
      customerId: customers[1].id,
      userId: salesUser.id,
      status: 'shipped',
      orderType: 'NORMAL',
      itemsAmount: 600,
      additionalFees: 20,
      totalAmount: 620,
      paidAmount: 300,
      remarks: '部分发货，待尾款',
      shippedAt: new Date('2024-02-05T09:30:00Z'),
      items: {
        create: [
          {
            productId: products[2].id,
            productCode: products[2].code,
            batchNumber: 'BATCH-2024-004',
            quantity: 30,
            unitPrice: 20,
            subtotal: 600,
            displayUnit: '箱',
            displayQuantity: 30,
            piecesPerUnit: 1,
            specification: '300x300mm',
            remarks: '酒店公共区域',
          },
        ],
      },
      feeItems: {
        create: [
          {
            feeType: 'processing',
            feeName: '切割加工费',
            feeAmount: 20,
            remarks: '指定尺寸裁切',
          },
        ],
      },
    },
    include: {
      items: true,
    },
  });

  await prisma.paymentRecord.create({
    data: {
      paymentNumber: 'SK20240206001',
      salesOrderId: order2.id,
      customerId: customers[1].id,
      userId: salesUser.id,
      paymentType: 'order_payment',
      paymentMethod: 'cash',
      paymentAmount: 300,
      actualPaymentAmount: 300,
      roundingAmount: 0,
      paymentDate: new Date('2024-02-06T14:20:00Z'),
      status: 'confirmed',
      remarks: '现场收取定金',
    },
  });

  await prisma.outboundRecord.create({
    data: {
      recordNumber: 'CK20240206001',
      productId: products[2].id,
      inventoryId: inventoryRecords[3].id,
      batchNumber: 'BATCH-2024-004',
      quantity: 20,
      unitCost: 12,
      totalCost: 240,
      reason: 'sales_outbound',
      notes: '先发部分现场铺设',
      customerId: customers[1].id,
      salesOrderId: order2.id,
      operatorId: adminUser.id,
    },
  });

  await prisma.inventory.update({
    where: { id: inventoryRecords[3].id },
    data: { quantity: inventoryRecords[3].quantity - 20 },
  });

  const returnOrder = await prisma.returnOrder.create({
    data: {
      returnNumber: 'TH20240210001',
      returnMode: 'single_order',
      salesOrderId: order2.id,
      customerId: customers[1].id,
      userId: adminUser.id,
      type: 'quality_issue',
      processType: 'refund',
      status: 'processing',
      reason: '部分色差问题',
      totalAmount: 200,
      refundAmount: 200,
      submittedAt: new Date('2024-02-10T08:30:00Z'),
      items: {
        create: [
          {
            salesOrderItemId: order2.items[0].id,
            productId: products[2].id,
            returnQuantity: 10,
            damagedQuantity: 0,
            originalQuantity: 30,
            unitPrice: 20,
            subtotal: 200,
            reason: '局部色差需要退换',
          },
        ],
      },
    },
  });

  await prisma.refundRecord.create({
    data: {
      refundNumber: 'RF20240211001',
      returnOrderId: returnOrder.id,
      returnOrderNumber: returnOrder.returnNumber,
      salesOrderId: order2.id,
      customerId: customers[1].id,
      userId: adminUser.id,
      refundType: 'full_refund',
      refundMethod: 'bank_transfer',
      refundAmount: 200,
      processedAmount: 0,
      remainingAmount: 200,
      refundDate: new Date('2024-02-11T09:00:00Z'),
      status: 'pending',
      reason: '等待财务审核退款',
      remarks: '待客户确认退款账号',
    },
  });

  console.log('✅ 创建销售订单及往来记录');

  // 6. 创建往来账单数据
  console.log('💰 创建往来账单数据...');

  // 为客户A创建账单
  const statement1 = await prisma.accountStatement.create({
    data: {
      entityId: customers[0].id,
      entityName: customers[0].name,
      entityType: 'customer',
      partnerRole: 'customer',
      totalOrders: 1,
      totalAmount: 1030,
      paidAmount: 1030,
      pendingAmount: 0,
      currentBalance: 0,
      overdueAmount: 0,
      creditLimit: 100000,
      paymentTerms: '30天',
      status: 'active',
      lastTransactionDate: new Date('2024-01-28T12:00:00Z'),
      lastPaymentDate: new Date('2024-01-26T10:00:00Z'),
    },
  });

  // 客户A的交易记录
  await prisma.statementTransaction.createMany({
    data: [
      // 销售订单
      {
        statementId: statement1.id,
        transactionType: 'sale',
        direction: 'debit',
        referenceId: order1.id,
        referenceNumber: order1.orderNumber,
        debitAmount: 1030,
        creditAmount: 0,
        amount: 1030,
        beforeBalance: 0,
        balance: 1030,
        afterBalance: 1030,
        description: '销售订单 - 首单销售',
        transactionDate: new Date('2024-01-25T09:00:00Z'),
        dueDate: new Date('2024-02-24T09:00:00Z'),
        status: 'completed',
        metadata: JSON.stringify({ orderType: 'NORMAL' }),
      },
      // 收款记录
      {
        statementId: statement1.id,
        transactionType: 'payment_in',
        direction: 'credit',
        referenceId: 'SK20240126001',
        referenceNumber: 'SK20240126001',
        debitAmount: 0,
        creditAmount: 1030,
        amount: 1030,
        beforeBalance: 1030,
        balance: 0,
        afterBalance: 0,
        description: '收款 - 客户转账到账',
        transactionDate: new Date('2024-01-26T10:00:00Z'),
        status: 'completed',
        metadata: JSON.stringify({ paymentMethod: 'bank_transfer' }),
      },
      // 退款记录
      {
        statementId: statement1.id,
        transactionType: 'refund',
        direction: 'debit',
        referenceId: 'RF20240128001',
        referenceNumber: 'RF20240128001',
        debitAmount: 120,
        creditAmount: 0,
        amount: -120,
        beforeBalance: 0,
        balance: -120,
        afterBalance: -120,
        description: '退款 - 运费补差',
        transactionDate: new Date('2024-01-28T12:00:00Z'),
        status: 'completed',
        metadata: JSON.stringify({
          refundType: 'partial_refund',
          refundMethod: 'bank_transfer',
        }),
      },
    ],
  });

  // 为客户B创建账单
  const statement2 = await prisma.accountStatement.create({
    data: {
      entityId: customers[1].id,
      entityName: customers[1].name,
      entityType: 'customer',
      partnerRole: 'customer',
      totalOrders: 1,
      totalAmount: 620,
      paidAmount: 300,
      pendingAmount: 320,
      currentBalance: 320,
      overdueAmount: 0,
      creditLimit: 50000,
      paymentTerms: '15天',
      status: 'active',
      lastTransactionDate: new Date('2024-02-11T09:00:00Z'),
      lastPaymentDate: new Date('2024-02-06T14:20:00Z'),
    },
  });

  // 客户B的交易记录
  await prisma.statementTransaction.createMany({
    data: [
      // 销售订单
      {
        statementId: statement2.id,
        transactionType: 'sale',
        direction: 'debit',
        referenceId: order2.id,
        referenceNumber: order2.orderNumber,
        debitAmount: 620,
        creditAmount: 0,
        amount: 620,
        beforeBalance: 0,
        balance: 620,
        afterBalance: 620,
        description: '销售订单 - 部分发货，待尾款',
        transactionDate: new Date('2024-02-05T09:30:00Z'),
        dueDate: new Date('2024-02-20T09:30:00Z'),
        status: 'pending',
        metadata: JSON.stringify({ orderType: 'NORMAL' }),
      },
      // 收款记录
      {
        statementId: statement2.id,
        transactionType: 'payment_in',
        direction: 'credit',
        referenceId: 'SK20240206001',
        referenceNumber: 'SK20240206001',
        debitAmount: 0,
        creditAmount: 300,
        amount: 300,
        beforeBalance: 620,
        balance: 320,
        afterBalance: 320,
        description: '收款 - 现场收取定金',
        transactionDate: new Date('2024-02-06T14:20:00Z'),
        status: 'completed',
        metadata: JSON.stringify({ paymentMethod: 'cash' }),
      },
      // 待退款记录
      {
        statementId: statement2.id,
        transactionType: 'sales_return',
        direction: 'debit',
        referenceId: returnOrder.id,
        referenceNumber: returnOrder.returnNumber,
        debitAmount: 200,
        creditAmount: 0,
        amount: -200,
        beforeBalance: 320,
        balance: 120,
        afterBalance: 120,
        description: '退货 - 部分色差问题',
        transactionDate: new Date('2024-02-11T09:00:00Z'),
        status: 'pending',
        metadata: JSON.stringify({
          returnType: 'quality_issue',
          processType: 'refund',
        }),
      },
    ],
  });

  console.log(
    `✅ 创建往来账单: ${statement1.entityName}, ${statement2.entityName}`
  );

  await generateBulkTestData({
    adminUser,
    salesUser,
    baseProducts: products,
    baseCustomers: customers,
  });

  console.log('🎉 数据库种子数据初始化完成！');
  console.log('\n📋 默认账户信息:');
  console.log('管理员账户: admin@inventory.com / admin123456');
  console.log('销售员账户: sales@inventory.com / sales123456');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async e => {
    console.error('❌ 种子数据初始化失败:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
