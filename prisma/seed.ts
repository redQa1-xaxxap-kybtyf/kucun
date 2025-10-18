import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

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
