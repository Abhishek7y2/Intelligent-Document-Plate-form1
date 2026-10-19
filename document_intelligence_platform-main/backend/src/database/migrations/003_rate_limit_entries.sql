-- Migration: 003_rate_limit_entries.sql
-- Description: Distributed rate limiting store table for multi-instance cluster enforcement

CREATE TABLE IF NOT EXISTS rate_limit_entries (
    key VARCHAR(255) PRIMARY KEY,
    count INT NOT NULL DEFAULT 1,
    reset_time BIGINT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_reset ON rate_limit_entries(reset_time);
