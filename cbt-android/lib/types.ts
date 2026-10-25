// Types yang mencerminkan skema Supabase sesungguhnya (hasil audit 001/002/003).
// Jangan menambah kolom di sini tanpa memverifikasi dari migrasi SQL.

export type Role = 'admin' | 'teacher' | 'student';

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  email: string | null;
  created_at: string;
  updated_at: string;
}

// exams — lihat 001_initial_schema.sql. Kolom `is_published` TIDAK ada di sini;
// visibilitas hasil dikendalikan lewat `show_results_after`.
export interface Exam {
  id: string;
  title: string;
  description: string | null;
  subject_id: string | null;
  class_id: string | null;
  created_by: string | null;
  open_at: string;
  close_at: string;
  duration_minutes: number;
  max_attempts: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  show_results_after: boolean;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
  updated_at: string;
}

export type AttemptStatus = 'in_progress' | 'submitted' | 'timed_out' | 'graded';

// exam_attempts — 001.
export interface ExamAttempt {
  id: string;
  exam_id: string;
  student_id: string;
  started_at: string;
  submitted_at: string | null;
  status: AttemptStatus;
  time_spent_seconds: number | null;
  attempt_number: number;
}

// Baris flat dari RPC fn_get_student_exam_questions.
// Satu pertanyaan dengan N opsi menghasilkan N baris dengan question_id sama.
export interface QuestionRow {
  question_id: string;
  question_text: string;
  weight: number;
  option_id: string;
  option_text: string;
  option_order: number;
}

// Opsi jawaban per soal (hasil pengelompokan QuestionRow).
export interface QuestionOption {
  option_id: string;
  option_text: string;
  option_order: number;
}

// Satu soal siap digambarkan di UI.
export interface ExamQuestion {
  question_id: string;
  question_text: string;
  weight: number;
  options: QuestionOption[];
}

// Return RPC fn_submit_exam — lihat 003 baris 274-287.
// CATATAN AMAN: server TIDAK memfilter skor ini berdasarkan show_results_after.
// Klien HANYA boleh menampilkan skor bila query `results` (RLS is_published)
// mengembalikan baris. Jika tidak, nilai disembunyikan meskipun RPC sudah
// menghitungnya.
export interface ExamSubmitResult {
  attempt_id: string;
  exam_id: string;
  status: AttemptStatus;
  score: number;
  max_score: number;
  correct_answers: number;
  total_questions: number;
  graded_at: string;
}

// Baris `results` yang berhasil diambil setelah RLS memfilter is_published=true.
export interface ResultRow {
  id: string;
  attempt_id: string;
  exam_id: string;
  score: number;
  max_score: number;
  total_questions: number;
  correct_answers: number;
  graded_at: string;
  is_published: boolean;
}

// Dipakai di layar daftar ujian untuk menampilkan status attempt per ujian.
export interface ExamStatusFlags {
  attempt: ExamAttempt | null;
  attemptsUsed: number;
  attemptsLeft: number;
  canStart: boolean;
  canResume: boolean;
  completed: boolean;
}
