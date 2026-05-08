-- Migration: Create notification_logs and update users table for FCM
-- Date: 2026-05-08

CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    channel VARCHAR(20) NOT NULL, -- 'email', 'push'
    status VARCHAR(20) DEFAULT 'pending', -- 'sent', 'failed', 'skipped'
    retry_count INTEGER DEFAULT 0,
    error_details JSONB,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add fcm_token to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- Index for log lookups
CREATE INDEX IF NOT EXISTS idx_notification_logs_event_id ON notification_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
