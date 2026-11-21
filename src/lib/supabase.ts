import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const rawKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
  '';

export const isSupabaseConfigured = Boolean(
  rawUrl &&
    rawKey &&
    rawUrl.startsWith('https://') &&
    !rawUrl.includes('YOUR_SUPABASE') &&
    !rawKey.includes('YOUR_SUPABASE')
);

export const supabaseConfigDiagnostics = {
  hasUrl: Boolean(rawUrl && rawUrl.startsWith('https://')),
  hasPublishableKey: Boolean(rawKey && rawKey.length > 20),
  urlPreview: rawUrl ? `${rawUrl.slice(0, 28)}...` : 'Not configured'
};

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(rawUrl, rawKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export const SUPABASE_SQL_SCHEMA = `-- ============================================================================
-- URBANFIX CIVIC COMPLAINT MANAGEMENT SYSTEM — SUPABASE POSTGRESQL SCHEMA
-- Execute this script in the Supabase SQL Editor (Project -> SQL Editor -> New Query)
-- ============================================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. PROFILES TABLE (Strictly prevents privilege escalation by ordinary users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'citizen' CHECK (role IN ('citizen', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 3. COMPLAINTS TABLE
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL UNIQUE CHECK (reference_number ~ '^UF-[0-9]{4}-[0-9]{4}$'),
  owner_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('Roads', 'Water Supply', 'Waste Management', 'Streetlights', 'Drainage')),
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 5 AND 140),
  description TEXT NOT NULL CHECK (char_length(trim(description)) >= 15),
  locality TEXT NOT NULL CHECK (char_length(trim(locality)) >= 3),
  landmark TEXT NOT NULL CHECK (char_length(trim(landmark)) >= 3),
  image_path TEXT,
  department TEXT NOT NULL DEFAULT 'Unassigned',
  status TEXT NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'In Progress', 'Resolved', 'Reopened')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_complaints_owner ON public.complaints(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON public.complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_reference ON public.complaints(reference_number);

-- 4. STATUS HISTORY TABLE (Immutable audit trail)
CREATE TABLE IF NOT EXISTS public.status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  previous_status TEXT CHECK (previous_status IN ('Submitted', 'In Progress', 'Resolved', 'Reopened') OR previous_status IS NULL),
  new_status TEXT NOT NULL CHECK (new_status IN ('Submitted', 'In Progress', 'Resolved', 'Reopened')),
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  note TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_status_history_complaint ON public.status_history(complaint_id, timestamp DESC);

-- 5. HELPER FUNCTION: Check if current authenticated user is an administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 6. TRIGGER: Automatically create a 'citizen' profile upon Auth Sign-Up
-- Notice: Ignores any client-supplied role metadata so public users can NEVER grant themselves 'admin'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    'citizen'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. TRIGGER: Automatically record initial 'Submitted' status_history on complaint creation
CREATE OR REPLACE FUNCTION public.handle_new_complaint_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.status_history (complaint_id, previous_status, new_status, actor_id, note, timestamp)
  VALUES (NEW.id, NULL, 'Submitted', NEW.owner_user_id, 'Complaint registered by citizen via UrbanFix portal.', NEW.created_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_complaint_created ON public.complaints;
CREATE TRIGGER on_complaint_created
  AFTER INSERT ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_complaint_history();

-- 8. PRIVILEGED RPC: Admin Status & Department Update with Atomic Audit Log
CREATE OR REPLACE FUNCTION public.admin_update_complaint(
  p_complaint_id UUID,
  p_new_status TEXT,
  p_department TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS public.complaints
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_status TEXT;
  v_updated public.complaints;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only municipal administrators can modify complaint status or department assignment.';
  END IF;

  SELECT status INTO v_prev_status FROM public.complaints WHERE id = p_complaint_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Complaint not found.';
  END IF;

  UPDATE public.complaints
  SET status = p_new_status,
      department = p_department,
      updated_at = now()
  WHERE id = p_complaint_id
  RETURNING * INTO v_updated;

  INSERT INTO public.status_history (complaint_id, previous_status, new_status, actor_id, note, timestamp)
  VALUES (
    p_complaint_id,
    v_prev_status,
    p_new_status,
    auth.uid(),
    COALESCE(NULLIF(trim(p_note), ''), 'Updated status to ' || p_new_status || ' and assigned to ' || p_department),
    now()
  );

  RETURN v_updated;
END;
$$;

-- 9. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;

-- Profiles Policies: Users can read their own profile; Admins can read all profiles.
-- Users can update their own name, but NEVER their role.
CREATE POLICY "Profiles: read own or admin read all"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Profiles: update own name only"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- Complaints Policies: Citizens access ONLY their own private complaints; Admins manage all.
CREATE POLICY "Complaints: citizen select own or admin select all"
  ON public.complaints FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Complaints: citizen insert own"
  ON public.complaints FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND status = 'Submitted'
  );

CREATE POLICY "Complaints: admin update all"
  ON public.complaints FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Status History Policies: Read-only for complaint owner or admin; no direct client INSERT/UPDATE/DELETE
CREATE POLICY "Status History: select own complaint or admin"
  ON public.status_history FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = status_history.complaint_id AND c.owner_user_id = auth.uid()
    )
  );

-- 10. PRIVATE STORAGE BUCKET FOR COMPLAINT IMAGES
INSERT INTO storage.buckets (id, name, public)
VALUES ('complaint-images', 'complaint-images', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Storage: citizens upload to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'complaint-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Storage: owner or admin view private images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'complaint-images'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );
`;
