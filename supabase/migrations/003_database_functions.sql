-- ============================================================================
-- Migrasi 003: Fungsi Database (Database Functions)
-- File: supabase/migrations/003_database_functions.sql
-- Deskripsi: Fungsi-fungsi tepercaya (SECURITY DEFINER) untuk operasi sensitif
--            seperti penilaian otomatis, pengumpulan ujian, validasi timer,
--            dan mencegah pengumpulan ganda. Fungsi ini dijalankan dengan
--            hak akses pemilik fungsi sehingga bisa membaca tabel terlindungi
--            seperti question_correct_answers.
-- ============================================================================

-- ============================================================================
-- Helper: Mendapatkan profil pengguna saat ini (role, id)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_current_profile()
RETURNS profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT * FROM profiles WHERE id = auth.uid();
$$;

-- ============================================================================
-- 1. fn_get_student_exam_questions(exam_id, student_id)
--    Mengambil soal ujian untuk siswa yang sedang mengerjakan.
--    MENGEMBALIKAN HANYA: question_id, question_text, weight, opsi jawaban (tanpa kunci).
--    Mencegah bocoran kunci jawaban ke klien.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_get_student_exam_questions(p_exam_id UUID, p_student_id UUID)
RETURNS TABLE (
  question_id UUID,
  question_text TEXT,
  weight INTEGER,
  option_id UUID,
  option_text TEXT,
  option_order INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_exam exams%ROWTYPE;
  v_student_profile profiles%ROWTYPE;
  v_class_member BOOLEAN;
BEGIN
  -- Validasi siswa dan kepemilikan auth.uid() (mencegah siswa meminta soal orang lain via RPC)
  IF p_student_id <> auth.uid() THEN
    RAISE EXCEPTION 'ID siswa tidak sesuai dengan pengguna terautentikasi.';
  END IF;
  SELECT * INTO v_student_profile FROM profiles WHERE id = p_student_id;
  IF NOT FOUND OR v_student_profile.role <> 'student' THEN
    RAISE EXCEPTION 'Pengguna bukan siswa atau tidak ditemukan.';
  END IF;

  -- Ambil info ujian
  SELECT * INTO v_exam FROM exams WHERE id = p_exam_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ujian tidak ditemukan.';
  END IF;

  -- Cek status ujian
  IF v_exam.status <> 'published' THEN
    RAISE EXCEPTION 'Ujian belum diterbitkan.';
  END IF;

  -- Cek jendela waktu
  IF now() < v_exam.open_at OR now() > v_exam.close_at THEN
    RAISE EXCEPTION 'Ujian tidak dalam jendela waktu yang valid.';
  END IF;

  -- Cek keanggotaan kelas
  SELECT EXISTS (
    SELECT 1 FROM class_members
    WHERE student_id = p_student_id AND class_id = v_exam.class_id
  ) INTO v_class_member;
  IF NOT v_class_member THEN
    RAISE EXCEPTION 'Siswa tidak terdaftar di kelas ujian ini.';
  END IF;

  -- Cek jumlah attempt (maksimal percobaan)
  IF (
    SELECT COUNT(*) FROM exam_attempts
    WHERE exam_id = p_exam_id AND student_id = p_student_id
  ) >= v_exam.max_attempts THEN
    RAISE EXCEPTION 'Maksimal percobaan ujian sudah tercapai.';
  END IF;

  -- Kembalikan soal dan opsi jawaban (tanpa kunci)
  -- Urutkan berdasarkan exam_questions.question_order (atau random jika shuffle_questions)
  RETURN QUERY
  SELECT
    eq.question_id,
    q.question_text,
    COALESCE(eq.weight_override, q.weight) AS weight,
    qo.id AS option_id,
    qo.option_text,
    qo.option_order
  FROM exam_questions eq
  JOIN questions q ON q.id = eq.question_id
  JOIN question_options qo ON qo.question_id = q.id
  WHERE eq.exam_id = p_exam_id
  ORDER BY
    CASE WHEN v_exam.shuffle_questions THEN gen_random_uuid() ELSE eq.question_order END,
    qo.option_order;
END;
$$;

COMMENT ON FUNCTION fn_get_student_exam_questions IS
'Mengambil soal dan opsi jawaban untuk siswa yang mengerjakan ujian. Hanya mengembalikan teks soal dan pilihan jawaban (tidak ada kunci jawaban). Memvalidasi akses, jendela waktu, keanggotaan kelas, dan batas percobaan.';

-- ============================================================================
-- 2. fn_submit_exam(p_attempt_id UUID, p_student_id UUID)
--    Memproses pengumpulan ujian oleh siswa.
--    - Validasi: attempt milik siswa, status in_progress, waktu belum habis
--    - Hitung nilai dengan fungsi penilaian
--    - Update attempt status ke 'submitted'
--    - Insert ke results
--    - Idempoten: jika sudah submitted, kembalikan result yang sudah ada
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_submit_exam(p_attempt_id UUID, p_student_id UUID)
RETURNS TABLE (
  attempt_id UUID,
  exam_id UUID,
  status TEXT,
  score DECIMAL(5,2),
  max_score DECIMAL(5,2),
  correct_answers INTEGER,
  total_questions INTEGER,
  graded_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attempt exam_attempts%ROWTYPE;
  v_exam exams%ROWTYPE;
  v_time_spent INTERVAL;
  v_score DECIMAL(5,2);
  v_max_score DECIMAL(5,2);
  v_correct INTEGER;
  v_total INTEGER;
  v_result_id UUID;
  v_is_new_attempt BOOLEAN := false;
BEGIN
  -- Validasi kepemilikan auth.uid() (mencegah siswa memanipulasi attempt orang lain via RPC)
  IF p_student_id <> auth.uid() THEN
    RAISE EXCEPTION 'ID siswa tidak sesuai dengan pengguna terautentikasi.';
  END IF;

  -- Ambil attempt dengan lock untuk mencegah race condition
  SELECT * INTO v_attempt
  FROM exam_attempts
  WHERE id = p_attempt_id AND student_id = p_student_id
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt tidak ditemukan atau tidak dimiliki siswa.';
  END IF;

  -- Jika sudah submitted/timed_out/graded, kembalikan result yang sudah ada
  IF v_attempt.status IN ('submitted', 'timed_out', 'graded') THEN
    RETURN QUERY
    SELECT
      r.attempt_id,
      r.exam_id,
      a.status,
      r.score,
      r.max_score,
      r.correct_answers,
      r.total_questions,
      r.graded_at
    FROM results r
    JOIN exam_attempts a ON a.id = r.attempt_id
    WHERE r.attempt_id = p_attempt_id;
    RETURN;
  END IF;

  -- Ambil info ujian
  SELECT * INTO v_exam FROM exams WHERE id = v_attempt.exam_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ujian tidak ditemukan.';
  END IF;

  -- Hitung waktu yang dihabiskan
  v_time_spent := now() - v_attempt.started_at;

  -- Cek apakah waktu sudah habis (berdasarkan server)
  IF EXTRACT(EPOCH FROM v_time_spent) > v_exam.duration_minutes * 60 THEN
    -- Waktu habis, update status ke timed_out
    UPDATE exam_attempts
    SET status = 'timed_out', submitted_at = now(), time_spent_seconds = FLOOR(EXTRACT(EPOCH FROM v_time_spent))
    WHERE id = p_attempt_id;
    v_attempt.status := 'timed_out';
    v_attempt.time_spent_seconds := FLOOR(EXTRACT(EPOCH FROM v_time_spent));
  ELSE
    -- Waktu belum habis, update status ke submitted
    UPDATE exam_attempts
    SET status = 'submitted', submitted_at = now(), time_spent_seconds = FLOOR(EXTRACT(EPOCH FROM v_time_spent))
    WHERE id = p_attempt_id;
    v_attempt.status := 'submitted';
    v_attempt.time_spent_seconds := FLOOR(EXTRACT(EPOCH FROM v_time_spent));
  END IF;

  -- Hitung nilai
  SELECT
    COALESCE(SUM(
      CASE
        WHEN a.option_id = qca.correct_option_id THEN COALESCE(eq.weight_override, q.weight)
        ELSE 0
      END
    ), 0) AS earned_score,
    COALESCE(SUM(COALESCE(eq.weight_override, q.weight)), 0) AS total_score,
    COUNT(DISTINCT eq.question_id) AS total_questions,
    COUNT(DISTINCT CASE WHEN a.option_id = qca.correct_option_id THEN eq.question_id END) AS correct_count
  INTO v_score, v_max_score, v_total, v_correct
  FROM exam_questions eq
  JOIN questions q ON q.id = eq.question_id
  LEFT JOIN question_correct_answers qca ON qca.question_id = q.id
  LEFT JOIN answers a ON a.attempt_id = p_attempt_id AND a.question_id = q.id
  WHERE eq.exam_id = v_attempt.exam_id;

  -- Hitung persentase
  v_score := CASE
    WHEN v_max_score > 0 THEN (v_score / v_max_score) * 100
    ELSE 0
  END;

  -- Insert atau update result (idempoten karena unique constraint pada attempt_id)
  INSERT INTO results (attempt_id, student_id, exam_id, score, max_score, total_questions, correct_answers, graded_at, is_published)
  VALUES (p_attempt_id, p_student_id, v_attempt.exam_id, v_score, v_max_score, v_total, v_correct, now(), v_exam.show_results_after)
  ON CONFLICT (attempt_id) DO UPDATE SET
    score = EXCLUDED.score,
    max_score = EXCLUDED.max_score,
    total_questions = EXCLUDED.total_questions,
    correct_answers = EXCLUDED.correct_answers,
    graded_at = EXCLUDED.graded_at,
    is_published = EXCLUDED.is_published
  RETURNING id INTO v_result_id;

  -- Update attempt status ke graded
  UPDATE exam_attempts
  SET status = 'graded'
  WHERE id = p_attempt_id;

  -- Catat audit log
  INSERT INTO audit_logs (user_id, action, target_type, target_id, details)
  VALUES (
    p_student_id,
    'exam_submitted',
    'exam_attempt',
    p_attempt_id,
    jsonb_build_object(
      'exam_id', v_attempt.exam_id,
      'score', v_score,
      'max_score', v_max_score,
      'correct_answers', v_correct,
      'total_questions', v_total,
      'time_spent_seconds', v_attempt.time_spent_seconds
    )
  );

  -- Kembalikan hasil
  RETURN QUERY
  SELECT
    r.attempt_id,
    r.exam_id,
    a.status,
    r.score,
    r.max_score,
    r.correct_answers,
    r.total_questions,
    r.graded_at
  FROM results r
  JOIN exam_attempts a ON a.id = r.attempt_id
  WHERE r.attempt_id = p_attempt_id;
END;
$$;

COMMENT ON FUNCTION fn_submit_exam IS
'Memproses pengumpulan ujian oleh siswa. Validasi kepemilikan, status attempt, dan waktu. Menghitung nilai secara otomatis dengan membandingkan jawaban siswa dengan kunci jawaban (question_correct_answers). Mencegah pengumpulan ganda dengan status check dan unique constraint. Mengembalikan hasil penilaian.';

-- ============================================================================
-- 3. fn_auto_submit_expired_exams()
--    Fungsi untuk dijalankan secara berkala (cron job) atau dipicu oleh trigger
--    untuk mengumpulkan otomatis attempt yang waktu habis (status in_progress
--    namun waktu server sudah melewati close_at atau durasi).
--    Dipanggil oleh pg_cron atau scheduled function di Supabase.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_auto_submit_expired_exams()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_attempt RECORD;
BEGIN
  -- Hanya boleh dipanggil oleh cron (service_role) agar siswa/guru tidak bisa memaksa auto-submit
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Fungsi ini hanya boleh dipanggil melalui cron job (service_role).';
  END IF;

  -- Cari attempt yang masih in_progress tapi waktu sudah habis
  FOR v_attempt IN
    SELECT ea.id, ea.student_id, ea.exam_id, ea.started_at,
           e.duration_minutes, e.close_at
    FROM exam_attempts ea
    JOIN exams e ON e.id = ea.exam_id
    WHERE ea.status = 'in_progress'
    AND (now() > e.close_at OR now() > ea.started_at + (e.duration_minutes || ' minutes')::interval)
  LOOP
    -- Panggil fn_submit_exam untuk setiap attempt
    BEGIN
      PERFORM fn_submit_exam(v_attempt.id, v_attempt.student_id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Log error tapi lanjutkan attempt lain
      INSERT INTO audit_logs (user_id, action, target_type, target_id, details)
      VALUES (
        v_attempt.student_id,
        'auto_submit_failed',
        'exam_attempt',
        v_attempt.id,
        jsonb_build_object('error', SQLERRM)
      );
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION fn_auto_submit_expired_exams IS
'Fungsi cron untuk mengumpulkan otomatis attempt yang sudah lewat waktu (waktu habis atau melewati close_at). Dipanggil oleh pg_cron setiap menit atau sesuai kebutuhan. Mengembalikan jumlah attempt yang diproses.';

-- ============================================================================
-- 4. fn_start_exam_attempt(p_exam_id UUID, p_student_id UUID)
--    Membuat attempt baru untuk siswa.
--    - Validasi: ujian published, dalam jendela waktu, siswa di kelas, belum max attempts
--    - Return attempt_id
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_start_exam_attempt(p_exam_id UUID, p_student_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exam exams%ROWTYPE;
  v_student_profile profiles%ROWTYPE;
  v_class_member BOOLEAN;
  v_current_attempts INTEGER;
  v_attempt_number INTEGER;
  v_new_attempt_id UUID;
BEGIN
  -- Validasi siswa dan kepemilikan auth.uid() (mencegah siswa meminta soal orang lain via RPC)
  IF p_student_id <> auth.uid() THEN
    RAISE EXCEPTION 'ID siswa tidak sesuai dengan pengguna terautentikasi.';
  END IF;
  SELECT * INTO v_student_profile FROM profiles WHERE id = p_student_id;
  IF NOT FOUND OR v_student_profile.role <> 'student' THEN
    RAISE EXCEPTION 'Pengguna bukan siswa atau tidak ditemukan.';
  END IF;

  -- Ambil info ujian
  SELECT * INTO v_exam FROM exams WHERE id = p_exam_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ujian tidak ditemukan.';
  END IF;

  -- Cek status ujian
  IF v_exam.status <> 'published' THEN
    RAISE EXCEPTION 'Ujian belum diterbitkan.';
  END IF;

  -- Cek jendela waktu
  IF now() < v_exam.open_at OR now() > v_exam.close_at THEN
    RAISE EXCEPTION 'Ujian tidak dalam jendela waktu yang valid.';
  END IF;

  -- Cek keanggotaan kelas
  SELECT EXISTS (
    SELECT 1 FROM class_members
    WHERE student_id = p_student_id AND class_id = v_exam.class_id
  ) INTO v_class_member;
  IF NOT v_class_member THEN
    RAISE EXCEPTION 'Siswa tidak terdaftar di kelas ujian ini.';
  END IF;

  -- Cek jumlah attempt yang sudah dilakukan
  SELECT COUNT(*) INTO v_current_attempts
  FROM exam_attempts
  WHERE exam_id = p_exam_id AND student_id = p_student_id;

  IF v_current_attempts >= v_exam.max_attempts THEN
    RAISE EXCEPTION 'Maksimal percobaan ujian sudah tercapai.';
  END IF;

  v_attempt_number := v_current_attempts + 1;

  -- Buat attempt baru
  INSERT INTO exam_attempts (exam_id, student_id, attempt_number, status)
  VALUES (p_exam_id, p_student_id, v_attempt_number, 'in_progress')
  RETURNING id INTO v_new_attempt_id;

  -- Catat audit log
  INSERT INTO audit_logs (user_id, action, target_type, target_id, details)
  VALUES (
    p_student_id,
    'exam_attempt_started',
    'exam_attempt',
    v_new_attempt_id,
    jsonb_build_object('exam_id', p_exam_id, 'attempt_number', v_attempt_number)
  );

  RETURN v_new_attempt_id;
END;
$$;

COMMENT ON FUNCTION fn_start_exam_attempt IS
'Membuat attempt baru untuk siswa memulai ujian. Validasi: ujian published, dalam jendela waktu, siswa di kelas, belum mencapai max_attempts. Mengembalikan attempt_id yang baru dibuat.';

-- ============================================================================
-- 5. fn_save_answer(p_attempt_id UUID, p_question_id UUID, p_option_id UUID, p_student_id UUID)
--    Menyimpan/memperbarui jawaban siswa.
--    - Validasi: attempt milik siswa, status in_progress, soal termasuk dalam ujian
--    - Upsert (insert or update) ke tabel answers
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_save_answer(p_attempt_id UUID, p_question_id UUID, p_option_id UUID, p_student_id UUID)
RETURNS TABLE (
  answer_id UUID,
  attempt_id UUID,
  question_id UUID,
  option_id UUID,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attempt exam_attempts%ROWTYPE;
  v_exam_question exam_questions%ROWTYPE;
BEGIN
  -- Validasi kepemilikan auth.uid() (mencegah siswa memanipulasi attempt orang lain via RPC)
  IF p_student_id <> auth.uid() THEN
    RAISE EXCEPTION 'ID siswa tidak sesuai dengan pengguna terautentikasi.';
  END IF;

  -- Validasi attempt milik siswa
  SELECT * INTO v_attempt
  FROM exam_attempts
  WHERE id = p_attempt_id AND student_id = p_student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt tidak ditemukan atau tidak dimiliki siswa.';
  END IF;

  -- Cek status attempt
  IF v_attempt.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Tidak dapat menyimpan jawaban: attempt sudah %', v_attempt.status;
  END IF;

  -- Validasi soal termasuk dalam ujian
  SELECT * INTO v_exam_question
  FROM exam_questions
  WHERE exam_id = v_attempt.exam_id AND question_id = p_question_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Soal tidak termasuk dalam ujian ini.';
  END IF;

  -- Upsert jawaban
  RETURN QUERY
  INSERT INTO answers (attempt_id, question_id, option_id)
  VALUES (p_attempt_id, p_question_id, p_option_id)
  ON CONFLICT (attempt_id, question_id) DO UPDATE SET
    option_id = EXCLUDED.option_id,
    updated_at = now()
  RETURNING id, attempt_id, question_id, option_id, updated_at;
END;
$$;

COMMENT ON FUNCTION fn_save_answer IS
'Menyimpan atau memperbarui jawaban siswa untuk satu soal. Validasi kepemilikan attempt, status in_progress, dan keanggotaan soal ke ujian. Menggunakan upsert untuk idempotensi.';

-- ============================================================================
-- 6. fn_calculate_exam_score(p_attempt_id UUID)
--    Menghitung nilai untuk attempt tertentu (bisa dipanggil ulang jika kunci jawaban berubah).
--    Hanya untuk admin/guru yang berwenang.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_calculate_exam_score(p_attempt_id UUID)
RETURNS TABLE (
  attempt_id UUID,
  exam_id UUID,
  score DECIMAL(5,2),
  max_score DECIMAL(5,2),
  correct_answers INTEGER,
  total_questions INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attempt exam_attempts%ROWTYPE;
  v_exam exams%ROWTYPE;
  v_score DECIMAL(5,2);
  v_max_score DECIMAL(5,2);
  v_correct INTEGER;
  v_total INTEGER;
BEGIN
  -- Validasi hak akses: admin atau guru yang berwenang
  IF NOT (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM exam_attempts ea
      JOIN exams e ON e.id = ea.exam_id
      WHERE ea.id = p_attempt_id
      AND (
        e.created_by = auth.uid()
        OR e.class_id IN (SELECT class_id FROM teacher_assignments WHERE teacher_id = auth.uid())
        OR e.subject_id IN (SELECT subject_id FROM teacher_assignments WHERE teacher_id = auth.uid())
      )
    )
  ) THEN
    RAISE EXCEPTION 'Tidak memiliki izin untuk menghitung nilai attempt ini.';
  END IF;

  SELECT * INTO v_attempt FROM exam_attempts WHERE id = p_attempt_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt tidak ditemukan.';
  END IF;

  SELECT * INTO v_exam FROM exams WHERE id = v_attempt.exam_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ujian tidak ditemukan.';
  END IF;

  -- Hitung nilai
  SELECT
    COALESCE(SUM(
      CASE
        WHEN a.option_id = qca.correct_option_id THEN COALESCE(eq.weight_override, q.weight)
        ELSE 0
      END
    ), 0) AS earned_score,
    COALESCE(SUM(COALESCE(eq.weight_override, q.weight)), 0) AS total_score,
    COUNT(DISTINCT eq.question_id) AS total_questions,
    COUNT(DISTINCT CASE WHEN a.option_id = qca.correct_option_id THEN eq.question_id END) AS correct_count
  INTO v_score, v_max_score, v_total, v_correct
  FROM exam_questions eq
  JOIN questions q ON q.id = eq.question_id
  LEFT JOIN question_correct_answers qca ON qca.question_id = q.id
  LEFT JOIN answers a ON a.attempt_id = p_attempt_id AND a.question_id = q.id
  WHERE eq.exam_id = v_attempt.exam_id;

  v_score := CASE
    WHEN v_max_score > 0 THEN (v_score / v_max_score) * 100
    ELSE 0
  END;

  RETURN QUERY SELECT p_attempt_id, v_attempt.exam_id, v_score, v_max_score, v_correct, v_total;
END;
$$;

COMMENT ON FUNCTION fn_calculate_exam_score IS
'Menghitung nilai untuk attempt tertentu. Hanya dapat dipanggil oleh admin atau guru yang berwenang. Digunakan untuk koreksi ulang jika kunci jawaban berubah.';

-- ============================================================================
-- 7. fn_publish_results(p_exam_id UUID, p_publish BOOLEAN)
--    Memublikasikan atau menonaktifkan pengumuman hasil ujian.
--    Hanya guru yang membuat ujian atau admin.
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_publish_results(p_exam_id UUID, p_publish BOOLEAN)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exam exams%ROWTYPE;
  v_updated INTEGER;
BEGIN
  -- Validasi ujian dan hak akses
  SELECT * INTO v_exam FROM exams WHERE id = p_exam_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ujian tidak ditemukan.';
  END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR v_exam.created_by = auth.uid()
    OR v_exam.class_id IN (SELECT class_id FROM teacher_assignments WHERE teacher_id = auth.uid())
    OR v_exam.subject_id IN (SELECT subject_id FROM teacher_assignments WHERE teacher_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Tidak memiliki izin untuk mengubah pengumuman hasil ujian ini.';
  END IF;

  UPDATE results
  SET is_published = p_publish
  FROM exam_attempts ea
  WHERE results.attempt_id = ea.id
  AND ea.exam_id = p_exam_id
  RETURNING 1 INTO v_updated;

  IF v_updated IS NOT NULL THEN
    INSERT INTO audit_logs (user_id, action, target_type, target_id, details)
    VALUES (
      auth.uid(),
      CASE WHEN p_publish THEN 'results_published' ELSE 'results_unpublished' END,
      'exam',
      p_exam_id,
      jsonb_build_object('published', p_publish, 'affected_results', v_updated)
    );
  END IF;

  RETURN COALESCE(v_updated, 0);
END;
$$;

COMMENT ON FUNCTION fn_publish_results IS
'Memublikasikan atau menonaktifkan pengumuman hasil ujian. Hanya guru pembuat ujian atau admin. Mengubah kolom is_published pada tabel results.';

-- ============================================================================
-- 8. Trigger: updated_at otomatis untuk tabel yang memiliki kolom updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Terapkan trigger ke tabel yang memiliki updated_at
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_subjects_updated_at
  BEFORE UPDATE ON subjects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_question_correct_answers_updated_at
  BEFORE UPDATE ON question_correct_answers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_exams_updated_at
  BEFORE UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_answers_updated_at
  BEFORE UPDATE ON answers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 9. Trigger: update_exam_attempt_time_spent
--    Secara otomatis menghitung time_spent_seconds saat attempt diupdate
--    (misal saat submitted atau timed_out).
-- ============================================================================
CREATE OR REPLACE FUNCTION update_exam_attempt_time_spent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.submitted_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.time_spent_seconds := FLOOR(EXTRACT(EPOCH FROM (NEW.submitted_at - NEW.started_at)));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_exam_attempt_time_spent
  BEFORE UPDATE ON exam_attempts
  FOR EACH ROW EXECUTE FUNCTION update_exam_attempt_time_spent();

-- ============================================================================
-- 10. Trigger: log_exam_changes
--      Mencatat perubahan penting pada exams, questions, dll.
-- ============================================================================
CREATE OR REPLACE FUNCTION log_exam_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, target_type, target_id, details)
  VALUES (
    auth.uid(),
    TG_OP || '_' || TG_TABLE_NAME,
    TG_TABLE_NAME,
    NEW.id,
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

-- Terapkan ke exams, questions, question_correct_answers
CREATE TRIGGER trg_exams_audit
  AFTER INSERT OR UPDATE OR DELETE ON exams
  FOR EACH ROW EXECUTE FUNCTION log_exam_changes();

CREATE TRIGGER trg_questions_audit
  AFTER INSERT OR UPDATE OR DELETE ON questions
  FOR EACH ROW EXECUTE FUNCTION log_exam_changes();

CREATE TRIGGER trg_question_correct_answers_audit
  AFTER INSERT OR UPDATE OR DELETE ON question_correct_answers
  FOR EACH ROW EXECUTE FUNCTION log_exam_changes();