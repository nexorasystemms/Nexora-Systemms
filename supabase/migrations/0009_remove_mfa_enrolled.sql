-- 0009_remove_mfa_enrolled.sql
-- Remove the mfa_enrolled column from the users table

alter table public.users drop column if exists mfa_enrolled;
