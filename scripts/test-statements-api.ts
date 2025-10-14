import { getStatementsList } from '@/lib/services/finance-statistics';

async function main() {
  console.log('测试往来账单列表查询...\n');

  const result = await getStatementsList({
    page: 1,
    limit: 20,
    type: 'all',
    sortBy: 'totalAmount',
    sortOrder: 'desc',
  });

  console.log('分页信息:', result.pagination);
  console.log('\n账单数量:', result.data.length);
  console.log('\n账单列表:');
  result.data.forEach(s => {
    console.log(`- ID: ${s.id}`);
    console.log(`  名称: ${s.name}`);
    console.log(`  类型: ${s.type}`);
    console.log(`  伙伴角色: ${s.partnerRole}`);
    console.log(`  状态: ${s.status}`);
    console.log(`  总额: ${s.totalAmount}`);
    console.log(`  余额: ${s.currentBalance}`);
    console.log('');
  });

  console.log('汇总信息:', result.summary);
}

main().catch(console.error);
