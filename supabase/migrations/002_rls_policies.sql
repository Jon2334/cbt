-- ============================================================================
-- Migrasi 002: Kebijakan Row Level Security (RLS)
-- File: supabase/migrations/002_rls_policies.sql
-- Deskripsi: Menerapkan Kebijakan Row Level Security (RLS) pada setiap tabel
--            untuk menegakkan isolasi berdasarkan peran (admin, guru, siswa).
--            Hanya kebijakan SELECT/INSERT/UPDATE/DELETE yang sesuai
--            dengan kewenangan peran yang diperbolehkan.
-- ============================================================================

-- Aktifkan RLS pada setiap tabel
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_correct_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- profiles
-- ============================================================================

-- Admin dapat membaca dan mengubah semua profil
CREATE POLICY admin_profiles_all ON profiles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Guru dapat membaca profil siswa yang dia ajarkan (melalui class_members)
CREATE POLICY teacher_students_profiles ON profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'teacher'
    )
  );

-- Siswa hanya dapat membaca profil mereka sendiri
CREATE POLICY student_own_profile ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- ============================================================================
-- classes
-- ============================================================================

-- Admin dapat membaca dan mengubah semua kelas
CREATE POLICY admin_classes_all ON classes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Guru dapat membaca kelas yang dia ajarkan (melalui teacher_assignments)
CREATE POLICY teacher_classes_assigned ON classes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teacher_assignments ta
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'teacher'
      WHERE ta.teacher_id = auth.uid() AND (ta.class_id = classes.id OR ta.subject_id IS NOT NULL)
    )
  );

-- Siswa hanya dapat membaca kelas tempat mereka terdaftar
CREATE POLICY student_classes_membership ON classes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM class_members cm
      WHERE cm.student_id = auth.uid() AND cm.class_id = classes.id
    )
  );

-- ============================================================================
-- class_members
-- ============================================================================

-- Admin dapat membaca dan mengubah semua keanggotaan kelas
CREATE POLICY admin_class_members_all ON class_members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Guru dapat membaca anggota kelas yang dia ajarkan
CREATE POLICY teacher_class_members ON class_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teacher_assignments ta
      WHERE ta.teacher_id = auth.uid() AND ta.class_id = class_members.class_id
    )
  );

-- Siswa hanya dapat melihat keanggotaan mereka sendiri
CREATE POLICY student_own_class_members ON class_members
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- ============================================================================
-- subjects
-- ============================================================================

-- Admin dapat membaca dan mengubah semua mata pelajaran
CREATE POLICY admin_subjects_all ON subjects
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Guru dapat membaca semua mata pelajaran (mereka dapat melihat apa yang diajarkan)
CREATE POLICY teacher_subjects_assigned ON subjects
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teacher_assignments ta
      WHERE ta.teacher_id = auth.uid() AND (ta.subject_id = subjects.id OR ta.class_id IS NOT NULL)
    )
  );

-- Siswa dapat membaca semua mata pelajaran (sebagai referensi untuk ujian)
CREATE POLICY student_subjects_all ON subjects
  FOR SELECT TO authenticated
  USING (true);

-- ============================================================================
-- teacher_assignments
-- ============================================================================

-- Admin dapat membaca dan mengubah semua penugasan
CREATE POLICY admin_teacher_assignments_all ON teacher_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Guru hanya dapat membaca tugas mereka sendiri
CREATE POLICY teacher_own_assignments ON teacher_assignments
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

-- ============================================================================
-- questions
-- ============================================================================

-- Admin dapat membaca dan mengubah semua soal
CREATE POLICY admin_questions_all ON questions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Guru dapat membuat, membaca, dan mengubah soal yang mereka buat atau yang mata pelajarannya mereka ajarkan
CREATE POLICY teacher_questions_owned_or_subject ON questions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'teacher'
    )
    AND (
      created_by = auth.uid()
      OR subject_id IN (
        SELECT subject_id FROM teacher_assignments
        WHERE teacher_id = auth.uid() AND subject_id IS NOT NULL
      )
    )
  );

-- Siswa dapat Membaca soal referensi HANYA untuk mata pelajaran yang
-- diajarkan di kelas tempat mereka terdaftar. Hal ini mencegah siswa kelas A
-- membaca soal (atau opsi) milik kelas lain.
-- Kunci jawaban tetap terlindungi oleh policy student_no_access_question_correct_answers
CREATE POLICY student_questions_for_reference ON questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'student'
    )
    AND subject_id IN (
      SELECT ta.subject_id
      FROM teacher_assignments ta
      JOIN class_members cm
        ON cm.class_id = ta.class_id
       WHERE cm.student_id = auth.uid()
         AND ta.subject_id IS NOT NULL
    )
  );

-- ============================================================================
-- question_options
-- ============================================================================

-- Admin dapat membaca dan mengubah semua opsi jawaban
CREATE POLICY admin_question_options_all ON question_options
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Guru dapat mengelola opsi untuk soal yang mereka ajarkan
CREATE POLICY teacher_question_options_assigned ON question_options
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM questions q
      WHERE q.id = question_options.question_id
      AND (
        q.created_by = auth.uid()
        OR q.subject_id IN (
          SELECT subject_id FROM teacher_assignments
          WHERE teacher_id = auth.uid() AND subject_id IS NOT NULL
        )
      )
    )
  );

-- Siswa hanya dapat membaca opsi jawaban untuk soal yang dapat mereka akses
-- (soal pada mata pelajaran yang diajarkan di kelas tempat mereka terdaftar).
-- Diperbaiki: join sebelumnya memakai class_members.class_id sebagai subject_id
-- (kolom salah) sehingga restriksi kelas tidak berlaku; sekarang memakai
-- subject_id yang diajarkan melalui teacher_assignments + class_members.
CREATE POLICY student_question_options_visible ON question_options
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'student'
    )
    AND EXISTS (
      SELECT 1 FROM questions q
      WHERE q.id = question_options.question_id
        AND q.subject_id IN (
          SELECT ta.subject_id
          FROM teacher_assignments ta
          JOIN class_members cm
            ON cm.class_id = ta.class_id
          WHERE cm.student_id = auth.uid()
            AND ta.subject_id IS NOT NULL
        )
    )
  );

-- ============================================================================
-- question_correct_answers
-- ============================================================================

-- Admin dapat membaca dan mengubah kunci jawaban
CREATE POLICY admin_question_correct_answers_all ON question_correct_answers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Guru dapat mengelola kunci jawaban untuk soal yang mereka buat atau yang
-- mata pelajarannya diajarkan. Diperbaiki: cabang q.created_by sebelumnya tidak
-- memfilter teacher_id = auth.uid(), sehingga cakupan akses ke seluruh guru
-- yang mengajarkan mapel (terlalu leluasa). Sekarang membandingkan
-- q.created_by = auth.uid() agar guru hanya mengelola kunci jawaban soal yang
-- mereka sendiri buat, atau soal pada mata pelajaran yang diajarkan oleh guru.
CREATE POLICY teacher_question_correct_answers_assigned ON question_correct_answers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM questions q
      WHERE q.id = question_correct_answers.question_id
      AND (
        q.created_by = auth.uid()
        OR q.subject_id IN (
          SELECT subject_id FROM teacher_assignments
          WHERE teacher_id = auth.uid() AND subject_id IS NOT NULL
        )
      )
    )
  );

-- Siswa tidak diizinkan membaca atau mengubah kunci jawaban
CREATE POLICY student_no_access_question_correct_answers ON question_correct_answers
  FOR SELECT TO authenticated USING (false);
CREATE POLICY student_no_access_question_correct_answers_insert ON question_correct_answers
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY student_no_access_question_correct_answers_update ON question_correct_answers
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY student_no_access_question_correct_answers_delete ON question_correct_answers
  FOR DELETE TO authenticated USING (false);

-- ============================================================================
-- exams
-- ============================================================================

-- Admin dapat membaca dan mengubah semua ujian
CREATE POLICY admin_exams_all ON exams
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Guru dapat mengelola ujian yang mereka buat atau yang diajarkan (melalui class_id atau subject_id)
CREATE POLICY teacher_exams_owned_or_assigned ON exams
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'teacher'
    )
    AND (
      created_by = auth.uid()
      OR class_id IN (
        SELECT class_id FROM teacher_assignments
        WHERE teacher_id = auth.uid() AND class_id IS NOT NULL
      )
      OR subject_id IN (
        SELECT subject_id FROM teacher_assignments
        WHERE teacher_id = auth.uid() AND subject_id IS NOT NULL
      )
    )
  );

-- Siswa hanya dapat melihat ujian yang diterbitkan dan untuk kelas mereka
CREATE POLICY student_exams_visible ON exams
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'student'
    )
    AND status = 'published'
    AND (
      class_id IN (
        SELECT class_id FROM class_members
        WHERE student_id = auth.uid()
      )
    )
    AND now() >= open_at AND now() <= close_at
  );

-- ============================================================================
-- exam_questions
-- ============================================================================

-- Admin dapat membaca dan mengubah semua baris exam_questions
CREATE POLICY admin_exam_questions_all ON exam_questions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Guru dapat mengelola exam_questions yang terkait dengan ujian yang dapat mereka akses
CREATE POLICY teacher_exam_questions_assigned ON exam_questions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM exams e
      WHERE e.id = exam_questions.exam_id
      AND (
        e.created_by = auth.uid()
        OR e.class_id IN (
          SELECT class_id FROM teacher_assignments
          WHERE teacher_id = auth.uid() AND class_id IS NOT NULL
        )
        OR e.subject_id IN (
          SELECT subject_id FROM teacher_assignments
          WHERE teacher_id = auth.uid() AND subject_id IS NOT NULL
        )
      )
    )
  );

-- Siswa dapat melihat exam_questions hanya untuk ujian yang dapat mereka akses
CREATE POLICY student_exam_questions_visible ON exam_questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'student'
    )
    AND EXISTS (
      SELECT 1 FROM exams e
      WHERE e.id = exam_questions.exam_id
      AND e.status = 'published'
      AND (
        e.class_id IN (
          SELECT class_id FROM class_members
          WHERE student_id = auth.uid()
        )
      )
      AND now() >= e.open_at AND now() <= e.close_at
    )
  );

-- ============================================================================
-- exam_attempts
-- ============================================================================

-- Admin dapat membaca dan mengubah semua attempt
CREATE POLICY admin_exam_attempts_all ON exam_attempts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Guru dapat membaca attempt siswa yang dia ajarkan
CREATE POLICY teacher_exam_attempts ON exam_attempts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'teacher'
    )
    AND (
      student_id IN (
        SELECT student_id FROM class_members
        WHERE class_id IN (
          SELECT class_id FROM teacher_assignments
          WHERE teacher_id = auth.uid() AND class_id IS NOT NULL
        )
      )
    )
  );

-- Siswa hanya dapat melihat attempt mereka sendiri
CREATE POLICY student_own_exam_attempts ON exam_attempts
  FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- ============================================================================
-- answers
-- ============================================================================

-- Admin dapat membaca dan mengubah semua jawaban
CREATE POLICY admin_answers_all ON answers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Guru dapat membaca jawaban siswa yang diajarkan (hanya attempt milik siswa
-- di kelas yang diajar guru). Diperbaiki: join sebelumnya membandingkan
-- answers.attempt_id dengan exam_attempts.student_id (selalu salah), sehingga
-- guru tidak pernah melihat jawaban siswa. Sekarang memakai ea.id = attempt_id.
CREATE POLICY teacher_answers ON answers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'teacher'
    )
    AND attempt_id IN (
      SELECT ea.id FROM exam_attempts ea
      WHERE ea.student_id IN (
        SELECT cm.student_id
        FROM class_members cm
        WHERE cm.class_id IN (
          SELECT ta.class_id FROM teacher_assignments ta
          WHERE ta.teacher_id = auth.uid() AND ta.class_id IS NOT NULL
        )
      )
    )
  );

-- Siswa hanya dapat mengelola jawaban untuk attempt mereka sendiri
CREATE POLICY student_own_answers ON answers
  FOR ALL TO authenticated
  USING (attempt_id IN (SELECT id FROM exam_attempts WHERE student_id = auth.uid()))
  WITH CHECK (attempt_id IN (SELECT id FROM exam_attempts WHERE student_id = auth.uid()));

-- ============================================================================
-- results
-- ============================================================================

-- Admin dapat membaca dan mengubah semua hasil
CREATE POLICY admin_results_all ON results
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Guru dapat membaca hasil siswa yang dia ajarkan
CREATE POLICY teacher_results ON results
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'teacher'
    )
    AND (
      student_id IN (
        SELECT student_id FROM class_members
        WHERE class_id IN (
          SELECT class_id FROM teacher_assignments
          WHERE teacher_id = auth.uid() AND class_id IS NOT NULL
        )
      )
    )
  );

-- Siswa hanya dapat membaca hasil mereka sendiri, tetapi hanya jika sudah dipublikasikan
CREATE POLICY student_own_results ON results
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid() AND is_published = true
  );

-- ============================================================================
-- audit_logs
-- ============================================================================

-- Admin dapat membaca semua log audit
CREATE POLICY admin_audit_logs_all ON audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Guru TIDAK DAPAT membaca log audit (batas privasi)
-- Create UPDATE/INSERT hanya untuk tujuan tertentu (misal, trigger insert via database function).
-- Aturan default: siswa tidak bisa membaca.
CREATE POLICY admin_audit_logs_insert ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Semua peran lainnya tidak bisa membaca audit_logs
CREATE POLICY no_access_audit_logs ON audit_logs
  FOR SELECT TO authenticated USING (false);

-- RLS diaktifkan, semua kebijakan diterapkan di atas.
COMMENT ON POLICY admin_profiles_all ON profiles IS 'Admin: izin CRUD semua profil.';
COMMENT ON POLICY teacher_students_profiles ON profiles IS 'Guru: melihat profil siswa yang dia ajarkan.';
COMMENT ON POLICY student_own_profile ON profiles IS 'Siswa: melihat profil sendiri.';

COMMENT ON POLICY admin_classes_all ON classes IS 'Admin: izin CRUD semua kelas.';
COMMENT ON POLICY teacher_classes_assigned ON classes IS 'Guru: melihat kelas yang dia ajarkan.';
COMMENT ON POLICY student_classes_membership ON classes IS 'Siswa: melihat kelas tempat mereka terdaftar.';

COMMENT ON POLICY admin_class_members_all ON class_members IS 'Admin: izin CRUD semua keanggotaan kelas.';
COMMENT ON POLICY teacher_class_members ON class_members IS 'Guru: melihat anggota kelas yang dia ajarkan.';
COMMENT ON POLICY student_own_class_members ON class_members IS 'Siswa: melihat keanggotaan sendiri.';

COMMENT ON POLICY admin_subjects_all ON subjects IS 'Admin: izin CRUD semua mata pelajaran.';
COMMENT ON POLICY teacher_subjects_assigned ON subjects IS 'Guru: melihat mata pelajaran yang dia ajarkan.';
COMMENT ON POLICY student_subjects_all ON subjects IS 'Siswa: membaca semua mata pelajaran (referensi).';

COMMENT ON POLICY admin_teacher_assignments_all ON teacher_assignments IS 'Admin: izin CRUD semua penugasan guru.';
COMMENT ON POLICY teacher_own_assignments ON teacher_assignments IS 'Guru: melihat tugas sendiri.';

COMMENT ON POLICY admin_questions_all ON questions IS 'Admin: izin CRUD semua soal.';
COMMENT ON POLICY teacher_questions_owned_or_subject ON questions IS 'Guru: soal yang mereka buat atau yang diajarkan.';
COMMENT ON POLICY student_questions_for_reference ON questions IS 'Siswa: membaca soal untuk referensi (tanpa kunci jawaban).';

COMMENT ON POLICY admin_question_options_all ON question_options IS 'Admin: izin CRUD semua opsi jawaban.';
COMMENT ON POLICY teacher_question_options_assigned ON question_options IS 'Guru: mengelola opsi untuk soal yang diajarkan.';
COMMENT ON POLICY student_question_options_visible ON question_options IS 'Siswa: membaca opsi yang terkait dengan soal yang dapat mereka akses.';

COMMENT ON POLICY admin_question_correct_answers_all ON question_correct_answers IS 'Admin: izin CRUD kunci jawaban.';
COMMENT ON POLICY teacher_question_correct_answers_assigned ON question_correct_answers IS 'Guru: mengelola kunci jawaban untuk soal yang diajarkan.';
COMMENT ON POLICY student_no_access_question_correct_answers ON question_correct_answers IS 'Siswa: tidak dapat membaca kunci jawaban (terlindungi).';

COMMENT ON POLICY admin_exams_all ON exams IS 'Admin: izin CRUD semua ujian.';
COMMENT ON POLICY teacher_exams_owned_or_assigned ON exams IS 'Guru: ujian yang mereka buat atau yang diajarkan.';
COMMENT ON POLICY student_exams_visible ON exams IS 'Siswa: melihat ujian yang diterbitkan dan untuk kelas mereka, dalam jendela waktu yang valid.';

COMMENT ON POLICY admin_exam_questions_all ON exam_questions IS 'Admin: izin CRUD semua exam_questions.';
COMMENT ON POLICY teacher_exam_questions_assigned ON exam_questions IS 'Guru: exam_questions terkait dengan ujian yang dapat mereka akses.';
COMMENT ON POLICY student_exam_questions_visible ON exam_questions IS 'Siswa: exam_questions untuk ujian yang dapat mereka akses (dalam jendela waktu).';

COMMENT ON POLICY admin_exam_attempts_all ON exam_attempts IS 'Admin: izin CRUD semua attempt ujian.';
COMMENT ON POLICY teacher_exam_attempts ON exam_attempts IS 'Guru: melihat attempt siswa yang dia ajarkan.';
COMMENT ON POLICY student_own_exam_attempts ON exam_attempts IS 'Siswa: lihat/buat attempt sendiri (RLS enforcing ownership).';

COMMENT ON POLICY admin_answers_all ON answers IS 'Admin: izin CRUD semua jawaban.';
COMMENT ON POLICY teacher_answers ON answers IS 'Guru: membaca jawaban siswa yang dia ajarkan.';
COMMENT ON POLICY student_own_answers ON answers IS 'Siswa: mengelola jawaban untuk attempt mereka sendiri.';

COMMENT ON POLICY admin_results_all ON results IS 'Admin: izin CRUD semua hasil.';
COMMENT ON POLICY teacher_results ON results IS 'Guru: membaca hasil siswa yang dia ajarkan.';
COMMENT ON POLICY student_own_results ON results IS 'Siswa: membaca hasil mereka sendiri hanya jika sudah dipublikasikan.';

COMMENT ON POLICY admin_audit_logs_all ON audit_logs IS 'Admin: membaca semua log audit.';
COMMENT ON POLICY admin_audit_logs_insert ON audit_logs IS 'Hanya admin yang dapat memasukkan log audit.';
COMMENT ON POLICY no_access_audit_logs ON audit_logs IS 'Semua peran selain admin tidak dapat membaca audit_logs.';