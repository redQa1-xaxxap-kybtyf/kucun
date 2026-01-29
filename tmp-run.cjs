const {
  getCustomerStatements,
} = require('./lib/services/customer-statement-service');

(async () => {
  try {
    const result = await getCustomerStatements({
      page: 1,
      pageSize: 20,
      balanceType: 'all',
      sortBy: 'customerName',
      sortOrder: 'desc',
    });
    console.log('ok', result.statements.length);
  } catch (err) {
    console.error('error', err);
  }
})();
