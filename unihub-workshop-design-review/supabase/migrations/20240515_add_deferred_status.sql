-- Update registration_status enum to include deferred_payment
-- Run this in your Supabase SQL Editor

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'registration_status' AND e.enumlabel = 'deferred_payment'
    ) THEN
        ALTER TYPE registration_status ADD VALUE 'deferred_payment';
    END IF;
END
$$;

-- Ensure index exists for quick lookup of deferred payments
CREATE INDEX IF NOT EXISTS idx_registrations_deferred_status ON registrations(status) WHERE status = 'deferred_payment';
