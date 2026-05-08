-- Migration: Create checkins table and optimize registrations
-- Date: 2026-05-08

CREATE TABLE IF NOT EXISTS checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES registrations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    workshop_id UUID NOT NULL REFERENCES workshops(id),
    checkin_time TIMESTAMP WITH TIME ZONE NOT NULL,
    device_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_registration_checkin UNIQUE (registration_id)
);

-- Optimize lookups for check-in
CREATE INDEX IF NOT EXISTS idx_registrations_qr_code ON registrations(qr_code);
CREATE INDEX IF NOT EXISTS idx_registrations_workshop_id ON registrations(workshop_id);
