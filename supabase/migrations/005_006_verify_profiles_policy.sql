-- ============================================================================
-- 005_006_verify_profiles_policy.sql
-- Query verifikasi read-only untuk tabel profiles (sebelum dan setelah
-- penerapan migration 005 dan 006).
-- FILE INI HANYA BERISI QUERY READ-ONLY, TIDAK ADA MUTASI.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Kondisi awal: daftar semua kebijakan pada tabel profiles
-- ----------------------------------------------------------------------------
SELECT
  polname AS nama_policy,
  CASE polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
    ELSE polcmd::text
  END AS perintah,
  pg_get_expr(polqual, polrelid) AS using_clause,
  pg_get_expr(polwithcheck, polrelid) AS with_check_clause
FROM pg_policy
JOIN pg_class ON pg_class.oid = pg_policy.polrelid
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE pg_namespace.nspname = 'public'
  AND polrelid = 'public.profiles'::regclass
ORDER BY polname;

-- ----------------------------------------------------------------------------
-- 2. Kondisi awal: daftar fungsi role di public
-- ----------------------------------------------------------------------------
SELECT
  proname AS nama_fungsi,
  pg_get_function_identity_arguments(oid) AS argumen,
  prosecdef AS security_definer,
  proconfig AS konfigurasi_search_path,
  pg_get_userbyid(proowner) AS pemilik
FROM pg_proc
JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
WHERE pg_namespace.nspname = 'public'
  AND proname IN ('fn_is_admin', 'fn_is_teacher', 'get_current_profile')
ORDER BY proname;

-- ----------------------------------------------------------------------------
-- 3. Hak eksekusi fungsi role
-- ----------------------------------------------------------------------------
SELECT
  routine_name AS nama_fungsi,
  grantee AS peran,
  privilege_type AS hak_akses
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name IN ('fn_is_admin', 'fn_is_teacher')
ORDER BY routine_name, grantee;

-- ----------------------------------------------------------------------------
-- 4. Status RLS pada tabel profiles
-- ----------------------------------------------------------------------------
SELECT
  relname AS nama_tabel,
  relrowsecurity AS rls_aktif,
  relforcerowsecurity AS force_rls,
  pg_get_userbyid(relowner) AS pemilik_tabel
FROM pg_class
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE pg_namespace.nspname = 'public'
  AND relname = 'profiles';

-- ----------------------------------------------------------------------------
-- 5. Uji query profiles tanpa error rekursi (jalankan sebagai pengguna
--    terautentikasi dengan role yang relevan; ganti role sesuai kebutuhan)
-- ----------------------------------------------------------------------------
-- SELECT id, full_name, role FROM public.profiles LIMIT 5;

-- ----------------------------------------------------------------------------
-- 6. Verifikasi scoping guru (setelah 006 diterapkan): daftar siswa yang
--    seharusnya terlihat oleh guru tertentu (ganti 'UUID_GURU' dengan id nyata)
-- ----------------------------------------------------------------------------
-- SELECT cm.student_id, p.full_name, p.role
-- FROM public.class_members cm
-- JOIN public.profiles p ON p.id = cm.student_id
-- JOIN public.teacher_assignments ta ON ta.class_id = cm.class_id
-- WHERE ta.teacher_id = 'UUID_GURU'::uuid
--   AND ta.class_id IS NOT NULL;