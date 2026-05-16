import { EmailWorker } from '../lib/rabbitmq/workers/EmailWorker';
import { AIWorker } from '../lib/rabbitmq/workers/AIWorker';
import { BatchWorker } from '../lib/rabbitmq/workers/BatchWorker';
import { ExportWorker } from '../lib/rabbitmq/workers/ExportWorker';
import { SyncWorker } from '../lib/rabbitmq/workers/SyncWorker';
import RabbitMQProvider from '../lib/rabbitmq/RabbitMQProvider';

let lastExportDate: string | null = null;
let lastSyncDate: string | null = null;

async function triggerJob(routingKey: string, type: string) {
  try {
    const provider = RabbitMQProvider.getInstance();
    const channel = await provider.getChannel();
    
    const message = {
      type,
      requestedAt: new Date().toISOString()
    };

    await channel.assertExchange('unihub_events', 'direct', { durable: true });
    channel.publish('unihub_events', routingKey, Buffer.from(JSON.stringify(message)), {
      persistent: true
    });
    
    console.log(`[Scheduler] Triggered ${type} (${routingKey})`);
  } catch (error) {
    console.error(`[Scheduler Error] Failed to trigger ${type}:`, error);
  }
}

function startScheduler() {
  console.log('[Scheduler] Background schedulers started.');
  
  // 1. Check for new external CSV files every 1 minute
  setInterval(async () => {
    await triggerJob('sync_job', 'auto_sync_check');
  }, 1 * 60 * 1000);

  // 2. Nightly Jobs
  setInterval(async () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const hour = now.getHours();
    
    // Trigger Export at 2:00 AM
    if (hour === 2 && lastExportDate !== today) {
      lastExportDate = today;
      await triggerJob('export_job', 'nightly_student_export');
    }

    // Trigger Sync at 3:00 AM
    if (hour === 3 && lastSyncDate !== today) {
      lastSyncDate = today;
      await triggerJob('sync_job', 'nightly_student_sync');
    }
  }, 60000);
}

async function main() {
  console.log('🚀 Starting UniHub Background Workers...');

  const emailWorker = new EmailWorker();
  const aiWorker = new AIWorker();
  const batchWorker = new BatchWorker();
  const exportWorker = new ExportWorker();
  const syncWorker = new SyncWorker();

  // Start all workers
  await Promise.all([
    emailWorker.start(),
    aiWorker.start(),
    batchWorker.start(),
    exportWorker.start(),
    syncWorker.start(),
  ]);

  console.log('✅ All workers are running and listening for messages.');
  
  // Start the internal scheduler
  startScheduler();
}

main().catch((error) => {
  console.error('❌ Failed to start workers:', error);
  process.exit(1);
});
