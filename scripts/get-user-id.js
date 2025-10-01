const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function getUserId() {
  try {
    const user = await prisma.user.findFirst();
    if (user) {
      console.log(user.id);
    } else {
      console.log('NO_USER_FOUND');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

getUserId();

