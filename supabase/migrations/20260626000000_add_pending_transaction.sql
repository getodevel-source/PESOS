-- Add pending_transaction column to profiles to temporarily store natural language transaction registration states
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pending_transaction jsonb;
