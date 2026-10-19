-- =============================================================================
-- Migration 026: User Profile Enhancements & Password Rotation Timestamps
-- DocuNexa Enterprise Document Intelligence Platform
-- Target Engine: PostgreSQL 16 LTS
-- Safeguards: Idempotent (IF NOT EXISTS), zero downtime, non-locking column additions
-- =============================================================================

-- PART 1: User Profile & Contact Information
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR(8);
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- PART 2: Employment Metadata
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(128);
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(128);
ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_name VARCHAR(128);
ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(128);
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_type VARCHAR(50) DEFAULT 'Full-time';
ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_status VARCHAR(50) DEFAULT 'Active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_joined DATE DEFAULT CURRENT_DATE;

-- PART 3: User Preferences & Visual Assets
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512);
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url VARCHAR(512);
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) DEFAULT 'America/New_York';
ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(32) DEFAULT 'English (US)';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_alerts_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS in_app_notifications_enabled BOOLEAN DEFAULT TRUE;

-- PART 4: Security Metadata
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_password_change_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- PART 5: Indexes & Constraints
CREATE INDEX IF NOT EXISTS idx_users_tenant_employee_id ON users(tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_phone ON users(tenant_id, phone_number);

-- PART 6: Backfill first_name and last_name from existing full_name
UPDATE users
SET 
  first_name = COALESCE(NULLIF(SPLIT_PART(full_name, ' ', 1), ''), 'User'),
  last_name = COALESCE(NULLIF(SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1), ''), 'Member')
WHERE first_name IS NULL;
