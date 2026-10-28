-- ============================================================================
-- 006_restrict_teacher_profiles.sql
-- Batasi akses guru pada tabel profiles: guru hanya dapat membaca profil
-- siswa yang terdaftar di kelas yang ditugasinya (melalui class_members +
-- teacher_assignments) dan profil mereka sendiri.
--
-- FILE INI HANYA DISIAPKAN SECARA LOKAL. BELUM DIJALANKAN TERHADAP PRODUKSI.
-- Perlu persetujuan eksplisit sebelum diterapkan ke production.
--
-- PENTING: Skrip ini harus dijalankan melalui Supabase Studio SQL Editor
-- (bukan `supabase db query --linked`) karena CLI v2.122.0 belum terbukti
-- mendukung transaksi atomik multi-statement.
--
-- URUTAN: harus diterapkan SETELAH 005_deploy_fix_recursion.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Pre-condition checks — pastikan 005 sudah diterapkan dan kondisi siap
-- untuk menambahkan scoped teacher policy (executable DO-block)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_fn integer;
  v_pol integer;
BEGIN
  -- 1. Fungsi fn_is_teacher harus sudah ada dan SECURITY DEFINER
  --    (bukti 005 sudah diterapkan)
  SELECT count(*) INTO v_fn
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid = pr.pronamespace
  WHERE n.nspname = 'public'
    AND pr.proname = 'fn_is_teacher'
    AND pr.prosecdef = true;
  IF v_fn = 0 THEN
    RAISE EXCEPTION 'PRECONDITION FAILED: fn_is_teacher (SECURITY DEFINER) tidak ditemukan. Terapkan 005 terlebih dahulu.';
  END IF;

  -- 2. Kebijakan admin_profiles_all harus sudah ada dan menggunakan fn_is_admin()
  SELECT count(*) INTO v_pol
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'profiles'
    AND p.polname = 'admin_profiles_all';
  IF v_pol = 0 THEN
    RAISE EXCEPTION 'PRECONDITION FAILED: kebijakan admin_profiles_all tidak ditemukan pada profiles. Terapkan 005 terlebih dahulu.';
  END IF;

  -- 3. Kebijakan teacher_students_profiles harus belum ada
  --    (sengaja tidak dibuat di 005 — jika ada, ada kondisi tak terduga)
  SELECT count(*) INTO v_pol
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'profiles'
    AND p.polname = 'teacher_students_profiles';
  IF v_pol > 0 THEN
    RAISE EXCEPTION 'PRECONDITION FAILED: kebijakan teacher_students_profiles sudah ada. Gunakan skrip rollback terlebih dahului.';
  END IF;

  -- 4. Tabel class_members dan teacher_assignments harus ada
  SELECT count(*) INTO v_fn
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('class_members', 'teacher_assignments');
  IF v_fn < 2 THEN
    RAISE EXCEPTION 'PRECONDITION FAILED: tabel class_members dan/atau teacher_assignments tidak ditemukan';
  END IF;

  -- 5. RLS harus masih aktif pada profiles
  SELECT count(*) INTO v_pol
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'profiles' AND c.relrowsecurity = true;
  IF v_pol = 0 THEN
    RAISE EXCEPTION 'PRECONDITION FAILED: RLS tidak aktif pada profiles';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Mulai transaksi
-- ----------------------------------------------------------------------------
BEGIN;

-- Buat kebijakan teacher_students_profiles dengan scoping kelas/penugasan
CREATE POLICY teacher_students_profiles
ON profiles
FOR SELECT
TO authenticated
USING (
  public.fn_is_teacher()
  AND (
    -- Guru dapat membaca profil mereka sendiri (diperlukan oleh fetchProfile)
    public.profiles.id = auth.uid()
    OR
    -- Guru dapat membaca profil siswa yang terdaftar di kelas yang ditugasinya
    EXISTS (
      SELECT 1
      FROM public.class_members cm
      JOIN public.teacher_assignments ta
        ON ta.class_id = cm.class_id
       AND ta.teacher_id = auth.uid()
      WHERE cm.student_id = public.profiles.id
    )
  )
);

-- ----------------------------------------------------------------------------
-- Akhir transaksi
-- ----------------------------------------------------------------------------
COMMIT;

-- ----------------------------------------------------------------------------
-- Verifikasi pasca-penerapan: jalankan query terpisah dari
-- 005_006_verify_profiles_policy.sql setelah COMMIT
-- ----------------------------------------------------------------------------