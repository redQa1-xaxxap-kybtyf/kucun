/* eslint-disable no-console */
import { shippingQueryQueue } from '@/lib/queue/shipping-query-queue';
import 'dotenv/config';

async function main() {
  const counts = {
    waiting: await shippingQueryQueue.getWaitingCount(),
    active: await shippingQueryQueue.getActiveCount(),
    delayed: await shippingQueryQueue.getDelayedCount(),
    completed: await shippingQueryQueue.getCompletedCount(),
    failed: await shippingQueryQueue.getFailedCount(),
  };
  console.log('Shipping query queue counts:', counts);
  const jobs = await shippingQueryQueue.getJobs(['waiting', 'active'], 0, 10);
  console.log('Top jobs states:');
  for (const job of jobs) {
    console.log({
      id: job.id,
      name: job.name,
      data: job.data,
      state: await job.getState(),
    });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
