import { BaseWorker } from '../BaseWorker';
import { syncStudentsFromCSV, checkAndSyncExternalCSVs } from '@/lib/actions/sync-students';

export class SyncWorker extends BaseWorker {
  protected queueName = 'sync_queue';
  protected exchangeName = 'unihub_events';
  protected routingKey = 'sync_job';

  protected async process(data: any): Promise<void> {
    const { type, requestedAt } = data;

    console.log(`[SyncWorker] Processing sync job: ${type} (Requested at: ${requestedAt})`);

    if (type === 'nightly_student_sync') {
      const result = await syncStudentsFromCSV();
      if (!result.success) throw new Error(`Sync failed: ${result.error}`);
      console.log(`[SyncWorker] Nightly sync completed. Count: ${result.count}`);
    }
    else if (type === 'auto_sync_check') {
      const result = await checkAndSyncExternalCSVs();
      if (!result.success) throw new Error(`Auto-sync failed: ${result.error}`);
      console.log(`[SyncWorker] Auto-sync check completed. Processed: ${result.processedCount}`);
    }
    else {
      console.warn(`[SyncWorker] Unknown sync type: ${type}`);
    }
  }
}
