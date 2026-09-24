-- Fix ID number token field type issue
-- The tokenization system generates text tokens, not UUIDs

-- Ensure the id_number_token field is text (it should already be, but let's be explicit)
ALTER TABLE public.applicants 
ALTER COLUMN id_number_token TYPE text;

-- Also ensure the document_number_token is text
ALTER TABLE public.applicants 
ALTER COLUMN document_number_token TYPE text;

-- Check if there are any existing records with invalid tokens and clean them up
UPDATE public.applicants 
SET id_number_token = null 
WHERE id_number_token ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Add a comment to clarify the field purpose
COMMENT ON COLUMN public.applicants.id_number_token IS 'Tokenized reference to encrypted ID number, format: tok_id_number_<hex>';