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

  // 2. 创建示例产品（包含JSON规格）
  console.log('📦 创建示例产品...');

  const products = await Promise.all([
    prisma.product.upsert({
      where: { code: 'TC001' },
      update: {},
      create: {
        code: 'TC001',
        name: '抛光砖',
        specification: '800x800mm',
        specifications: JSON.stringify({
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
        specification: '600x600mm',
        specifications: JSON.stringify({
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
        specification: '300x300mm',
        specifications: JSON.stringify({
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
