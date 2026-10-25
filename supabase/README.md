# Supabase Database — CBT System

## Gambaran Umum

Direktori ini berisi skema database, kebijakan keamanan (RLS), dan fungsi database tepercaya (server-side) untuk sistem CBT (Computer Based Test). Backend menggunakan **Supabase (PostgreSQL)** dengan **Supabase Auth** untuk autentikasi pengguna.

### Struktur Direktori

```text
supabase/
├── migrations/
│   ├── 001_initial_schema.sql     # Definisi tabel, constraint, index
│   ├── 002_rls_policies.sql       # Kebijakan Row Level Security (RLS)
│   └── 003_database_functions.sql # Fungsi tepercaya (SECURITY DEFINER)
├── .gitignore
└── README.md                    # Dokumen ini
```

### Urutan Aplikksi (Migration Order)

1. `001_initial_schema.sql` — Membuat semua tabel, constraint, index.
2. `002_rls_policies.sql` — Mengaktifkan RLS dan menerapkan kebijakan akses.
3. `003_database_functions.sql` — Membuat fungsi database (penilaian, pengumpulan, timer, audit).

---

## Cara Menyiapkan Project Supabase

### 1. Buat Project Supabase

Buka [Supabase Studio](https://app.supabase.com) dan buat project baru. Catat:

- **Project URL** (mis. `https://xyzcompany.supabase.co`)
- **anon/public key** (digunakan di aplikasi klien)
- **service_role key** (HANYA untuk backend — **JANGAN** letakkan di frontend)

### 2. Hubungkan Kode Aplikasi

Salin `.env.example` di masing-masing proyek:

```bash
# cbt-android/.env
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# cbt-web/.env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

> **Aturan penting:** anon key boleh dipasang di klien. `service_role key` dan rahasia server **dilarang** di kode frontend.

---

## Cara Menjalankan Migrasi

### Metode 1: Supabase CLI (direkomendasikan)

Instal [Supabase CLI](https://github.com/supabase/supabase/tree/master/packages/cli):

```bash
npm install -g supabase
```

Hubungkan ke project Anda:

```bash
cd D:\PROJECT_SKRIPSI
supabase login
supabase link --project-id <PROJECT_ID_ANDA>
```

Jalankan migrasi:

```bash
supabase db push
```

Untuk melihat migrasi yang belum diterapkan:

```bash
supabase db diff
```

### Metode 2: Manual via Supabase Studio

1. Buka Supabase Studio → menu **SQL Editor**.
2. Buka tiap file SQL di `supabase/migrations/` secara berurutan (001 → 002 → 003).
3. Klik **Run** untuk mengeksekusi.

> **Peringatan:** Jika aplikasi otomatis berubah (trigger) atau fungsi server dibutuhkan, semua migrasi harus dijalankan secara berurutan karena ketergantungan antar-tabel.

---

## Cara Mengatur Supabase Auth

### Profil dan Sinkronisasi

Setelah pengguna mendaftar via **Supabase Auth**, profil otomatis dibuat di tabel `profiles`. **Role SELALU default ke `student`** dan tidak boleh ditentukan lewat metadata pendaftaran — hal ini mencegah penyerang mendaftar sebagai `admin`/`teacher`.

Trigger ini sudah disertakan sebagai migration terpisah:

```bash
# Migration otomatis (diterapkan bersama migrasi lain)
supabase/migrations/004_auth_trigger_role_safe.sql
```

Berikut logikanya (role di-hardcode = `student`, bukan dari `raw_user_meta_data`):

```sql
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into profiles (id, full_name, role, email)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    'student',
    new.email
  );
  return new;
end;
$$;
```

Untuk memberi hak guru/admin ke pengguna tertentu, lakukan secara manual di Supabase Studio — **jangan** lewat kolom metadata saat signup:

```sql
UPDATE profiles SET role = 'teacher' WHERE id = '<user_id>';
```

### Role Pengguna

Setiap profil memiliki kolom `role` yang dapat berupa:

| Role      | Deskripsi                |
|-----------|--------------------------|
| `admin`   | Mengelola sistem penuh    |
| `teacher` | Membuat/mengelola ujian   |
| `student` | Mengerjakan ujian         |

---

## Arsitektur Keamanan (RLS)

### Ringkasan Kebijakan Akses

| Tabel                     | Admin | Guru                                     | Siswa                                |
|---------------------------|-------|------------------------------------------|--------------------------------------|
| `profiles`                | CRUD  | Baca profil siswa                        | Baca profil sendiri                  |
| `classes`                 | CRUD  | Baca kelas yang diajarkan                | Baca kelas tempat terdaftar          |
| `class_members`           | CRUD  | Baca anggota kelas diajarkan             | Baca anggota sendiri                 |
| `subjects`                | CRUD  | Baca semua                              | Baca semua (referensi)               |
| `teacher_assignments`     | CRUD  | Baca tugas sendiri                       | Akses DITOLAK                        |
| `questions`               | CRUD  | CRUD soal diajarkan                      | Baca soal (tanpa kunci jawaban)      |
| `question_options`        | CRUD  | Kelola opsi soal diajarkan               | Baca opsi (tanpa kunci)              |
| `question_correct_answers`| CRUD  | Kelola kunci soal diajarkan              | Akses DITOLAK (terlindungi)          |
| `exams`                   | CRUD  | CRUD ujian sendiri/diajaran              | Baca ujian published + kelasnya      |
| `exam_questions`          | CRUD  | Kelola untuk ujian bisa diakses          | Baca untuk ujian yang bisa diikuti   |
| `exam_attempts`           | CRUD  | Baca attempt siswa diajarkan             | CRUD attempt sendiri                 |
| `answers`                 | CRUD  | Baca jawaban siswa diajarkan             | CRUD jawaban attempt sendiri         |
| `results`                 | CRUD  | Baca hasil siswa diajarkan               | Baca hasil sendiri (jika published)  |
| `audit_logs`              | CR    | Akses DITOLAK                            | Akses DITOLAK                        |

### Pencegahan Akses ilegal

- **Kunci jawaban** (`question_correct_answers`): siswa **dilararang sama sekali** membaca tabel ini. Kunci jawaban hanya diakses melalui **fungsi server** (`fn_get_student_exam_questions`, `fn_submit_exam`, `fn_calculate_exam_score`).
- **Nilai**: siswa hanya dapat melihat `results` ketika `is_published = true`.
- **Audit log**: hanya admin yang dapat membaca.

---

## Fungsi Database (Server-Side)

Berikut adalah fungsi-fungsi tepercaya yang harus digunakan oleh kedua aplikasi (Android & Web):

### 1. `fn_get_student_exam_questions(exam_id, student_id)`

- **Tujuan:** Mengembalikan soal dan opsi jawaban untuk siswa (tanpa kunci jawaban).
- **Validasi:** memeriksa peran siswa, status publikasi ujian, jendela waktu, keanggotaan kelas, dan batas percobaan.
- **Digunakan oleh:** Aplikasi Android ketika menampilkan halaman mengerjakan soal.

### 2. `fn_submit_exam(attempt_id, student_id)`

- **Tujuan:** Memproses pengumpulan ujian, menghitung nilai, membuat hasil, dan mengubah status attempt.
- **Idempoten:** jika attempt sudah disubmit, kembalikan hasil yang sudah ada (mencegah nilai duplikat).
- **Timer berbasis server:** membandingkan `now() - started_at` dengan `duration_minutes`.
- **Digunakan oleh:** Aplikasi Android ketika siswa mengumpulkan ujian.

### 3. `fn_auto_submit_expired_exams()`

- **Tujuan:** Cron job untuk mengumpulkan otomatis attempt yang melewati waktu.
- **Dipanggil oleh:** `pg_cron` setiap menit (atau sesuai kebutuhan).
- **Dipasang di:** Supabase SQL Editor → menu **Database** → **Schedules**.

### 4. `fn_start_exam_attempt(exam_id, student_id)`

- **Tujuan:** Membuat attempt baru. Memvalidasi max_attempts.
- **Digunakan oleh:** Aplikasi Android ketika siswa menekan "Mulai Ujian".

### 5. `fn_save_answer(attempt_id, question_id, option_id, student_id)`

- **Tujuan:** Upsert jawaban siswa (insert or update). Idempoten.
- **Validasi:** attempt milik siswa, status in_progress, soal termasuk ujian.
- **Digunakan oleh:** Aplikasi Android saat siswa mengganti pilihan jawaban.

### 6. `fn_calculate_exam_score(attempt_id)`

- **Tujuan:** Menghitung ulang nilai (untuk koreksi jika kunci jawaban berubah).
- **Hak akses:** hanya admin atau guru yang berwenang.
- **Digunakan oleh:** Dashboard web (guru).

### 7. `fn_publish_results(exam_id, publish_boolean)`

- **Tujuan:** Membuka/menutup pengumaman hasil ujian untuk siswa.
- **Digunakan oleh:** Dashboard web (guru).

---

## Aturan Penilaian

```
Nilai = (Total bobot jawaban benar / Total bobot seluruh soal) × 100
```

- Jawaban benar didefinisikan sebagai `a.option_id = qca.correct_option_id` (jawaban siswa = kunci jawaban di database).
- Penilaian dilakukan **hanya di database** (SECURITY DEFINER), bukan di perangkat siswa.
- Nilai tidak boleh pernah dihitung berdasarkan data yang dikirim ke perangkat siswa.

---

## Timer dan Keandalan

- **Timer berbasis server:** `started_at` disimpan saat `fn_start_exam_attempt` dipanggil.
- **Waktu habis:** `fn_auto_submit_expired_exams` dijalankan via `pg_cron` untuk mengumpulkan attempt yang waktu habis.
- **Koneksi terputus:** Aplikasi Android harus menyimpan jawaban secara lokal (AsyncStorage) dan menyinkronkan saat koneksi pulih. Database adalah sumber kebenaran.
- **Idempotensi:** `fn_submit_exam` dan `fn_save_answer` dirancang agar aman dipanggil berulang kali.

---

## Validasi SQL

Untuk memvalidasi sintaks SQL (membutuhkan PostgreSQL):

```bash
# Jika PostgreSQL tersedia secara lokal:
psql -f supabase/migrations/001_initial_schema.sql
psql -f supabase/migrations/002_rls_policies.sql
psql -f supabase/migrations/003_database_functions.sql
```

> **Catatan:** Validasi penuh membutuhkan koneksi Supabase yang aktif. File SQL ini belum diterapkan pada database produksi.

---

## Langkah Berikutnya

1. **Buat project Supabase** di [app.supabase.com](https://app.supabase.com).
2. **Jalankan migrasi** dengan `supabase db push` atau secara manual.
3. **Pasang Auth Trigger** agar `profiles` dibuat otomatis.
4. **Konfigurkan `pg_cron`** untuk `fn_auto_submit_expired_exams`.
5. **Update koneksi Supabase** di `cbt-android/.env` dan `cbt-web/.env` dengan kredensial yang sesuai.
6. **Uji RLS** dengan user dummy (admin, guru, siswa) menggunakan Supabase Studio.
7. **Implementasi fitur lanjutan** di Fase 3-6 (dashboard web, aplikasi Android, penilaian, rekap).