-- =============================================================================
-- Migration 026 Rollback: User Profile Enhancements
-- =============================================================================

DROP INDEX IF EXISTS idx_users_tenant_phone;
DROP INDEX IF EXISTS idx_users_tenant_employee_id;

ALTER TABLE users DROP COLUMN IF EXISTS last_password_change_at;
ALTER TABLE users DROP COLUMN IF EXISTS in_app_notifications_enabled;
ALTER TABLE users DROP COLUMN IF EXISTS email_alerts_enabled;
ALTER TABLE users DROP COLUMN IF EXISTS language;
ALTER TABLE users DROP COLUMN IF EXISTS timezone;
ALTER TABLE users DROP COLUMN IF EXISTS cover_url;
ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;
ALTER TABLE users DROP COLUMN IF EXISTS date_joined;
ALTER TABLE users DROP COLUMN IF EXISTS employment_status;
ALTER TABLE users DROP COLUMN IF EXISTS employee_type;
ALTER TABLE users DROP COLUMN IF EXISTS location;
ALTER TABLE users DROP COLUMN IF EXISTS manager_name;
ALTER TABLE users DROP COLUMN IF EXISTS department;
ALTER TABLE users DROP COLUMN IF EXISTS designation;
ALTER TABLE users DROP COLUMN IF EXISTS employee_id;
ALTER TABLE users DROP COLUMN IF EXISTS date_of_birth;
ALTER TABLE users DROP COLUMN IF EXISTS phone_country_code;
ALTER TABLE users DROP COLUMN IF EXISTS phone_number;
ALTER TABLE users DROP COLUMN IF EXISTS preferred_name;
ALTER TABLE users DROP COLUMN IF EXISTS last_name;
ALTER TABLE users DROP COLUMN IF EXISTS first_name;

DELETE FROM schema_migrations WHERE migration_id = '026_user_profile_enhancements.sql';
