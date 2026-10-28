-- 007_deploy_fix_cross_table_rls_recursion.sql
--
-- Root cause of "Profil pengguna Anda tidak dapat dimuat" AFTER login:
--
--   005 replaced the *self*-recursive profiles policies with SECURITY DEFINER
--   helpers, but the profiles policy still references class_members /
--   teacher_assignments. Those tables' own policies still inlined
--       EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND role = 'X')
--   which re-enters profiles RLS -> cycle:
--       profiles -> class_members -> profiles -> ...  = 42P17 infinite recursion
--   Result: EVERY authenticated SELECT (profiles, classes, exams, ...) raised
--   HTTP 500 for teachers/admins, so fetchProfile() returned null and the UI
--   showed the "Profil tidak dapat dimuat" screen.
--
-- The previous 005 verification was misleading: the Supabase CLI connects as
-- `postgres` (rolbypassrls = true) and the tables have relforcerowsecurity =
-- false, so the owner bypassed RLS and the query "succeeded" while a real
-- `authenticated` request still failed.
--
-- Fix (root-cause CLASS fix): replace EVERY inline profiles role-check inside a
-- policy with the SECURITY DEFINER helpers fn_is_admin() / fn_is_teacher() /
-- fn_is_student(). They read profiles as the table owner, so they do not
-- re-enter RLS. Semantics are byte-for-byte equivalent to the inline subquery.
--
-- Applied to production DB afedkpoljdrskxzddlij.

BEGIN;

-- 1) missing helper for the student role check
CREATE OR REPLACE FUNCTION public.fn_is_student()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_temp'
AS $function$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'student'
  );
$function$;

REVOKE ALL ON FUNCTION public.fn_is_student() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_is_student() TO authenticated;

-- 2) rewrite every policy that inlines a profiles role-check
DO $do$
DECLARE
  r          record;
  new_using  text;
  new_check  text;
  rewritten  integer := 0;
  p_admin    constant text := 'EXISTS\s*\(\s*SELECT 1\s+FROM profiles p\s+WHERE \(\(p\.id = auth\.uid\(\)\) AND \(p\.role = ''admin''::text\)\)\)';
  p_teacher  constant text := 'EXISTS\s*\(\s*SELECT 1\s+FROM profiles p\s+WHERE \(\(p\.id = auth\.uid\(\)\) AND \(p\.role = ''teacher''::text\)\)\)';
  p_student  constant text := 'EXISTS\s*\(\s*SELECT 1\s+FROM profiles p\s+WHERE \(\(p\.id = auth\.uid\(\)\) AND \(p\.role = ''student''::text\)\)\)';
BEGIN
  FOR r IN
    SELECT c.relname AS tbl, p.polname AS pol,
           pg_get_expr(p.polqual,      p.polrelid) AS u,
           pg_get_expr(p.polwithcheck, p.polrelid) AS w
    FROM pg_policy p
    JOIN pg_class     c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    ORDER BY c.relname, p.polname
  LOOP
    new_using := r.u;
    new_check := r.w;

    IF new_using IS NOT NULL THEN
      new_using := regexp_replace(new_using, p_admin,   'public.fn_is_admin()',   'g');
      new_using := regexp_replace(new_using, p_teacher, 'public.fn_is_teacher()', 'g');
      new_using := regexp_replace(new_using, p_student, 'public.fn_is_student()', 'g');
    END IF;
    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check, p_admin,   'public.fn_is_admin()',   'g');
      new_check := regexp_replace(new_check, p_teacher, 'public.fn_is_teacher()', 'g');
      new_check := regexp_replace(new_check, p_student, 'public.fn_is_student()', 'g');
    END IF;

    IF new_using IS DISTINCT FROM r.u THEN
      EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated USING (%s)',
                     r.pol, r.tbl, new_using);
    END IF;
    IF new_check IS DISTINCT FROM r.w THEN
      EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated WITH CHECK (%s)',
                     r.pol, r.tbl, new_check);
    END IF;
    IF new_using IS DISTINCT FROM r.u OR new_check IS DISTINCT FROM r.w THEN
      rewritten := rewritten + 1;
      RAISE NOTICE 'rewrote policy %.%', r.tbl, r.pol;
    END IF;
  END LOOP;
  RAISE NOTICE 'total policies rewritten: %', rewritten;
END
$do$;

-- 3) the one policy using the JOIN form (not matched by the EXISTS regex)
DROP POLICY IF EXISTS teacher_classes_assigned ON public.classes;
CREATE POLICY teacher_classes_assigned ON public.classes
  FOR SELECT
  TO authenticated
  USING (
    public.fn_is_teacher()
    AND EXISTS (
      SELECT 1
      FROM public.teacher_assignments ta
      WHERE ta.teacher_id = auth.uid()
        AND (ta.class_id = classes.id OR ta.subject_id IS NOT NULL)
    )
  );

-- 4) fail-closed guard: abort the whole transaction if any policy still scans
--    profiles inline (would mean the recursion class is not fully removed).
DO $guard$
DECLARE leftover text;
BEGIN
  SELECT string_agg(format('%s.%s', tablename, policyname), ', ')
    INTO leftover
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual       LIKE '%FROM profiles%'
      OR qual       LIKE '%JOIN profiles%'
      OR with_check LIKE '%FROM profiles%'
      OR with_check LIKE '%JOIN profiles%');
  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION 'RLS recursion NOT fully fixed; still inline-scanning profiles: %', leftover;
  END IF;
END
$guard$;

COMMIT;
