// Hook logika pemain ujian. Semua mutasi/me-time hit ke backend melalui lib/exams.ts.
// Tanggung jawab:
//  - Start (atau resume) attempt via RPC.
//  - Fetch soal via RPC (ter-shuffle, tanpa kunci).
//  - Auto-save jawaban (optimistic + rollback on error).
//  - Hitung timer dari started_at (server) & auto-submit saat habis.
//  - Submit idempotent (guard status in_progress).
//  - Persist jawaban di-state sehingga navigasi back tidak kehilangan data.
//
// Catatan timer: kami hitung remaining dari attempt.started_at (ISO) vs Date.now()
// (jam perangkat). Ini cukup akurat untuk UX; RPC submit tetap memakai logika
// server-side (is_published / time_spent) untuk nilai & status final.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  fetchExam,
  fetchExamQuestions,
  getOwnAttempt,
  getSavedAnswers,
  getAttemptById,
  saveAnswer,
  startExam,
  submitExam,
} from './exams';
import type {
  Exam,
  ExamAttempt,
  ExamQuestion,
  ExamSubmitResult,
} from './types';
import { isNetworkError } from './errors';

export type PlayerPhase = 'loading' | 'ready' | 'submitting' | 'done' | 'error';

export interface PlayerState {
  phase: PlayerPhase;
  exam: Exam | null;
  attempt: ExamAttempt | null;
  questions: ExamQuestion[];
  // jawaban lokal: question_id -> option_id | null
  answers: Record<string, string | null>;
  // countdown (detik)
  timeLeft: number;
  error: string | null;
  networkError: boolean;
  submitResult: ExamSubmitResult | null;
}

export interface PlayerApi {
  selectOption: (questionId: string, optionId: string) => Promise<void>;
  goToNext: () => void;
  goToPrev: () => void;
  currentIdx: number;
  setCurrentIdx: (i: number) => void;
  submit: () => Promise<void>;
}

export function useExamPlayer(
  examId: string,
  studentId: string,
  attemptId?: string,
): PlayerState & PlayerApi {
  const [state, setState] = useState<PlayerState>({
    phase: 'loading',
    exam: null,
    attempt: null,
    questions: [],
    answers: {},
    timeLeft: 0,
    error: null,
    networkError: false,
    submitResult: null,
  });

  const [currentIdx, setCurrentIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Bungkus submit supaya tak bisa dipanggil ganda.
  const submitLock = useRef(false);

  // ---- cleanup timer ----
  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  // ---- inisialisasi: exam + attempt (start or resume) ----
  const init = useCallback(async () => {
    setState((s) => ({ ...s, phase: 'loading', error: null, networkError: false }));
    try {
      const examRes = await fetchExam(examId);
      if (examRes.error || !examRes.data) {
        throw new Error('Ujian tidak ditemukan.');
      }
      const exam = examRes.data;

      let attempt: ExamAttempt | null = null;
      // Jika deep-link ke attempt tertentu (resume), gunakan ID eksplisit lewat
      // getAttemptById (RLS tetap mewajibkan attempt milik auth.uid()).
      if (attemptId) {
        const byId = await getAttemptById(attemptId);
        if (byId.error) throw new Error('Sesi ujian tidak ditemukan.');
        attempt = byId.data ?? null;
      }
      // Fallback: attempt terakhir milik siswa untuk ujian ini (untuk deep-link
      // /exam/:id tanpa ?attempt=, atau saat daftar mengarahkan "Lanjutkan").
      if (!attempt) {
        const own = await getOwnAttempt(examId, studentId);
        if (own.error) throw new Error('Sesi ujian tidak ditemukan.');
        attempt = own.data ?? null;
      }

      // Jika belum ada attempt (baru start), panggil RPC.
      if (!attempt) {
        const startRes = await startExam(examId, studentId);
        if (startRes.error) throw new Error('Tidak dapat memulai ujian.');
        const fresh = await getAttemptById(startRes.attemptId!);
        if (fresh.error) throw new Error('Attempt tidak ditemukan.');
        attempt = fresh.data ?? null;
      }

      if (!attempt || attempt.status !== 'in_progress') {
        // sudah submitted / timed out → tidak boleh dibuka pemain.
        setState((s) => ({ ...s, phase: 'error', error: 'Ujian sudah selesai.' }));
        return;
      }

      // Fetch questions + saved answers (untuk resume yang aman).
      const qRes = await fetchExamQuestions(examId, studentId);
      if (qRes.error) throw new Error('Gagal memuat soal.');
      const questions = qRes.data;

      let answers: Record<string, string | null> = {};
      const ansRes = await getSavedAnswers(attempt.id);
      if (!ansRes.error) answers = ansRes.data;

      const startedAt = new Date(attempt.started_at).getTime();
      const remaining = Math.max(0, exam.duration_minutes * 60 - Math.floor((Date.now() - startedAt) / 1000));

      setState((s) => ({ ...s, phase: 'ready', exam, attempt, questions, answers, timeLeft: remaining }));
    } catch (e) {
      setState((s) => ({
        ...s,
        phase: 'error',
        error: isNetworkError(e) ? 'Koneksi terputus. Periksa jaringan lalu coba lagi.' : 'Gagal memulai ujian.',
        networkError: isNetworkError(e),
      }));
    }
  }, [examId, studentId, attemptId]);

  // lazy import suporte rpc start
  const fetchStart = async (id: string, sid: string) => {
    // import di sini agar hook tetap self-contained.
    const mod = await import('./exams');
    const startRes = await mod.startExam(id, sid);
    return startRes;
  };
  const getAttemptById = async (id: string) => {
    const mod = await import('./exams');
    return mod.getAttemptById(id);
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return clearTimer;
  }, [init, clearTimer]);

  // ---- timer ----
  useEffect(() => {
    if (state.phase !== 'ready') return;
    const start = Date.now();
    const target = state.timeLeft;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const next = target - elapsed;
      if (next <= 0) {
        clearTimer();
        setState((s) => ({ ...s, timeLeft: 0 }));
        // Auto-submit saat waktu habis (hindari double submit lewat lock).
        if (!submitLock.current) {
          submitLock.current = true;
          submitExam(state.attempt!.id, studentId).then(() => {
            submitLock.current = false;
          });
        }
        return;
      }
      setState((s) => ({ ...s, timeLeft: next }));
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return clearTimer;
  }, [state.phase, state.attempt?.id, studentId, clearTimer, state.timeLeft]);

  // ---- pilih opsi ----
  const selectOption = useCallback(
    async (questionId: string, optionId: string) => {
      const prev = state.answers[questionId] ?? null;
      // Optimistic update.
      setState((s) => ({ ...s, answers: { ...s.answers, [questionId]: optionId } }));
      try {
        const res = await saveAnswer(state.attempt!.id, questionId, optionId, studentId);
        if (res.error) {
          // Rollback.
          setState((s) => ({ ...s, answers: { ...s.answers, [questionId]: prev } }));
          setState((s) => ({
            ...s,
            error: 'Jawaban tidak tersimpan (koneksi). Coba pilih lagi.',
            networkError: isNetworkError(res.error),
          }));
        }
      } catch (e) {
        setState((s) => ({ ...s, answers: { ...s.answers, [questionId]: prev } }));
        setState((s) => ({
          ...s,
          error: isNetworkError(e) ? 'Koneksi terputus; jawaban belum tersimpan.' : 'Gagal menyimpan jawaban.',
          networkError: isNetworkError(e),
        }));
      }
    },
    [state.answers, state.attempt?.id, studentId],
  );

  // ---- submit ----
  const submit = useCallback(async () => {
    if (state.phase !== 'ready' || !state.attempt || submitLock.current) return;
    const answered = Object.values(state.answers).filter(Boolean).length;
    const total = state.questions.length;
    Alert.alert(
      'Kumpulkan Ujian?',
      `Anda telah menjawab ${answered}/${total} soal. Yakin ingin mengumpulkan?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Kumpulkan',
          style: 'destructive',
          onPress: () => doSubmit(),
        },
      ],
    );
  }, [state.phase, state.attempt, state.answers, state.questions]);

  const doSubmit = useCallback(async () => {
    if (submitLock.current || !state.attempt) return;
    submitLock.current = true;
    setState((s) => ({ ...s, phase: 'submitting', error: null }));
    try {
      const res = await submitExam(state.attempt.id, studentId);
      if (res.error) {
        setState((s) => ({ ...s, phase: 'ready', error: 'Gagal mengumpulkan ujian.', networkError: isNetworkError(res.error) }));
        submitLock.current = false;
        return;
      }
      setState((s) => ({ ...s, phase: 'done', submitResult: res.data, error: null }));
    } catch (e) {
      setState((s) => ({
        ...s,
        phase: 'ready',
        error: isNetworkError(e) ? 'Koneksi terputus; ujian belum dikumpulkan.' : 'Gagal mengumpulkan ujian.',
        networkError: isNetworkError(e),
      }));
      submitLock.current = false;
    }
  }, [state.attempt, studentId, state.answers, state.questions]);

  const goNext = useCallback(() => {
    if (currentIdx < (state.questions.length - 1)) setCurrentIdx(currentIdx + 1);
  }, [currentIdx, state.questions.length]);

  const goPrev = useCallback(() => {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  }, [currentIdx]);

  return {
    ...state,
    selectOption,
    goToNext: goNext,
    goToPrev: goPrev,
    currentIdx,
    setCurrentIdx,
    submit,
  };
}
