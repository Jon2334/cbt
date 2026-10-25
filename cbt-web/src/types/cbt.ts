/**
 * Client-side type models for the CBT dashboard.
 * These mirror the Supabase schema in supabase/migrations/*.sql but carry no
 * secrets and are safe to use in the frontend. Only non-sensitive columns are
 * typed here; answer keys live in `question_correct_answers` and are never
 * exposed to the client (protected by RLS + SECURITY DEFINER functions).
 */

export type UserRole = 'student' | 'teacher' | 'admin';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'student' | 'teacher' | 'admin';
  avatar_url: string | null;
}

export interface Subject {
  id: string;
  name: string;
  description: string | null;
}

export interface ClassRecord {
  id: string;
  name: string;
  year: string | null;
  subject_id: string | null;
}

export interface TeacherAssignment {
  id: string;
  teacher_id: string;
  class_id: string | null;
  subject_id: string | null;
}

export type ExamStatus = 'draft' | 'published' | 'archived';

export interface Exam {
  id: string;
  title: string;
  description: string | null;
  subject_id: string;
  class_id: string | null;
  schedule_start: string | null;
  schedule_end: string | null;
  duration_minutes: number | null;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  max_attempts: number;
  status: ExamStatus;
}

export interface Question {
  id: string;
  subject_id: string;
  topic: string | null;
  type: string | null; // 'multiple_choice_single' on MVP
  text: string;
  difficulty: number | null;
  is_active: boolean;
  created_by: string;
}

export type ResultStatus = 'pending' | 'graded' | 'released';

export interface Result {
  id: string;
  exam_id: string;
  student_id: string;
  score: number | null;
  graded_at: string | null;
  status: ResultStatus;
  is_released: boolean;
}
