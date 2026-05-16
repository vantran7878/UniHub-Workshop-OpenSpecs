'use server'

import { supabaseServiceRole } from '@/lib/supabase/service-role'

/**
 * Nightly Export: Fetches all students and exports them to a single CSV file.
 * Saved to Supabase Storage at 'exports/students_latest.csv'
 */
export async function exportStudentsToCSV() {
  console.log('[Export] Starting student CSV export...');
  try {
    // 1. Fetch all students
    const { data: students, error: fetchError } = await supabaseServiceRole
      .from('users')
      .select('email, full_name, student_id, role, is_active')
      .eq('role', 'student');

    if (fetchError) {
      throw new Error(`Failed to fetch students: ${fetchError.message}`);
    }

    if (!students || students.length === 0) {
      console.log('[Export] No students found to export.');
      return { success: true, message: 'No students found' };
    }

    // 2. Generate CSV
    const header = ['email', 'full_name', 'student_id', 'role', 'is_active'];
    const rows = students.map(s => {
      // Escape commas and quotes in full_name
      const escapedName = s.full_name ? `"${s.full_name.replace(/"/g, '""')}"` : '""';
      return [
        s.email,
        escapedName,
        s.student_id || '',
        s.role,
        s.is_active
      ].join(',');
    });
    
    const csvContent = [header.join(','), ...rows].join('\n');

    // 3. Upload to Supabase Storage (Bucket: 'exports')
    // We use upsert: true to ensure we always have the 'latest' file
    const { error: uploadError } = await supabaseServiceRole
      .storage
      .from('exports')
      .upload('students_latest.csv', csvContent, {
        contentType: 'text/csv',
        upsert: true
      });

    if (uploadError) {
      // If bucket doesn't exist, try to create it first
      if (uploadError.message.includes('not found') || uploadError.message.includes('bucket')) {
        console.log('[Export] Bucket "exports" not found, attempting to create...');
        const { error: bucketError } = await supabaseServiceRole.storage.createBucket('exports', {
          public: false,
          fileSizeLimit: 10485760, // 10MB
        });

        if (bucketError && !bucketError.message.includes('already exists')) {
          throw new Error(`Failed to create exports bucket: ${bucketError.message}`);
        }

        // Retry upload after bucket creation
        const { error: retryError } = await supabaseServiceRole
          .storage
          .from('exports')
          .upload('students_latest.csv', csvContent, {
            contentType: 'text/csv',
            upsert: true
          });

        if (retryError) throw retryError;
      } else {
        throw uploadError;
      }
    }

    console.log(`[Export] Successfully exported ${students.length} students to "exports/students_latest.csv"`);
    return { 
      success: true, 
      count: students.length,
      path: 'exports/students_latest.csv'
    };
  } catch (error) {
    console.error('[Export Error]', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}
