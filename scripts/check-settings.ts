import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSettings() {
  try {
    console.log('🔍 检查系统设置...');
    
    // 查询所有基本设置
    const settings = await prisma.systemSetting.findMany({
      where: {
        category: 'basic'
      },
      orderBy: {
        key: 'asc'
      }
    });

    console.log('\n📋 当前基本设置:');
    settings.forEach(setting => {
      console.log(`  ${setting.key}: ${setting.value} (${setting.dataType})`);
    });

    // 特别检查低库存阈值
    const lowStockThreshold = settings.find(s => s.key === 'lowStockThreshold');
    if (lowStockThreshold) {
      const value = Number(lowStockThreshold.value);
      console.log(`\n⚠️  低库存阈值当前值: ${value}`);
      
      if (value <= 0) {
        console.log('❌ 发现问题: 低库存阈值 <= 0，需要修复');
        
        // 修复为默认值 10
        await prisma.systemSetting.update({
          where: { key: 'lowStockThreshold' },
          data: { 
            value: '10',
            dataType: 'number'
          }
        });
        
        console.log('✅ 已修复: 低库存阈值设置为 10');
      } else {
        console.log('✅ 低库存阈值值正常');
      }
    } else {
      console.log('⚠️  未找到低库存阈值设置，创建默认值...');
      
      await prisma.systemSetting.create({
        data: {
          key: 'lowStockThreshold',
          value: '10',
          category: 'basic',
          description: '低库存预警阈值',
          dataType: 'number',
          isPublic: false
        }
      });
      
      console.log('✅ 已创建默认低库存阈值设置: 10');
    }

  } catch (error) {
    console.error('❌ 检查设置时出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSettings();
