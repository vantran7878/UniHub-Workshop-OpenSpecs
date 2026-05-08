-- Migration: Create student_import_logs and update users table
-- Date: 2026-05-08

CREATE TABLE IF NOT EXISTS student_import_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_hash VARCHAR(64),
    total_rows INTEGER DEFAULT 0,
    inserted INTEGER DEFAULT 0,
    updated INTEGER DEFAULT 0,
    skipped INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    error_details JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    imported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add is_active to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add index for student_id lookup
CREATE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id) WHERE role = 'student';
