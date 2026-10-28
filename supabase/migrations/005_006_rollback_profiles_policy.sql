-- ============================================================================
-- 005_006_rollback_profiles_policy.sql
-- Rollback perubahan migration 005 dan 006 pada tabel profiles.
--
-- FILE INI HANYA DISIAPKAN SECARA LOKAL. BELUM DIJALANKAN TERHADAP PRODUKSI.
-- Perlu persetujuan eksplisit sebelum diterapkan ke production.
--
-- PENTING: Skrip ini harus dijalankan melalui Supabase Studio SQL Editor
-- (bukan `supabase db query --linked`) karena CLI v2.122.0 belum terbukti
-- mendukung transaksi atomik multi-statement.
--
-- Strategi ROLLBACK:
--   - Sebelum COMMIT (transaksi masih aktif): jalankan ROLLBACK; secara manual.
--   - Setelah COMMIT (transaksi sudah selesai): jalankan skrip ini.
--     Drop kebijakan baru dulu, kemudian drop fungsi. Biarkan fail-closed.
--
-- PERINGATAN: Jangan mengembalikan kebijakan rekursif lama
-- (admin_profiles_all / teacher_students_profiles dengan subquery EXISTS
-- pada profiles itu sendiri) sebagai solusi default, karena itu akan
-- memunculkan kembali infinite recursion.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Skenario A: Sebelum COMMIT (transaksi masih aktif, belum di-COMMIT)
-- ----------------------------------------------------------------------------
-- Jika migration sedang dijalankan dan belum di-COMMIT, cukup jalankan:
--   ROLLBACK;
-- Semua perubahan dalam transaksi akan dibatalkan, kondisi kembali
-- seperti sebelum migration dimulai.

-- ----------------------------------------------------------------------------
-- Skenario B: Setelah COMMIT (transaksi sudah diselesaikan)
-- ----------------------------------------------------------------------------
-- Pemulihan setelah COMMIT: jalankan skrip ini untuk memulihkan keadaan.
-- Kebijikan dan fungsi baru akan dihapus, biarkan fail-closed.

-- Pre-condition: pastikan ada yang akan di-rollback
DO $$
DECLARE
  v_fn integer;
  v_pol integer;
BEGIN
  SELECT count(*) INTO v_fn
  FROM pg_proc pr
  JOIN pg_namespace n ON n.oid = pr.pronamespace
  WHERE n.nspname = 'public'
    AND pr.proname IN ('fn_is_admin', 'fn_is_teacher');

  SELECT count(*) INTO v_pol
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'profiles'
    AND p.polname IN ('admin_profiles_all', 'teacher_students_profiles');

  IF v_fn = 0 AND v_pol = 0 THEN
    RAISE EXCEPTION 'PRECONDITION FAILED: tidak ditemukan fungsi atau kebijikan baru yang perlu di-rollback. Mungkin 005/006 belum pernah diterapkan.';
  END IF;
END $$;

-- Mulai transaksi (atomic — semua DROP akan di-commit bersama atau di-rollback)
BEGIN;

-- 1. Hapus kebijikan baru terlebih dahulu (urutan penting: kebijikan sebelum
--    fungsi agar tidak tersisa broken policy yang merujuk ke fungsi yang
--    sudah hilang)
DROP POLICY IF EXISTS admin_profiles_all ON profiles;
DROP POLICY IF EXISTS teacher_students_profiles ON profiles;

-- 2. Hapus fungsi yang ditambahkan oleh 005
--    Asumsi: tidak ada VIEW, TRIGGER, atau FUNGSI lain di database yang
--    memanggil fn_is_admin() atau fn_is_teacher(). Untuk memverifikasi
--    dependensi, jalankan sebelum rollback:
--      SELECT n.nspname, p.proname, d.refobjid::regclass
--      FROM pg_depend dep
--      JOIN pg_proc p ON p.oid = dep.objid
--      JOIN pg_namespace n ON n.oid = p.pronamespace
--      WHERE n.nspname = 'public'
--        AND p.proname IN ('fn_is_admin', 'fn_is_teacher');
--    Jika ada dependensi, gunakan CASCADE atau hapus dependensi terlebih dahulu.
DROP FUNCTION IF EXISTS public.fn_is_admin();
DROP FUNCTION IF EXISTS public.fn_is_teacher();

-- 3. student_own_profile tidak diubah oleh migration ini, tidak perlu dipulihkan.
--    Siswa tetap dapat mengakses profil sendiri setelah rollback.

COMMIT;

-- ----------------------------------------------------------------------------
-- Konsekuensi fallback fail-closed setelah rollback post-COMMIT:
--   - Admin : tidak dapat membaca/mengubah profil lain melalui RLS profiles.
--             Akses admin ke profiles terputus kecuali melalui service_role
--             atau query langsung di database sebagai superuser.
--   - Guru  : tidak dapat membaca profil siswa sama sekali. Login guru tetap
--             berfungsi (profil sendiri via student_own_profile), tetapi tidak
--             dapat melihat daftar siswa.
--   - Siswa : tidak terpengaruh — student_own_profile tetap aktif, siswa dapat
--             membaca profil sendiri.
-- ----------------------------------------------------------------------------