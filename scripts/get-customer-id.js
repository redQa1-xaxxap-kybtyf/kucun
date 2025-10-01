const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function getCustomerId() {
  try {
    const customer = await prisma.customer.findFirst();
    if (customer) {
      console.log(customer.id);
    } else {
      console.log('NO_CUSTOMER_FOUND');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

getCustomerId();

