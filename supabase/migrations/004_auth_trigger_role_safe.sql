-- ============================================================================
-- Migration 004: Auth Trigger (role-safe)
-- ----------------------------------------------------------------------------
-- Trigger ini dipicu SECARA OTOMATIS oleh Supabase Auth saat akun pengguna
-- baru terdaftar. Profil dibuat dengan role DEFAULT 'student'.
--
-- KEAMANAN KRITIS:
--   - role HARUS default 'student'. KAMI SENGGAH memakai raw_user_meta_data
--     untuk menentukan role, karena itu memungkinkan pendaftar menjadi
--     admin/guru secara tidak sah.
--   - Nama lengkap (full_name) hanya diambil dari metadata (bukan role).
--
-- Jika ingin 'mendampingkan' role untuk guru/admin tertentu, lakukan secara
-- MANUAL via SQL di Supabase Studio (UPDATE profiles SET role = 'teacher'
-- WHERE id = '<user_id>'), jangan pernah lewat metadata pendaftaran.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fungsi untuk menangani pendaftaran pengguna baru (SAFE)
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, full_name, role, email)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    'student',  -- role selalu default student, JANGAN dari metadata
    new.email
  );
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Buat trigger otomatis di tabel auth.users
--    (jalankan sekali; migration idempotent via DROP IF EXISTS)
-- ----------------------------------------------------------------------------
drop trigger if exists "handle_new_user_trigger" on auth.users;

create trigger "handle_new_user_trigger"
  after insert
  on auth.users
  for each row
  when (new.raw_user_meta_data->>'email' is not null)
  execute function public.handle_new_user();

comment on trigger "handle_new_user_trigger" on auth.users is
  'Membuat profil otomatis dengan role student saat akun baru terdaftar. ROLE TIDAK DAPAT dipilih oleh pengguna.';
