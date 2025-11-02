/* eslint-disable no-console, max-lines-per-function */

import {
  PrismaClient,
  type Customer,
  type Inventory,
  type Prisma,
  type Product,
  type Supplier,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

type SalesOrderWithItems = Prisma.SalesOrderGetPayload<{ include: { items: true } }>;

// 中文测试数据生成器
const ChineseDataGenerator = {
  // 中文姓氏和名字
  surnames: ['张', '王', '李', '赵', '刘', '陈', '杨', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗'],
  givenNames: ['伟', '芳', '娜', '敏', '静', '��', '磊', '洋', '艳', '勇', '涛', '明', '慧', '丽', '华', '玲', '红', '军', '杰', '娟'],

  // 中文公司名称前缀
  companyPrefixes: ['华夏', '东方', '中华', '金龙', '宏发', '华润', '中建', '中铁', '中粮', '招商', '中信', '光大', '民生', '平安', '万科', '恒大'],
  companySuffixes: ['集团', '有限公司', '股份公司', '实业', '商贸', '建材', '装饰', '工程', '贸易', '科技'],

  // 中文地址
  provinces: ['北京市', '上海市', '广东省', '浙江省', '江苏省', '山东省', '四川省', '湖北省', '湖南省', '河南省'],
  cities: ['朝阳区', '海淀区', '浦东新区', '黄浦区', '天河区', '福田区', '西湖区', '滨江区', '武侯区', '锦江区'],
  streets: ['建设路', '人民路', '解放路', '中山路', '和平路', '文化路', '工业路', '商业街', '发展大道', '创新路'],

  // 中文产品相关
  productTypes: ['瓷砖', '地板', '涂料', '门窗', '管道', '五金', '���浴', '灯具', '板材', '石材'],
  productQualities: ['优等品', '一等品', '合格品', '精品', '豪华型', '标准型', '经济型'],

  // 中文订单状态
  orderStatuses: ['草稿', '已确认', '处理中', '已发货', '已完成', '已取消'],

  // 中文支付方式
  paymentMethods: ['银行转账', '现金支付', '支付宝', '微信支付', '支票', '承兑汇票'],

  // 生成中文姓名
  generateChineseName(): string {
    const surname = this.surnames[Math.floor(Math.random() * this.surnames.length)];
    const givenName1 = this.givenNames[Math.floor(Math.random() * this.givenNames.length)];
    const givenName2 = Math.random() > 0.5 ? this.givenNames[Math.floor(Math.random() * this.givenNames.length)] : '';
    return surname + givenName1 + givenName2;
  },

  // 生成中文公司名称
  generateChineseCompanyName(): string {
    const prefix = this.companyPrefixes[Math.floor(Math.random() * this.companyPrefixes.length)];
    const type = this.companySuffixes[Math.floor(Math.random() * this.companySuffixes.length)];
    return prefix + type;
  },

  // 生成中文地址
  generateChineseAddress(): string {
    const province = this.provinces[Math.floor(Math.random() * this.provinces.length)];
    const city = this.cities[Math.floor(Math.random() * this.cities.length)];
    const street = this.streets[Math.floor(Math.random() * this.streets.length)];
    const number = Math.floor(Math.random() * 999) + 1;
    return `${province}${city}${street}${number}号`;
  },

  // 生成中文手机号
  generateChinesePhone(): string {
    const prefixes = ['138', '139', '136', '137', '135', '134', '159', '158', '157', '150', '151', '152', '188', '189', '187'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    return prefix + suffix;
  },

  // 生成中文产品名称
  generateChineseProductName(type: string): string {
    const qualities = this.productQualities;
    const quality = qualities[Math.floor(Math.random() * qualities.length)];
    const sizes = ['300x300', '600x600', '800x800', '1200x600', '600x1200'];
    const size = sizes[Math.floor(Math.random() * sizes.length)];
    return `${quality}${type}${size}mm`;
  }
};

// 工具函数
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, fractionDigits = 2): number {
  return Number((Math.random() * (max - min) + min).toFixed(fractionDigits));
}

function pickRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function pickRandomElements<T>(source: T[], min: number, max: number): T[] {
  if (source.length === 0) return [];
  const count = randomInt(min, Math.min(max, source.length));
  const shuffled = [...source].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// 中文测试数据配置
const CHINESE_SEED_CONFIG = {
  customers: 20,
  suppliers: 10,
  products: 15,
  salesOrders: 30,
  returnOrders: 10,
  inventoryBatches: 25,
};

const INVENTORY_LOCATIONS = ['A区01排', 'A区03排', 'B区05排', 'C区02排', 'D区04排', 'E区01排'];
const CHINESE_RETURN_REASONS = ['质量问题', '色差问题', '规格不符', '包装破损', '客户变更需求', '运输损坏'];

async function main() {
  console.log('🌱 开始生成中文测试数据...');

  // 1. 创建默认中文用户
  console.log('👤 创建默认用户...');

  const adminPasswordHash = await bcrypt.hash('admin123456', 10);
  const salesPasswordHash = await bcrypt.hash('sales123456', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@kucun.cn' },
    update: {},
    create: {
      email: 'admin@kucun.cn',
      username: 'admin',
      name: '系统管理员',
      passwordHash: adminPasswordHash,
      role: 'admin',
      status: 'active',
    },
  });

  const salesUser = await prisma.user.upsert({
    where: { email: 'sales@kucun.cn' },
    update: {},
    create: {
      email: 'sales@kucun.cn',
      username: 'sales',
      name: '销售经理',
      passwordHash: salesPasswordHash,
      role: 'sales',
      status: 'active',
    },
  });

  console.log(`✅ 创建用户: ${adminUser.name} (${adminUser.email})`);
  console.log(`✅ 创建用户: ${salesUser.name} (${salesUser.email})`);

  // 2. 创建中文产品
  console.log('📦 创建中文产品...');

  const chineseProducts: Product[] = [];
  for (let i = 0; i < CHINESE_SEED_CONFIG.products; i++) {
    const productType = pickRandomElement(ChineseDataGenerator.productTypes);
    const productName = ChineseDataGenerator.generateChineseProductName(productType);
    const code = `ZC${String(i + 1).padStart(3, '0')}`;

    const product = await prisma.product.create({
      data: {
        code,
        name: productName,
        specification: JSON.stringify({
          尺寸: pickRandomElement(['300x300mm', '600x600mm', '800x800mm', '1200x600mm']),
          厚度: `${randomFloat(6, 12, 1)}mm`,
          表面工艺: pickRandomElement(['抛光', '哑光', '仿古', '木纹', '石纹']),
          颜色: pickRandomElements(['白色', '灰色', '米色', '黑色', '蓝色', '棕色', '绿色'], 1, 3),
          吸水率: `${randomFloat(0.1, 0.8, 2)}%`,
          防滑等级: pickRandomElement(['R9', 'R10', 'R11', 'R12']),
          抗冻性: Math.random() > 0.3,
          耐磨度: randomInt(1, 4),
        }),
        unit: randomInt(1, 3) === 1 ? '片' : '箱',
        piecesPerUnit: randomInt(1, 10),
        weight: randomFloat(8, 25, 1),
        status: 'active',
      },
    });
    chineseProducts.push(product);
  }
  console.log(`✅ 创建产品: ${chineseProducts.length} 个`);

  // 3. 创建中文客户
  console.log('👥 创建中文客户...');

  const chineseCustomers: Customer[] = [];
  for (let i = 0; i < CHINESE_SEED_CONFIG.customers; i++) {
    const customerName = ChineseDataGenerator.generateChineseCompanyName();
    const contactPerson = ChineseDataGenerator.generateChineseName();

    const customer = await prisma.customer.create({
      data: {
        name: customerName,
        phone: ChineseDataGenerator.generateChinesePhone(),
        address: ChineseDataGenerator.generateChineseAddress(),
        extendedInfo: JSON.stringify({
          信用额度: randomInt(50000, 200000),
          付款条件: `${randomInt(15, 60)}天`,
          联系人: contactPerson,
          合作等级: pickRandomElement(['A', 'B', 'C']),
          业务类型: pickRandomElement(['批发', '零售', '工程', '代理']),
          标签: pickRandomElements(['长期合作', '��点客户', '月结', '预付款', 'VIP'], 1, 2),
        }),
      },
    });
    chineseCustomers.push(customer);
  }
  console.log(`✅ 创建客户: ${chineseCustomers.length} 个`);

  // 4. 创建中文供应商
  console.log('🏭 创建中文供应商...');

  const chineseSuppliers: Supplier[] = [];
  for (let i = 0; i < CHINESE_SEED_CONFIG.suppliers; i++) {
    const supplierName = ChineseDataGenerator.generateChineseCompanyName();

    const supplier = await prisma.supplier.create({
      data: {
        name: supplierName,
        supplierCode: `GYS${String(i + 1).padStart(4, '0')}`,
        phone: ChineseDataGenerator.generateChinesePhone(),
        address: ChineseDataGenerator.generateChineseAddress(),
        status: randomInt(1, 10) > 2 ? 'active' : 'inactive',
      },
    });
    chineseSuppliers.push(supplier);
  }
  console.log(`✅ 创建供应商: ${chineseSuppliers.length} 个`);

  // 5. 创建中文库存和入库记录
  console.log('📊 创建中文库存...');

  const chineseInventory: Inventory[] = [];
  const chineseInboundRecords = [];

  for (const product of chineseProducts) {
    const batchCount = randomInt(1, 3);
    for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
      const batchNumber = `PH${product.code}-${new Date().getFullYear()}${String(batchIndex + 1).padStart(2, '0')}`;
      const quantity = randomInt(50, 500);
      const unitCost = randomFloat(15, 120);
      const location = pickRandomElement(INVENTORY_LOCATIONS);

      // 创建库存记录
      const inventory = await prisma.inventory.create({
        data: {
          productId: product.id,
          batchNumber,
          quantity,
          reservedQuantity: randomInt(0, Math.floor(quantity / 10)),
          unitCost,
          location,
        },
      });
      chineseInventory.push(inventory);

      // 创建入库记录
      const inboundRecord = await prisma.inboundRecord.create({
        data: {
          recordNumber: `RK${new Date().getFullYear()}${String(randomInt(100000, 999999))}`,
          productId: product.id,
          quantity,
          unitCost,
          totalCost: Number((quantity * unitCost).toFixed(2)),
          location: pickRandomElement(['主仓库', '分仓库', '临时仓库', '调拨仓库']),
          reason: pickRandomElement(['采购入库', '生产入库', '调拨入库', '退货入库']),
          remarks: `${product.name}批次${batchIndex + 1}入库`,
          userId: adminUser.id,
          batchNumber,
        },
      });
      chineseInboundRecords.push(inboundRecord);
    }
  }
  console.log(`✅ 创建库存记录: ${chineseInventory.length} 条`);
  console.log(`✅ 创建入库记录: ${chineseInboundRecords.length} 条`);

  // 6. 创建中文销售订单
  console.log('📋 创建中文销售订单...');

  const chineseSalesOrders: SalesOrderWithItems[] = [];
  for (let i = 0; i < CHINESE_SEED_CONFIG.salesOrders; i++) {
    const customer = pickRandomElement(chineseCustomers);
    const itemsCount = randomInt(1, 4);
    const orderItemsData: Prisma.SalesOrderItemUncheckedCreateWithoutSalesOrderInput[] = [];
    let itemsAmount = 0;

    for (let j = 0; j < itemsCount; j++) {
      const product = pickRandomElement(chineseProducts);
      const quantity = randomInt(10, 200);
      const unitPrice = randomFloat(25, 200);
      const subtotal = Number((quantity * unitPrice).toFixed(2));
      itemsAmount += subtotal;

      orderItemsData.push({
        productId: product.id,
        productCode: product.code,
        quantity,
        unitPrice,
        subtotal,
        batchNumber: `${product.code}-${new Date().getFullYear()}`,
        colorCode: `Y${String(randomInt(1, 999)).padStart(3, '0')}`,
        productionDate: new Date(Date.now() - randomInt(30, 365) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        displayUnit: randomInt(1, 3) === 1 ? '片' : '箱',
        displayQuantity: quantity,
        piecesPerUnit: product.piecesPerUnit ?? 1,
        specification: JSON.stringify({}),
        remarks: pickRandomElement(['标准规格', '定制规格', '优质品', '特价品']),
      });
    }

    const additionalFees = Math.random() < 0.4 ? randomFloat(50, 300) : 0;
    const totalAmount = Number((itemsAmount + additionalFees).toFixed(2));
    const status = pickRandomElement(ChineseDataGenerator.orderStatuses);
    const paidAmount = status === '草稿' ? 0 : Number((totalAmount * randomFloat(0, 1)).toFixed(2));

    const order = await prisma.salesOrder.create({
      data: {
        orderNumber: `XS${new Date().getFullYear()}${String(i + 1).padStart(5, '0')}`,
        customerId: customer.id,
        userId: salesUser.id,
        status,
        orderType: 'NORMAL',
        itemsAmount,
        additionalFees,
        totalAmount,
        paidAmount,
        remarks: `${customer.name}订单 - ${pickRandomElement(['正常销售', '促销订单', '工程订单', '样品订单'])}`,
        shippedAt: (status === '已发货' || status === '已完成') ? new Date(Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000) : null,
        items: {
          create: orderItemsData,
        },
        feeItems: additionalFees > 0 ? {
          create: [{
            feeType: pickRandomElement(['shipping', 'processing', 'other']),
            feeName: pickRandomElement(['运输费', '加工费', '包装费', '服务费']),
            feeAmount: additionalFees,
            remarks: '订单附加费用',
          }],
        } : undefined,
      },
      include: {
        items: true,
      },
    });
    chineseSalesOrders.push(order);
  }
  console.log(`✅ 创建销售订单: ${chineseSalesOrders.length} 单`);

  // 7. 创建中文退货单
  console.log('🔄 创建中文退货单...');

  const chineseReturnOrders = [];
  for (let i = 0; i < CHINESE_SEED_CONFIG.returnOrders; i++) {
    if (chineseSalesOrders.length === 0) break;

    const order = pickRandomElement(chineseSalesOrders);
    if (!order.items.length) continue;

    const returnItemsData = [];
    const itemsForReturn = pickRandomElements(order.items, 1, Math.min(2, order.items.length));
    let totalReturnAmount = 0;

    for (const item of itemsForReturn) {
      const returnRatio = randomFloat(0.1, 0.8);
      const returnQuantity = Math.floor(item.quantity * returnRatio);
      const damagedQuantity = Math.floor(returnQuantity * randomFloat(0, 0.2));
      const subtotal = Number((returnQuantity * item.unitPrice).toFixed(2));
      totalReturnAmount += subtotal;

      returnItemsData.push({
        salesOrderItemId: item.id,
        productId: item.productId || chineseProducts[0].id,
        returnQuantity,
        damagedQuantity,
        originalQuantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal,
        reason: pickRandomElement(CHINESE_RETURN_REASONS),
        colorCode: item.colorCode,
        productionDate: item.productionDate,
      });
    }

    const returnStatus = pickRandomElement(['草稿', '已提交', '已审核', '处理中', '已完成', '已取消']);

    const returnOrder = await prisma.returnOrder.create({
      data: {
        returnNumber: `TH${new Date().getFullYear()}${String(i + 1).padStart(5, '0')}`,
        returnMode: 'single_order',
        salesOrderId: order.id,
        customerId: order.customerId,
        userId: adminUser.id,
        type: pickRandomElement(['quality_issue', 'wrong_product', 'customer_change', 'damage_in_transit']),
        processType: pickRandomElement(['refund', 'exchange', 'credit']),
        status: returnStatus,
        reason: `${pickRandomElement(CHINESE_RETURN_REASONS)} - 需要处理`,
        totalAmount: Number(totalReturnAmount.toFixed(2)),
        refundAmount: Number((totalReturnAmount * randomFloat(0.8, 1)).toFixed(2)),
        remarks: '客户退货申请，请及时处理',
        submittedAt: new Date(Date.now() - randomInt(1, 60) * 24 * 60 * 60 * 1000),
        approvedAt: (returnStatus === '已审核' || returnStatus === '处理中' || returnStatus === '已完成') ?
          new Date(Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000) : null,
        processedAt: (returnStatus === '处理中' || returnStatus === '已完成') ?
          new Date(Date.now() - randomInt(1, 20) * 24 * 60 * 60 * 1000) : null,
        completedAt: returnStatus === '已完成' ?
          new Date(Date.now() - randomInt(1, 10) * 24 * 60 * 60 * 1000) : null,
        items: {
          create: returnItemsData,
        },
      },
    });
    chineseReturnOrders.push(returnOrder);
  }
  console.log(`✅ 创建退货单: ${chineseReturnOrders.length} 单`);

  // 8. 创建中文出库记录
  console.log('📤 创建中文出库记录...');

  for (const order of chineseSalesOrders.filter(o => o.status === '已发货' || o.status === '已完成')) {
    if (!order.items.length) continue;

    for (const item of order.items) {
      const productId = item.productId;
      if (!productId) {
        continue;
      }
      const relatedInventory = chineseInventory.find(inv => inv.productId === productId);
      if (!relatedInventory) continue;

      const outQuantity = Math.min(item.quantity, relatedInventory.quantity);
      const unitCostValue = relatedInventory.unitCost ?? 0;

      await prisma.outboundRecord.create({
        data: {
          recordNumber: `CK${new Date().getFullYear()}${String(randomInt(100000, 999999))}`,
          productId,
          inventoryId: relatedInventory.id,
          batchNumber: relatedInventory.batchNumber ?? undefined,
          quantity: outQuantity,
          unitCost: unitCostValue,
          totalCost: Number((outQuantity * unitCostValue).toFixed(2)),
          reason: '销售出库',
          notes: `${chineseCustomers.find(c => c.id === order.customerId)?.name}订单出库`,
          customerId: order.customerId,
          salesOrderId: order.id,
          operatorId: adminUser.id,
        },
      });

      // 更新库存数量
      await prisma.inventory.update({
        where: { id: relatedInventory.id },
        data: { quantity: Math.max(relatedInventory.quantity - outQuantity, 0) },
      });
      relatedInventory.quantity = Math.max(relatedInventory.quantity - outQuantity, 0);
    }
  }

  console.log('🎉 中文测试数据生成完成！');
  console.log('\n📋 数据统计:');
  console.log(`产品: ${chineseProducts.length} 个`);
  console.log(`客户: ${chineseCustomers.length} 个`);
  console.log(`供应商: ${chineseSuppliers.length} 个`);
  console.log(`销售订单: ${chineseSalesOrders.length} 单`);
  console.log(`退货单: ${chineseReturnOrders.length} 单`);
  console.log(`库存批次: ${chineseInventory.length} 条`);
  console.log('\n👤 默认账户信息:');
  console.log('管理员账户: admin@kucun.cn / admin123456');
  console.log('销售员账户: sales@kucun.cn / sales123456');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async e => {
    console.error('❌ 中文测试数据生成失败:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
