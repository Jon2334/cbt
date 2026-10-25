/**
 * Client-side type models for the CBT dashboard.
 * These mirror the Supabase schema in supabase/migrations/*.sql but carry no
 * secrets and are safe to use in the frontend. Only non-sensitive columns are
 * typed here; answer keys live in `question_correct_answers` and are never
 * exposed to the client (protected by RLS + SECURITY DEFINER functions).
 *
 * Kolom ditarik langsung dari migrasi 001 (`profiles`, `classes`, `subjects`,
 * `teacher_assignments`, `questions`, `question_options`, `exams`, `results`)
 * dan tidak dibiarkan "menebak" kolom yang tidak ada.
 */
import type { UserRole } from '../lib/role';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClassRecord {
  id: string;
  name: string;
  grade_level: string | null;
  academic_year: string;
  is_archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeacherAssignment {
  id: string;
  teacher_id: string;
  class_id: string | null;
  subject_id: string | null;
  created_at: string;
}

export interface QuestionOption {
  id: string;
  question_id: string;
  option_text: string;
  option_order: number;
  created_at: string;
}

export interface Question {
  id: string;
  subject_id: string;
  topic: string | null;
  question_text: string;
  weight: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type ExamStatus = 'draft' | 'published' | 'archived';

export interface Exam {
  id: string;
  title: string;
  description: string | null;
  subject_id: string;
  class_id: string; // NOT NULL di skema 001 (bukan nullable)
  created_by: string;
  open_at: string;
  close_at: string;
  duration_minutes: number;
  max_attempts: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  show_results_after: boolean;
  status: ExamStatus;
  created_at: string;
  updated_at: string;
}

export interface ExamAttempt {
  id: string;
  exam_id: string;
  student_id: string;
  started_at: string;
  submitted_at: string | null;
  status: 'in_progress' | 'submitted' | 'timed_out' | 'graded';
  time_spent_seconds: number;
  attempt_number: number;
}

export interface Answer {
  id: string;
  attempt_id: string;
  question_id: string;
  option_id: string | null;
  answered_at: string;
  updated_at: string;
}

export interface Result {
  id: string;
  attempt_id: string;
  student_id: string;
  exam_id: string;
  score: number; // NOT NULL di skema (0–100)
  max_score: number;
  total_questions: number;
  correct_answers: number;
  graded_at: string;
  is_published: boolean;
}
