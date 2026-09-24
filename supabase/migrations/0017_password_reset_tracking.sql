-- Migration: Add support for password reset functionality
-- This migration adds tables and functions to track password reset attempts
-- for audit and security purposes

-- Create a table to track password reset attempts (for audit/security)
CREATE TABLE IF NOT EXISTS public.password_reset_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  reset_type text NOT NULL CHECK (reset_type IN ('admin', 'borrower')),
  code_requested_at timestamptz NOT NULL DEFAULT now(),
  code_verified_at timestamptz,
  password_updated_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'completed', 'expired')),
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON public.password_reset_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_email ON public.password_reset_attempts(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_status ON public.password_reset_attempts(status);

-- Function to record password reset attempts
CREATE OR REPLACE FUNCTION public.record_password_reset_attempt(
  p_user_id uuid,
  p_email text,
  p_reset_type text,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  attempt_id uuid;
BEGIN
  INSERT INTO public.password_reset_attempts (
    user_id,
    email,
    reset_type,
    ip_address,
    user_agent,
    status
  ) VALUES (
    p_user_id,
    p_email,
    p_reset_type,
    p_ip_address,
    p_user_agent,
    'pending'
  )
  RETURNING id INTO attempt_id;

  -- Mark previous pending attempts as expired (to prevent multiple concurrent resets)
  UPDATE public.password_reset_attempts
  SET status = 'expired'
  WHERE user_id = p_user_id
    AND status = 'pending'
    AND id != attempt_id
    AND created_at < NOW() - INTERVAL '10 minutes';

  RETURN attempt_id;
END;
$$;

-- Function to mark reset attempt as verified
CREATE OR REPLACE FUNCTION public.mark_password_reset_verified(p_attempt_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.password_reset_attempts
  SET 
    status = 'verified',
    code_verified_at = now()
  WHERE id = p_attempt_id
    AND status = 'pending'
    AND created_at > NOW() - INTERVAL '10 minutes';

  RETURN FOUND;
END;
$$;

-- Function to mark reset attempt as completed
CREATE OR REPLACE FUNCTION public.mark_password_reset_completed(p_attempt_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.password_reset_attempts
  SET 
    status = 'completed',
    password_updated_at = now()
  WHERE id = p_attempt_id
    AND status = 'verified';

  RETURN FOUND;
END;
$$;

-- Create a view for auditing password reset attempts
CREATE OR REPLACE VIEW public.password_reset_audit AS
SELECT 
  pra.id,
  pra.user_id,
  u.email,
  u.full_name,
  u.role,
  pra.reset_type,
  pra.status,
  pra.code_requested_at,
  pra.code_verified_at,
  pra.password_updated_at,
  EXTRACT(EPOCH FROM (pra.code_verified_at - pra.code_requested_at)) as verification_time_seconds,
  pra.ip_address,
  pra.user_agent,
  pra.created_at,
  CASE 
    WHEN pra.status = 'completed' THEN 'Password reset completed'
    WHEN pra.status = 'verified' THEN 'Code verified, awaiting password update'
    WHEN pra.status = 'pending' AND pra.created_at < NOW() - INTERVAL '10 minutes' THEN 'Code expired'
    WHEN pra.status = 'pending' THEN 'Code sent, awaiting verification'
    WHEN pra.status = 'expired' THEN 'Reset cancelled'
  END as status_display
FROM public.password_reset_attempts pra
LEFT JOIN public.users u ON pra.user_id = u.id
ORDER BY pra.created_at DESC;

COMMENT ON TABLE public.password_reset_attempts IS 'Audit trail for all password reset requests';
COMMENT ON VIEW public.password_reset_audit IS 'Readable view of password reset audit trail';
COMMENT ON FUNCTION public.record_password_reset_attempt IS 'Record a new password reset request';
COMMENT ON FUNCTION public.mark_password_reset_verified IS 'Mark a password reset code as verified';
COMMENT ON FUNCTION public.mark_password_reset_completed IS 'Mark a password reset as completed';