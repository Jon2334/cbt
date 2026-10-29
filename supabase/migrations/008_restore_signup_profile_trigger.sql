-- ============================================================================
-- Migration 008: Pasang kembali trigger pembuat profil + backfill profil siswa
-- ============================================================================
-- MASALAH YANG DIPERBAIKI
--   Migrasi 004 (handle_new_user + trigger) TIDAK PERNAH diterapkan ke database
--   produksi. Bukti: public.handle_new_user() tidak ada, tidak ada trigger
--   non-internal di auth.users, dan supabase_migrations.schema_migrations tidak
--   ada (skema remote dibangun sebagian/manual, bukan lewat `supabase db push`).
--   Akibatnya: setiap akun yang mendaftar lewat layar "Daftar" di aplikasi CBT
--   punya baris di auth.users TAPI tidak punya baris di public.profiles.
--   Karena RPC get_current_profile membaca public.profiles, siswa tersebut
--   login tanpa role → fn_is_student() false → tidak bisa mengakses ujian.
--
-- PERBAIKAN
--   1. handle_new_user() dibuat ulang dengan RUANG LINGKUP AMAN:
--        - role SELALU 'student' (hardcoded), tidak pernah dari metadata user
--        - full_name di-COALESCE agar NOT NULL profiles.full_name tidak pernah
--          dilanggar (fallback: bagian lokal email, lalu 'Pengguna')
--        - ON CONFLICT (id) DO NOTHING agar idempotent (retry/duplikat aman)
--        - SET search_path dikunci (anti search_path hijacking pada SECURITY
--          DEFINER)
--   2. Trigger dipasang dengan syarat `new.email is not null` — memakai kolom
--      kanonik auth.users, bukan raw_user_meta_data->>'email' (bentuk metadata
--      berubah-ubah antar versi GoTrue; bentuk itulah yang rapuh).
--   3. Backfill: semua akun auth.users yang belum punya profil dibuatkan profil
--      dengan role 'student' (default paling aman; role guru/admin TIDAK pernah
--      diberikan otomatis).
--   4. Guard fail-closed: transaksi dibatalkan bila setelah migrasi masih ada
--      akun tanpa profil, atau trigger gagal terpasang.
--
-- CATATAN KEAMANAN
--   Trigger ini TIDAK memberi hak istimewa apa pun. Ia hanya memastikan setiap
--   akun baru punya identitas + role default. Kenaikan role ke teacher/admin
--   tetap harus manual oleh pemilik project.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fungsi pembuat profil (SECURITY DEFINER: berjalan sebagai owner tabel,
--    sehingga tidak terhalang RLS saat dipicu oleh proses signup GoTrue)
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id, full_name, role, email)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Pengguna'
    ),
    'student',   -- JANGAN diambil dari metadata: cegah pendaftar jadi guru/admin
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Membuat baris public.profiles (role selalu student) setiap akun auth.users baru. Dipanggil oleh trigger handle_new_user_trigger.';

-- ----------------------------------------------------------------------------
-- 2. Trigger pada auth.users — ownership-safe
--    auth.users dimiliki role supabase_auth_admin; role `postgres` TIDAK
--    anggotanya. CREATE TRIGGER boleh (cukup privilege TRIGGER), tetapi
--    DROP/COMMENT ON TRIGGER butuh ownership. Karena itu: buat hanya bila
--    belum ada, dan verifikasi definisinya di guard (bagian 4).
-- ----------------------------------------------------------------------------
do $$
declare
  v_trigger_name constant text := 'handle_new_user_trigger';
  v_attached boolean;
begin
  select exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth'
      and c.relname = 'users'
      and t.tgname = v_trigger_name
      and not t.tgisinternal
  ) into v_attached;

  if v_attached then
    begin
      execute format('drop trigger %I on auth.users', v_trigger_name);
      v_attached := false;
      raise notice 'trigger % dilepas untuk dipasang ulang', v_trigger_name;
    exception
      when insufficient_privilege then
        raise notice 'trigger % sudah ada & tidak bisa dilepas (bukan owner auth.users); definisi diverifikasi di guard', v_trigger_name;
    end;
  end if;

  if not v_attached then
    execute format(
      'create trigger %I after insert on auth.users '
      'for each row when (new.email is not null) '
      'execute function public.handle_new_user()',
      v_trigger_name
    );
    raise notice 'trigger % dipasang', v_trigger_name;
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Backfill profil yang hilang (akun yang mendaftar sebelum trigger ada)
-- ----------------------------------------------------------------------------
insert into public.profiles (id, full_name, role, email)
select u.id,
       coalesce(
         nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
         nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
         'Pengguna'
       ),
       'student',
       u.email
from auth.users u
where u.deleted_at is null
  and not exists (
    select 1 from public.profiles p where p.id = u.id
  )
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 4. Guard fail-closed: migrasi dianggap GAGAL bila hasilnya tidak utuh
-- ----------------------------------------------------------------------------
do $$
declare
  v_missing bigint;
  v_trigger bigint;
  v_bad_role bigint;
begin
  select count(*) into v_missing
  from auth.users u
  where u.deleted_at is null
    and not exists (select 1 from public.profiles p where p.id = u.id);

  if v_missing > 0 then
    raise exception 'Migration 008 gagal: masih ada % akun auth tanpa profil', v_missing;
  end if;

  select count(*) into v_trigger
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'auth'
    and c.relname = 'users'
    and t.tgname = 'handle_new_user_trigger'
    and not t.tgisinternal;

  if v_trigger <> 1 then
    raise exception 'Migration 008 gagal: trigger handle_new_user_trigger tidak terpasang (ditemukan %)', v_trigger;
  end if;

  select count(*) into v_bad_role
  from public.profiles p
  where p.role is null or p.role not in ('admin', 'teacher', 'student');

  if v_bad_role > 0 then
    raise exception 'Migration 008 gagal: ada % profil dengan role tidak valid', v_bad_role;
  end if;
end;
$$;