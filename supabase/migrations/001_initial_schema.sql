-- ============================================================================
-- Migrasi 001: Skema Awal Database CBT (Sistem Computer Based Test)
-- File: supabase/migrations/001_initial_schema.sql
-- Deskripsi: Membuat semua tabel inti, primary key, foreign key, constraint,
--            dan index berdasarkan PRD Bagian 9 (Rancangan Database).
-- ============================================================================

-- Aktifkan extension untuk UUID dan JSONB (sudah tersedia bawaan Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. profiles — identitas dan peran pengguna
--    id mereferensikan auth.users.id dari Supabase Auth.
-- ----------------------------------------------------------------------------
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE profiles IS 'Identitas dan peran pengguna (admin, teacher, student).';
COMMENT ON COLUMN profiles.role IS 'Peran pengguna: admin, teacher, atau student.';
COMMENT ON COLUMN profiles.email IS 'Email pengguna (disinkronkan dari auth.users).';

-- ----------------------------------------------------------------------------
-- 2. classes — informasi kelas
-- ----------------------------------------------------------------------------
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  grade_level TEXT,
  academic_year TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_archived BOOLEAN NOT NULL DEFAULT false
);

COMMENT ON TABLE classes IS 'Informasi kelas (misal: X IPA 1, XI IPS 2).';
COMMENT ON COLUMN classes.academic_year IS 'Tahun ajaran, misal: 2024/2025.';
COMMENT ON COLUMN classes.is_archived IS 'Tandai kelas yang tidak lagi aktif (soft delete).';

-- ----------------------------------------------------------------------------
-- 3. class_members — hubungan siswa dengan kelas
-- ----------------------------------------------------------------------------
CREATE TABLE class_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);

COMMENT ON TABLE class_members IS 'Menghubungkan siswa dengan kelas tempat ia terdaftar.';
COMMENT ON COLUMN class_members.student_id IS 'Profil siswa yang menjadi anggota kelas.';

-- ----------------------------------------------------------------------------
-- 4. subjects — mata pelajaran
-- ----------------------------------------------------------------------------
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE subjects IS 'Data mata pelajaran (misal: Matematika, Bahasa Indonesia).';
COMMENT ON COLUMN subjects.code IS 'Kode singkat mata pelajaran, misal: MTK, BIN.';

-- ----------------------------------------------------------------------------
-- 5. teacher_assignments — penugasan guru ke kelas atau mata pelajaran
-- ----------------------------------------------------------------------------
CREATE TABLE teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, class_id, subject_id),
  CONSTRAINT teacher_assignment_not_all_null
    CHECK (class_id IS NOT NULL OR subject_id IS NOT NULL)
);

COMMENT ON TABLE teacher_assignments IS 'Penugasan guru ke kelas dan/atau mata pelajaran.';
COMMENT ON COLUMN teacher_assignments.class_id IS 'Kelas yang ditugasi (nullable jika tugas adalah mata pelajaran secara global).';
COMMENT ON COLUMN teacher_assignments.subject_id IS 'Mata pelajaran yang ditugasi (nullable jika tugas adalah kelas secara keseluruhan).';

-- ----------------------------------------------------------------------------
-- 6. questions — soal dan metadata soal
-- ----------------------------------------------------------------------------
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic TEXT,
  question_text TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 1 CHECK (weight > 0),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE questions IS 'Soal dan metadata soal (pilihan ganda).';
COMMENT ON COLUMN questions.weight IS 'Bobot nilai soal (default 1).';

-- ----------------------------------------------------------------------------
-- 7. question_options — pilihan jawaban (kunci jawaban SIMPAN di tabel terpisah)
--    Tabel ini sengaja TIDAK menyimpan kolom is_correct untuk mencegah siswa
--    membaca kunci jawaban melalui API klien.
-- ----------------------------------------------------------------------------
CREATE TABLE question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  option_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id, option_order)
);

COMMENT ON TABLE question_options IS 'Pilihan jawaban untuk setiap soal. Kunci jawaban disimpan di question_correct_answers, tidak di sini.';

-- ----------------------------------------------------------------------------
-- 8. question_correct_answers — kunci jawaban yang TERLINDUNGI
--    Hanya dapat diakses oleh admin dan guru (via RLS + fungsi server).
--    Siswa TIDAK DAPAT membaca tabel ini.
-- ----------------------------------------------------------------------------
CREATE TABLE question_correct_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE UNIQUE,
  correct_option_id UUID NOT NULL REFERENCES question_options(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE question_correct_answers IS 'Kunci jawaban soal (terlindungi, tidak boleh diakses siswa).';

-- ----------------------------------------------------------------------------
-- 9. exams — konfigurasi dan jadwal ujian
-- ----------------------------------------------------------------------------
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  open_at TIMESTAMPTZ NOT NULL,
  close_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  max_attempts INTEGER NOT NULL DEFAULT 1 CHECK (max_attempts >= 1),
  shuffle_questions BOOLEAN NOT NULL DEFAULT false,
  shuffle_options BOOLEAN NOT NULL DEFAULT false,
  show_results_after BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exams_close_after_open CHECK (close_at > open_at)
);

COMMENT ON TABLE exams IS 'Konfigurasi dan jadwal ujian.';
COMMENT ON COLUMN exams.open_at IS 'Waktu pembuka ujian (waktu server).';
COMMENT ON COLUMN exams.close_at IS 'Waktu penutupan ujian (waktu server).';
COMMENT ON COLUMN exams.duration_minutes IS 'Durasi pengerjaan dalam menit.';
COMMENT ON COLUMN exams.max_attempts IS 'Maksimal jumlah percobaan ujian per siswa.';
COMMENT ON COLUMN exams.status IS 'Status: draft, published, atau archived.';

-- ----------------------------------------------------------------------------
-- 10. exam_questions — hubungan ujian dengan soal (urutan dan bobot)
-- ----------------------------------------------------------------------------
CREATE TABLE exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  question_order INTEGER NOT NULL,
  weight_override INTEGER CHECK (weight_override > 0),
  UNIQUE (exam_id, question_id)
);

COMMENT ON TABLE exam_questions IS 'Menghubungkan ujian dengan soal beserta urutan dan bobot.';
COMMENT ON COLUMN exam_questions.weight_override IS 'Bobot khusus untuk ujian ini (nullable = gunakan bobot dari questions.weight).';

-- ----------------------------------------------------------------------------
-- 11. exam_attempts — sesi pengerjaan setiap siswa
-- ----------------------------------------------------------------------------
CREATE TABLE exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'submitted', 'timed_out', 'graded')),
  time_spent_seconds INTEGER NOT NULL DEFAULT 0 CHECK (time_spent_seconds >= 0),
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  UNIQUE (exam_id, student_id, attempt_number),
  CONSTRAINT attempts_submitted_after_started
    CHECK (submitted_at IS NULL OR submitted_at >= started_at)
);

COMMENT ON TABLE exam_attempts IS 'Sesi pengerjaan ujian untuk setiap siswa.';
COMMENT ON COLUMN exam_attempts.attempt_number IS 'Nomor percobaan (1, 2, ... sesuai max_attempts).';
COMMENT ON COLUMN exam_attempts.status IS 'Status sesi: in_progress, submitted, timed_out, graded.';

-- ----------------------------------------------------------------------------
-- 12. answers — jawaban siswa untuk setiap soal
-- ----------------------------------------------------------------------------
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_id UUID REFERENCES question_options(id),
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);

COMMENT ON TABLE answers IS 'Jawaban siswa untuk setiap soal dalam satu sesi ujian.';
COMMENT ON COLUMN answers.option_id IS 'Opsi jawaban yang dipilih siswa (nullable jika belum dijawab).';

-- ----------------------------------------------------------------------------
-- 13. results — nilai dan status hasil ujian
-- ----------------------------------------------------------------------------
CREATE TABLE results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE UNIQUE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  score DECIMAL(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  max_score DECIMAL(5,2) NOT NULL CHECK (max_score > 0),
  total_questions INTEGER NOT NULL CHECK (total_questions > 0),
  correct_answers INTEGER NOT NULL CHECK (correct_answers >= 0),
  graded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_published BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT results_correct_not_exceed_total CHECK (correct_answers <= total_questions)
);

COMMENT ON TABLE results IS 'Nilai dan status hasil ujian (dihitung oleh fungsi server).';
COMMENT ON COLUMN results.is_published IS 'Tandai apakah hasil boleh dilihat siswa.';

-- ----------------------------------------------------------------------------
-- 14. audit_logs — catatan tindakan penting untuk audit
-- ----------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE audit_logs IS 'Catatan tindakan penting (exam_created, exam_submitted, grade_calculated, dll).';
COMMENT ON COLUMN audit_logs.action IS 'Nama tindakan yang dilakukan.';
COMMENT ON COLUMN audit_logs.target_type IS 'Tipe objek yang ditindaklanjuti (exam, attempt, question, etc).';
COMMENT ON COLUMN audit_logs.details IS 'Detail tambahan dalam format JSON.';

-- ============================================================================
-- INDEX untuk performa query umum
-- ============================================================================

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);

CREATE INDEX idx_classes_academic_year ON classes(academic_year);
CREATE INDEX idx_classes_is_archived ON classes(is_archived);

CREATE INDEX idx_class_members_class_id ON class_members(class_id);
CREATE INDEX idx_class_members_student_id ON class_members(student_id);

CREATE INDEX idx_teacher_assignments_teacher ON teacher_assignments(teacher_id);
CREATE INDEX idx_teacher_assignments_class ON teacher_assignments(class_id);
CREATE INDEX idx_teacher_assignments_subject ON teacher_assignments(subject_id);

CREATE INDEX idx_questions_subject ON questions(subject_id);
CREATE INDEX idx_questions_created_by ON questions(created_by);

CREATE INDEX idx_question_options_question ON question_options(question_id);

CREATE INDEX idx_exams_subject ON exams(subject_id);
CREATE INDEX idx_exams_class ON exams(class_id);
CREATE INDEX idx_exams_created_by ON exams(created_by);
CREATE INDEX idx_exams_status ON exams(status);
CREATE INDEX idx_exams_open_close ON exams(open_at, close_at);

CREATE INDEX idx_exam_questions_exam ON exam_questions(exam_id);
CREATE INDEX idx_exam_questions_question ON exam_questions(question_id);

CREATE INDEX idx_exam_attempts_exam ON exam_attempts(exam_id);
CREATE INDEX idx_exam_attempts_student ON exam_attempts(student_id);
CREATE INDEX idx_exam_attempts_status ON exam_attempts(status);

CREATE INDEX idx_answers_attempt ON answers(attempt_id);
CREATE INDEX idx_answers_question ON answers(question_id);

CREATE INDEX idx_results_student ON results(student_id);
CREATE INDEX idx_results_exam ON results(exam_id);
CREATE INDEX idx_results_attempt ON results(attempt_id);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);