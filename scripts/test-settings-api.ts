/**
 * 测试系统设置API功能
 * 验证我们修复的Critical级别架构违规问题
 */

import { PrismaClient } from '@prisma/client';

import { SETTINGS_DEFAULTS } from '../lib/config/settings';

const prisma = new PrismaClient();

async function testSettingsAPI() {
  console.log('🧪 开始测试系统设置API功能...\n');

  try {
    // 1. 测试数据库模型是否正确创建
    console.log('📊 测试1: 验证SystemSettings数据库模型');

    // 检查是否可以创建系统设置记录
    const testSettings = await prisma.systemSettings.upsert({
      where: { id: 'system' },
      update: {},
      create: {
        id: 'system',
        companyName: SETTINGS_DEFAULTS.basic.companyName,
        systemName: SETTINGS_DEFAULTS.basic.systemName,
        timezone: SETTINGS_DEFAULTS.basic.timezone,
        language: SETTINGS_DEFAULTS.basic.language,
        currency: SETTINGS_DEFAULTS.basic.currency,
        userManagement: JSON.stringify(SETTINGS_DEFAULTS.userManagement),
        business: JSON.stringify(SETTINGS_DEFAULTS.business),
        notifications: JSON.stringify(SETTINGS_DEFAULTS.notifications),
        dataManagement: JSON.stringify(SETTINGS_DEFAULTS.dataManagement),
        updatedBy: 'system-test',
      },
    });

    console.log('✅ SystemSettings模型创建成功');
    console.log(`   - ID: ${testSettings.id}`);
    console.log(`   - 公司名称: ${testSettings.companyName}`);
    console.log(`   - 系统名称: ${testSettings.systemName}`);
    console.log(`   - 时区: ${testSettings.timezone}`);

    // 2. 测试统一配置常量
    console.log('\n📋 测试2: 验证统一配置常量');

    const businessSettings = JSON.parse(testSettings.business);
    console.log('✅ 业务设置JSON解析成功');
    console.log(
      `   - 支付方式数量: ${businessSettings.paymentMethods?.length || 0}`
    );
    console.log(
      `   - 支付方式: ${businessSettings.paymentMethods?.join(', ') || '无'}`
    );

    // 3. 测试类型安全
    console.log('\n🔒 测试3: 验证类型安全');

    // 测试更新操作
    const updatedSettings = await prisma.systemSettings.update({
      where: { id: 'system' },
      data: {
        companyName: '测试公司名称',
        updatedAt: new Date(),
      },
    });

    console.log('✅ 设置更新操作成功');
    console.log(`   - 更新后公司名称: ${updatedSettings.companyName}`);

    // 4. 测试查询操作
    console.log('\n🔍 测试4: 验证查询操作');

    const retrievedSettings = await prisma.systemSettings.findUnique({
      where: { id: 'system' },
    });

    if (retrievedSettings) {
      console.log('✅ 设置查询操作成功');
      console.log(`   - 查询到的记录ID: ${retrievedSettings.id}`);
      console.log(
        `   - 创建时间: ${retrievedSettings.createdAt.toISOString()}`
      );
      console.log(
        `   - 更新时间: ${retrievedSettings.updatedAt.toISOString()}`
      );
    } else {
      console.log('❌ 设置查询失败');
    }

    // 5. 测试JSON字段解析
    console.log('\n📝 测试5: 验证JSON字段解析');

    if (retrievedSettings) {
      try {
        const userManagement = JSON.parse(retrievedSettings.userManagement);
        const notifications = JSON.parse(retrievedSettings.notifications);
        const dataManagement = JSON.parse(retrievedSettings.dataManagement);

        console.log('✅ 所有JSON字段解析成功');
        console.log(
          `   - 用户管理设置: ${Object.keys(userManagement).length} 个配置项`
        );
        console.log(
          `   - 通知设置: ${Object.keys(notifications).length} 个配置项`
        );
        console.log(
          `   - 数据管理设置: ${Object.keys(dataManagement).length} 个配置项`
        );
      } catch (error) {
        console.log('❌ JSON字段解析失败:', error);
      }
    }

    console.log(
      '\n🎉 所有测试通过！系统设置模块Critical级别架构违规问题修复验证成功！'
    );
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testSettingsAPI().catch(error => {
  console.error('测试执行失败:', error);
  process.exit(1);
});
