-- ============================================================================
-- 005_deploy_fix_recursion.sql
-- Perbaiki infinite recursion pada policy profiles (menggantikan subquery
-- rekursif dengan fungsi SECURITY DEFINER).
--
-- FILE INI HANYA DISIAPKAN SECARA LOKAL. BELUM DIJALANKAN TERHADAP PRODUKSI.
-- Perlu persetujuan eksplisit sebelum diterapkan ke production
-- (afedkpoljdrskxzddlij).
--
-- PENTING: Skrip ini harus dijalankan melalui Supabase Studio SQL Editor
-- (bukan `supabase db query --linked`) karena CLI v2.122.0 belum terbukti
-- mendukung transaksi atomik multi-statement.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Pre-condition checks (executable DO-block — akan RAISE EXCEPTION jika
-- kondisi awal tidak sesuai, sehingga tidak ada perubahan yang dilakukan)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
  v_msg text;
BEGIN
  -- 1. Tabel profiles harus ada
  SELECT count(*) INTO v_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'profiles';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'PRECONDITION FAILED: tabel public.profiles tidak ditemukan';
  END IF;

  -- 2. Ketiga policy lama harus ada (bukti kondisi awal sesuai ekspektasi)
  SELECT count(*) INTO v_count
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'profiles'
    AND p.polname IN ('admin_profiles_all', 'teacher_students_profiles', 'student_own_profile');
  IF v_count < 3 THEN
    v_msg := format('PRECONDITION FAILED: hanya ditemukan %s dari 3 kebijakan yang diharapkan pada profiles', v_count);
    RAISE EXCEPTION '%', v_msg;
  END IF;

  -- 3. RLS harus sudah aktif pada profiles
  SELECT count(*) INTO v_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'profiles' AND c.relrowsecurity = true;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'PRECONDITION FAILED: RLS tidak aktif pada profiles';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Mulai transaksi
-- ----------------------------------------------------------------------------
BEGIN;

-- 1. Fungsi pemeriksa peran admin (SECURITY DEFINER, search_path terkunci)
CREATE OR REPLACE FUNCTION public.fn_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_temp
AS $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

-- 2. Fungsi pemeriksa peran guru (SECURITY DEFINER, search_path terkunci)
CREATE OR REPLACE FUNCTION public.fn_is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_temp
AS $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'teacher'
  );
$$;

-- 3. Batasi hak eksekusi fungsi: hanya role terautentikasi
REVOKE ALL ON FUNCTION public.fn_is_admin() FROM public;
REVOKE ALL ON FUNCTION public.fn_is_teacher() FROM public;
GRANT EXECUTE ON FUNCTION public.fn_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_is_teacher() TO authenticated;

-- 4. Hapus kebijakan lama yang ber-rekursi
DROP POLICY IF EXISTS admin_profiles_all ON profiles;
DROP POLICY IF EXISTS teacher_students_profiles ON profiles;

-- 5. Buat kebijakan baru (non-rekursif, menggunakan fungsi SECURITY DEFINER)
CREATE POLICY admin_profiles_all
ON profiles
FOR ALL
TO authenticated
USING (public.fn_is_admin())
WITH CHECK (public.fn_is_admin());

-- 6. Kebijakan guru: sengaja DISEMATKAN di sini. Pembatasan guru sesuai
--    kelas/penugasan ditempatkan di migration terpisah (006) untuk menghindari
--    perubahan besar yang membutuhkan review terpisah. Di sini kebijakan guru
--    dihapus dan TIDAK dibuat pengganti segera, sehingga akses guru ke profiles
--    menjadi fail-closed (hanya profil sendiri via student_own_profile)
--    sampai migration 006 diterapkan.
--
--    catatan: student_own_profile TIDAK DIUBAH (sudah aman, non-rekursif).

-- ----------------------------------------------------------------------------
-- Akhir transaksi
-- ----------------------------------------------------------------------------
COMMIT;

-- ----------------------------------------------------------------------------
-- Verifikasi pasca-penerapan: jalankan query terpisah dari
-- 005_006_verify_profiles_policy.sql setelah COMMIT
-- ----------------------------------------------------------------------------