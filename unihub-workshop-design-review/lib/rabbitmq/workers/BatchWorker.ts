import { BaseWorker } from '../BaseWorker';
import { supabaseServiceRole } from '@/lib/supabase/service-role';
import { parse } from 'csv-parse/sync';

export class BatchWorker extends BaseWorker {
  protected queueName = 'batch_queue';
  protected exchangeName = 'unihub_events';
  protected routingKey = 'batch_job';

  protected async process(data: any): Promise<void> {
    const { batchId, fileName } = data;

    console.log(`[BatchWorker] Processing CSV Import ${batchId}: ${fileName}`);

    try {
      // 1. Download CSV from Supabase Storage (bucket: 'imports')
      const { data: fileData, error: downloadError } = await supabaseServiceRole
        .storage
        .from('imports')
        .download(`${batchId}/${fileName}`);

      if (downloadError || !fileData) {
        throw new Error(`Failed to download CSV: ${downloadError?.message}`);
      }

      // 2. Parse CSV
      const csvContent = await fileData.text();
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true
      });

      console.log(`[BatchWorker] Found ${records.length} students to import`);

      // 3. Batch Create Users (using service role to bypass auth restrictions)
      // Note: In Supabase, creating Auth users requires specific API calls, 
      // but here we might just be importing into a 'profiles' or 'students' table.
      // Assuming 'users' table exists for profiles.
      
      const { error: insertError } = await supabaseServiceRole
        .from('users')
        .insert(records.map((r: any) => ({
          email: r.email,
          full_name: r.full_name || r.name,
          student_id: r.student_id,
          role: 'student',
          is_active: true
        })));

      if (insertError) {
        throw new Error(`Failed to insert students: ${insertError.message}`);
      }

      console.log(`[BatchWorker] CSV Import ${batchId} completed successfully.`);
    } catch (error) {
      console.error(`[BatchWorker Error] ${batchId}:`, error);
      throw error;
    }
  }
}
