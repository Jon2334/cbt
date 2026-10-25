// app/result/[attemptId].tsx
// Detail hasil ujian per attempt. RLS (student_results_published) memastikan
// hanya baris is_published=true yang sampai ke sini; jika belum dipublikasikan
// maka fetchPublishedResult mengembalikan null dan kami menyembunyikan nilai.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { fetchExam, fetchPublishedResult } from '../../lib/exams';
import { friendlyError } from '../../lib/errors';
import { AppButton, Body, ErrorBanner, Screen, Spinner } from '../../lib/ui';
import type { Exam, ResultRow } from '../../lib/types';

export default function ResultScreen() {
  const router = useRouter();
  const { attemptId } = useLocalSearchParams<{ attemptId: string }>();
  const { profile, ready, isStudent, signOut } = useAuth();
  const [result, setResult] = useState<ResultRow | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !attemptId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      const res = await fetchPublishedResult(attemptId);
      if (res.error) {
        setError(friendlyError(res.error));
        setResult(null);
        setExam(null);
        setLoading(false);
        return;
      }
      if (cancelled) return;
      setResult(res.data);
      if (res.data?.exam_id) {
        const e = await fetchExam(res.data.exam_id);
        if (!cancelled) setExam(e.data);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [ready, attemptId]);

  if (!ready) {
    return (
      <Screen title="Hasil">
        <Spinner />
        <Body style={{ textAlign: 'center' }}>Memverifikasi sesi…</Body>
      </Screen>
    );
  }

  if (!profile || !isStudent) {
    return (
      <Screen title="Hasil">
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Body>Halaman ini khusus siswa yang terautentikasi.</Body>
          <AppButton title="Keluar" onPress={() => signOut()} style={{ backgroundColor: '#1a202c' }} />
        </View>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen title="Hasil">
        <Spinner />
        <Body style={{ textAlign: 'center' }}>Memuat hasil ujian…</Body>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen title="Hasil">
        <ErrorBanner message={error} />
        <AppButton title="Kembali ke Daftar" onPress={() => router.replace('/results')} style={{ backgroundColor: '#1a202c' }} />
      </Screen>
    );
  }

  // RLS sudah menyembunyikan baris yang belum dipublikasikan → datang ke sini
  // berarti hasil sudah dipublikasikan. Tetap cek is_published sebagai lapisan
  // keamanan pertambahan (defense-in-depth).
  if (!result || !result.is_published) {
    return (
      <Screen title="Hasil">
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Body>Nilai belum dipublikasikan oleh guru.</Body>
          <AppButton title="Kembali ke Daftar Ujian" onPress={() => router.replace('/exams')} />
          <AppButton title="Lihat Semua Hasil" onPress={() => router.replace('/results')} style={{ backgroundColor: '#1a202c' }} />
        </View>
      </Screen>
    );
  }

  const percentage =
    result.max_score > 0 ? Math.round((result.score / result.max_score) * 100) : 0;

  return (
    <Screen title={exam?.title ?? 'Hasil Ujian'}>
      <View style={styles.card}>
        <Body style={{ color: '#eceff1', fontWeight: '600' }}>{exam?.title ?? 'Ujian'}</Body>
        <Body style={{ color: '#4caf50', marginTop: 4 }}>Nilai sudah dipublikasikan</Body>
        <Body style={styles.score}>{result.score} / {result.max_score}</Body>
        <Body style={{ color: '#90a4ae' }}>({percentage}% — {result.correct_answers} benar dari {result.total_questions} soal)</Body>
        <Body style={{ marginTop: 8 }}>Dinilai pada: {new Date(result.graded_at).toLocaleString('id-ID')}</Body>
      </View>
      <View style={styles.actions}>
        <AppButton title="Kembali ke Daftar Ujian" onPress={() => router.replace('/exams')} />
        <AppButton title="Semua Hasil" onPress={() => router.replace('/results')} style={{ backgroundColor: '#1a202c' }} />
      </View>
    </Screen>
  );
}

const styles = {
  card: {
    backgroundColor: '#1d2733',
    borderRadius: 10,
    padding: 16,
    marginVertical: 12,
  } as const,
  score: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2979ff',
    marginVertical: 8,
  } as const,
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 } as const,
};
