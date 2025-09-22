import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('🔍 检查数据库中的用户...');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    console.log(`📊 用户总数: ${users.length}`);
    
    if (users.length > 0) {
      console.log('\n👥 用户列表:');
      users.forEach(user => {
        console.log(`  - ${user.username} (${user.email}) - ${user.role} - ${user.status}`);
      });
    } else {
      console.log('❌ 数据库中没有用户数据');
    }

  } catch (error) {
    console.error('❌ 检查用户失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
