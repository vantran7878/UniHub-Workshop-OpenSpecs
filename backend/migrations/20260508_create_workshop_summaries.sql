-- Migration: Create workshop_summaries table
-- Date: 2026-05-08

CREATE TYPE summary_status AS ENUM ('pending', 'processing', 'done', 'failed');

CREATE TABLE IF NOT EXISTS workshop_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workshop_id UUID NOT NULL REFERENCES workshops(id),
    pdf_file_path VARCHAR(512) NOT NULL,
    status summary_status DEFAULT 'pending',
    summary TEXT,
    error_message TEXT,
    ai_model_used VARCHAR(50),
    processing_started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_workshop_summary UNIQUE (workshop_id)
);

CREATE INDEX IF NOT EXISTS idx_workshop_summaries_workshop_id ON workshop_summaries(workshop_id);
