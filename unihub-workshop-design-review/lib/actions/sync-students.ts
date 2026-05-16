'use server'

import { supabaseServiceRole } from '@/lib/supabase/service-role'
import { parse } from 'csv-parse/sync'

/**
 * Periodically checks the 'external-sync' bucket for new CSV files.
 * Processes each file found and deletes it after syncing.
 */
export async function checkAndSyncExternalCSVs() {
  console.log('[Sync] Checking for external CSV files in "external-sync" bucket...');
  try {
    const { data: files, error: listError } = await supabaseServiceRole
      .storage
      .from('external-sync')
      .list();

    if (listError) {
      if (listError.message.includes('not found')) {
        console.log('[Sync] Bucket "external-sync" not found. Attempting to create...');
        await supabaseServiceRole.storage.createBucket('external-sync', { public: false });
        return { success: true, processedCount: 0 };
      }
      throw listError;
    }

    const csvFiles = files?.filter(f => f.name.endsWith('.csv')) || [];

    if (csvFiles.length === 0) {
      console.log('[Sync] No new CSV files found.');
      return { success: true, processedCount: 0 };
    }

    console.log(`[Sync] Found ${csvFiles.length} CSV files to process.`);

    let processedCount = 0;

    for (const file of csvFiles) {
      try {
        console.log(`[Sync] Processing file: ${file.name}`);

        const { data: fileData, error: downloadError } = await supabaseServiceRole
          .storage
          .from('external-sync')
          .download(file.name);

        if (downloadError) throw downloadError;

        const csvContent = await fileData.text();
        const records = parse(csvContent, {
          columns: true,
          skip_empty_lines: true
        });

        console.log(`[Sync] Found ${records.length} records in ${file.name}. Syncing with Auth...`);

        // Process records one by one to handle Auth creation
        for (const r of records) {
          try {
            const email = r.email?.trim().toLowerCase();
            if (!email) continue;

            // 1. Check if user already exists in Auth
            let userId: string;
            const { data: existingAuth, error: authError } = await supabaseServiceRole.auth.admin.listUsers();

            // Note: listUsers is not the best for scale, but getUserByEmail might be restricted or require specific setup.
            // Better to use getUserByEmail if available on the admin client.
            const existingUser = existingAuth?.users.find(u => u.email?.toLowerCase() === email);

            if (existingUser) {
              userId = existingUser.id;
            } else {
              // 2. Create new Auth user if not exists
              const { data: newAuth, error: createError } = await supabaseServiceRole.auth.admin.createUser({
                email: email,
                password: Math.random().toString(36).slice(-12),
                email_confirm: true,
              });

              if (createError) {
                console.error(`[Sync] Failed to create auth user for ${email}:`, createError.message);
                continue;
              }
              userId = newAuth.user.id;
            }

            // 3. Upsert Profile in 'users' table
            const { error: profileError } = await supabaseServiceRole
              .from('users')
              .upsert({
                id: userId,
                email: email,
                full_name: r.full_name || r.name,
                student_id: r.student_id,
                role: r.role || 'student',
                phone: r.phone || null,
                faculty: r.faculty || null
              }, {
                onConflict: 'id'
              });

            if (profileError) {
              console.error(`[Sync] Profile upsert failed for ${email}:`, profileError.message);
            }
          } catch (recordError) {
            console.error(`[Sync] Error processing record ${r.email}:`, recordError);
          }
        }

        // 4. Remove file after processing
        const { error: deleteError } = await supabaseServiceRole
          .storage
          .from('external-sync')
          .remove([file.name]);

        if (deleteError) throw deleteError;

        console.log(`[Sync] Successfully processed and removed: ${file.name}`);
        processedCount++;
      } catch (fileError) {
        console.error(`[Sync Error] Failed to process ${file.name}:`, fileError);
      }
    }

    return { success: true, processedCount };
  } catch (error) {
    console.error('[Sync Check Error]', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Manual sync from exports bucket.
 */
export async function syncStudentsFromCSV() {
  // Reuse the logic from checkAndSyncExternalCSVs or keep simple
  // For manual sync, we assume users might already exist.
  return { success: false, error: 'Manual sync not fully implemented for Auth' };
}
