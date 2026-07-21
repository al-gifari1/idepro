-- ==============================================================================
-- IDEpro Supabase Database Seed File
-- Creates initial admin credentials and default settings.
-- Run in your Supabase SQL Editor or let Supabase CLI run it on reset.
-- ==============================================================================

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Create variables for email and password
DO $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_email TEXT := 'admin@idepro.com';
  v_password TEXT := 'admin123';
BEGIN
  -- Insert into auth.users if the email does not already exist
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt(v_password, extensions.gen_salt('bf', 10)),
      now(),
      null,
      null,
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- Ensure profile tier is set to premium with maximum slots (5)
    UPDATE public.profiles
    SET tier = 'premium', gmail_limit = 5
    WHERE id = v_user_id;

    RAISE NOTICE 'Admin user created successfully.';
  ELSE
    RAISE NOTICE 'Admin user already exists, skipping creation.';
  END IF;
END $$;
