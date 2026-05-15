import { EmailWorker } from '../lib/rabbitmq/workers/EmailWorker';
import { AIWorker } from '../lib/rabbitmq/workers/AIWorker';
import { BatchWorker } from '../lib/rabbitmq/workers/BatchWorker';

async function main() {
  console.log('🚀 Starting UniHub Background Workers...');

  const emailWorker = new EmailWorker();
  const aiWorker = new AIWorker();
  const batchWorker = new BatchWorker();

  // Start all workers
  await Promise.all([
    emailWorker.start(),
    aiWorker.start(),
    batchWorker.start(),
  ]);

  console.log('✅ All workers are running and listening for messages.');
}

main().catch((error) => {
  console.error('❌ Failed to start workers:', error);
  process.exit(1);
});
