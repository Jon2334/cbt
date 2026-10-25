// ---------------------------------------------------------------------------
// Layer data ujian: seluruh akses RLS + RPC dilakukan di sini.
//
// Prinsip (dari audit):
//  - Tidak menulis/membaca tabel yang dilarang RLS.
//  - Tidak mengasumsikan kolom di luar skema 001/002/003.
//  - Tiap fungsi mengembalikan { data?, error? } dengan error Supabase asli;
//    UI memanggil friendlyError() saat menampilkan pesan ke pengguna.
// ---------------------------------------------------------------------------
import { supabase } from './supabase';
import type {
  Exam,
  ExamAttempt,
  ExamQuestion,
  ExamStatusFlags,
  ExamSubmitResult,
  Profile,
  QuestionOption,
  QuestionRow,
  ResultRow,
} from './types';

// Daftar kolom `exams` yang boleh diputar ke siswa (RLS student_exams_visible).
// RLS filter: status='published' AND now() dalam [open_at, close_at] AND
// siswa ter-enrolled di class exam.
const EXAM_SELECT =
  'id,title,description,subject_id,class_id,created_by,open_at,close_at,duration_minutes,max_attempts,shuffle_questions,shuffle_options,show_results_after,status,created_at,updated_at';

// Kolom `exam_attempts` untuk resume & daftar status (RLS student_own_attempts).
const ATTEMPT_SELECT = 'id,exam_id,student_id,started_at,submitted_at,status,time_spent_seconds,attempt_number';

// Kolom `results` yang sudah difilter RLS (student_results_published).
const RESULT_SELECT = 'id,attempt_id,exam_id,score,max_score,total_questions,correct_answers,graded_at,is_published';

// ===========================================================================
// 1. LIST UJIAN YANG BISA DIKERJAKAN
// ===========================================================================
export async function listAvailableExams() {
  const { data, error } = await supabase.from('exams').select(EXAM_SELECT);
  if (error) return { data: [] as Exam[], error };
  return { data: (data as unknown as Exam[]) ?? [], error: null };
}

// ===========================================================================
// 2. UJIAN + STATUS ATTEMPT PER UJIAN (untuk layar daftar)
// ===========================================================================
export async function listExamsWithStatus(profile: Pick<Profile, 'id'>) {
  const examsRes = await listAvailableExams();
  if (examsRes.error) return { data: [] as Array<Exam & ExamStatusFlags>, error: examsRes.error };

  const attemptsRes = await supabase
    .from('exam_attempts')
    .select(ATTEMPT_SELECT)
    .eq('student_id', profile.id)
    .order('attempt_number', { ascending: false });
  if (attemptsRes.error) return { data: [] as Array<Exam & ExamStatusFlags>, error: attemptsRes.error };
  const attempts = (attemptsRes.data as unknown as ExamAttempt[]) ?? [];

  // Kelompokkan: per exam_id, simpan attempt_number terbanyak (kekuatan
  // maksimum) dan attempt in_progress bila ada.
  const byExam = new Map<string, { active: ExamAttempt | null; used: number; max: number }>();
  for (const a of attempts) {
    const slot = byExam.get(a.exam_id) ?? { active: null, used: 0, max: 0 };
    if (a.status === 'in_progress' && slot.active === null) slot.active = a;
    // used = jumlah attempt (termasuk in_progress) yang sudah dibuat.
    slot.used += 1;
    slot.max = Math.max(slot.max, a.attempt_number);
    byExam.set(a.exam_id, slot);
  }

  const data: Array<Exam & ExamStatusFlags> = (examsRes.data as Exam[]).map((exam) => {
    const rec = byExam.get(exam.id);
    const active = rec?.active ?? null;
    const used = rec?.used ?? 0;
    const attemptsLeft = Math.max(0, exam.max_attempts - used);
    const completed =
      used >= exam.max_attempts || (active !== null && active.status !== 'in_progress');

    return {
      ...exam,
      attempt: active,
      attemptsUsed: used,
      attemptsLeft,
      canStart: attemptsLeft > 0 && active === null,
      canResume: active !== null,
      completed,
    };
  });

  return { data, error: null };
}

// ===========================================================================
// 3. SOAL & OPSI (RPC ter-shuffle, tanpa kunci jawaban)
// ===========================================================================
export async function fetchExamQuestions(examId: string, studentId: string) {
  const { data, error } = await supabase.rpc('fn_get_student_exam_questions', {
    p_exam_id: examId,
    p_student_id: studentId,
  });
  if (error) return { data: [] as ExamQuestion[], error };
  const rows = (data as unknown as QuestionRow[]) ?? [];
  return { data: groupQuestions(rows), error: null };
}

/**
 * Kumpulkan baris RPC per soal → ExamQuestion[].
 * Pertanyaan disimpan dalam urutan hasil RPC (shuffle_questions=true
 * membuat urutan acak dari server), opsi urut by option_order.
 */
function groupQuestions(rows: QuestionRow[]): ExamQuestion[] {
  const qmap = new Map<string, ExamQuestion>();
  for (const r of rows) {
    let q = qmap.get(r.question_id);
    if (!q) {
      q = {
        question_id: r.question_id,
        question_text: r.question_text,
        weight: r.weight,
        options: [],
      };
      qmap.set(r.question_id, q);
    }
    q.options.push({ option_id: r.option_id, option_text: r.option_text, option_order: r.option_order });
  }
  // Sort opsi per soal by option_order (RPC sudah urutkan, tapi tahan).
  const list = Array.from(qmap.values());
  for (const q of list) q.options.sort((a: QuestionOption, b: QuestionOption) => a.option_order - b.option_order);
  return list;
}

// ===========================================================================
// 4. MULAI / LANJUTKAN UJIAN
// ===========================================================================
export async function startExam(examId: string, studentId: string) {
  const { data, error } = await supabase.rpc('fn_start_exam_attempt', {
    p_exam_id: examId,
    p_student_id: studentId,
  });
  if (error) return { attemptId: null, error };
  // Return shape: fungsi UUID, bukan array.
  return { attemptId: data as string | null, error: null };
}

export async function getOwnAttempt(examId: string, studentId: string) {
  const { data, error } = await supabase
    .from('exam_attempts')
    .select(ATTEMPT_SELECT)
    .eq('exam_id', examId)
    .eq('student_id', studentId)
    .order('attempt_number', { ascending: false })
    .limit(1);
  if (error) return { data: null as ExamAttempt | null, error };
  return { data: (data as unknown as ExamAttempt[])?.[0] ?? null, error: null };
}

export async function getSavedAnswers(attemptId: string) {
  const { data, error } = await supabase
    .from('answers')
    .select('question_id, option_id, updated_at')
    .eq('attempt_id', attemptId);
  if (error) return { data: {} as Record<string, string | null>, error };
  const out: Record<string, string | null> = {};
  for (const row of (data as unknown as Array<{ question_id: string; option_id: string | null }>) ?? []) {
    out[row.question_id] = row.option_id;
  }
  return { data: out, error: null };
}

// ===========================================================================
// 5. SIMPAN JAWABAN
// ===========================================================================
export async function saveAnswer(
  attemptId: string,
  questionId: string,
  optionId: string,
  studentId: string,
) {
  const { data, error } = await supabase.rpc('fn_save_answer', {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_option_id: optionId,
    p_student_id: studentId,
  });
  if (error) return { ok: false, error };
  // RPC RETURN TABLE: baris [answer_id, attempt_id, question_id, option_id, updated_at].
  const row = Array.isArray(data) ? (data[0] as { updated_at?: string }) : (data as { updated_at?: string });
  return { ok: true, error: null, updatedAt: row?.updated_at ?? null };
}

// ===========================================================================
// 6. KUMPULKAN UJIAN (idempoten di server)
// ===========================================================================
export async function submitExam(attemptId: string, studentId: string) {
  const { data, error } = await supabase.rpc('fn_submit_exam', {
    p_attempt_id: attemptId,
    p_student_id: studentId,
  });
  if (error) return { data: null as ExamSubmitResult | null, error };
  // RETURN TABLE: row pertama.
  const row = Array.isArray(data) ? data[0] : data;
  return { data: (row as unknown as ExamSubmitResult) ?? null, error: null };
}

// ===========================================================================
// SINGLE
// ===========================================================================
export async function fetchExam(examId: string) {
  const { data, error } = await supabase.from('exams').select(EXAM_SELECT).eq('id', examId).single();
  if (error) return { data: null as Exam | null, error };
  return { data: data as unknown as Exam, error: null };
}

export async function getAttemptById(attemptId: string) {
  const { data, error } = await supabase.from('exam_attempts').select(ATTEMPT_SELECT).eq('id', attemptId).single();
  if (error) return { data: null as ExamAttempt | null, error };
  return { data: data as unknown as ExamAttempt, error: null };
}

// ===========================================================================
// 7. HASIL UJIAN (HANYA bila RLS memfilter is_published=true)
// ===========================================================================
export async function fetchPublishedResult(attemptId: string) {
  const { data, error } = await supabase
    .from('results')
    .select(RESULT_SELECT)
    .eq('attempt_id', attemptId);
  if (error) return { data: null as ResultRow | null, error };
  // RLS: hanya baris is_published=true yang bisa dilihat siswa.
  return { data: (data as unknown as ResultRow[])?.[0] ?? null, error: null };
}

// ===========================================================================
// 8. SEMUA HASIL PUBLISHED (untuk tab "Hasil" di dashboard siswa)
// ===========================================================================
export async function fetchAllPublishedResults(profile: Pick<Profile, 'id'>) {
  const { data, error } = await supabase
    .from('results')
    .select(`${RESULT_SELECT}, exams!inner(title)`)
    .eq('student_id', profile.id)
    .order('graded_at', { ascending: false });
  if (error) return { data: [] as Array<ResultRow & { exams: { title: string } }>, error };
  return {
    data: (data as unknown as Array<ResultRow & { exams: { title: string } }>) ?? [],
    error: null,
  };
}
