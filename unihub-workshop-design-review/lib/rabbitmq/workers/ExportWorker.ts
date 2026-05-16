import { BaseWorker } from '../BaseWorker';
import { exportStudentsToCSV } from '@/lib/actions/export-students';

export class ExportWorker extends BaseWorker {
  protected queueName = 'export_queue';
  protected exchangeName = 'unihub_events';
  protected routingKey = 'export_job';

  protected async process(data: any): Promise<void> {
    const { type, requestedAt } = data;

    console.log(`[ExportWorker] Processing export job: ${type} (Requested at: ${requestedAt})`);

    if (type === 'nightly_student_export') {
      const result = await exportStudentsToCSV();
      
      if (!result.success) {
        throw new Error(`Export failed: ${result.error}`);
      }
      
      console.log(`[ExportWorker] Nightly export completed. Count: ${result.count}`);
    } else {
      console.warn(`[ExportWorker] Unknown export type: ${type}`);
    }
  }
}
