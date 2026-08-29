-- Add password column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS password TEXT DEFAULT 'password';

-- Optional: ensure all existing users have a default password if null
UPDATE public.users 
SET password = 'password' 
WHERE password IS NULL;
