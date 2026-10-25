import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { useExamPlayer } from '../../lib/exam-player';
import { AppButton, Body, ErrorBanner, Screen } from '../../lib/ui';
import type { ExamQuestion } from '../../lib/types';

export default function ExamPlayerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; attempt?: string }>();
  const { id: examId, attempt: attemptId } = params;
  const { profile, ready } = useAuth();

  const {
    phase,
    exam,
    attempt,
    questions,
    answers,
    timeLeft,
    error,
    networkError,
    currentIdx,
    setCurrentIdx,
    selectOption,
    goToNext,
    goToPrev,
    submit,
  } = useExamPlayer(examId, profile ? profile.id : '', attemptId);

  // Guard: siswa belum terautentikasi. useAuth mengembalikan ready=true baru
  // setelah sesi & role selesai dimuat; sampai begitu tunjukkan loading.
  if (!ready || !profile) {
    return (
      <Screen title="Ujian">
        <Body>Memuat sesi…</Body>
      </Screen>
    );
  }

  // Handle submit selesai: navigasi ke halaman result (yang mengecek RLS
  // apakah nilai sudah dipublikasikan).
  useEffect(() => {
    if (phase === 'done' && exam && attempt?.id) {
      const t = setTimeout(() => {
        router.replace(`/result/${encodeURIComponent(attempt!.id)}`);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [phase, exam, attempt?.id, router]);

  if (phase === 'error' && !exam) {
    return (
      <Screen title="Ujian">
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ErrorBanner message={error ?? 'Gagal memuat ujian.'} />
          <AppButton title="Kembali ke Daftar" onPress={() => router.replace('/exams')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title={exam?.title ?? 'Ujian'}>
      {phase === 'loading' ? (
        <Body>Memuat soal…</Body>
      ) : (
        <>
          {/* Error inline (selama ready) */}
          <ErrorBanner message={error} />
          <View style={styles.meta}>
            <Body>Pertanyaan {currentIdx + 1} dari {questions.length}</Body>
            <Body>{!networkError ? '' : 'Mode offline: jawaban akan disinkron saat online.'}</Body>
            <Body style={{ color: '#ff8a80' }}>Sisa waktu: {formatTime(timeLeft)}</Body>
          </View>

          {error ? <ErrorBanner message={error} /> : null}

          {phase === 'ready' && questions.length > 0 && (() => {
            const q = questions[currentIdx];
            if (!q) return <Body>Soal tidak tersedia.</Body>;
            return <QuestionView q={q} answered={answers[q.question_id]} onSelect={selectOption} />;
          })()}

          <View style={styles.nav}>
            <AppButton title="Sebelumnya" onPress={goToPrev} style={{ backgroundColor: '#1a202c' }} />
            <AppButton title="Berikutnya" onPress={goToNext} style={{ backgroundColor: '#1a202c' }} />
          </View>

          {phase === 'ready' ? (
            <AppButton title="Kumpulkan Ujian" onPress={submit} style={{ backgroundColor: '#c62828' }} />
          ) : (
            <Body>Mengumpulkan…</Body>
          )}
        </>
      )}
    </Screen>
  );
}

function QuestionView({
  q,
  answered,
  onSelect,
}: {
  q: ExamQuestion;
  answered: string | null;
  onSelect: (qid: string, oid: string) => Promise<void>;
}) {
  return (
    <View style={styles.qcard}>
      <Body style={{ color: '#eceff1', fontWeight: '600' }}>{q.question_text}</Body>
      <View style={{ marginTop: 12, gap: 8 }}>
        {q.options.map((opt) => {
          const selected = answered === opt.option_id;
          return (
            <AppButton
              key={opt.option_id}
              title={opt.option_text}
              onPress={async () => { await onSelect(q.question_id, opt.option_id); }}
              style={selected ? { backgroundColor: '#2979ff' } : { backgroundColor: '#1d2733' }}
            />
          );
        })}
      </View>
    </View>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

const styles = {
  meta: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 } as const,
  qcard: { backgroundColor: '#1d2733', borderRadius: 10, padding: 12, marginVertical: 8 } as const,
  nav: { flexDirection: 'row', gap: 10, alignItems: 'center', marginVertical: 10 } as const,
};
