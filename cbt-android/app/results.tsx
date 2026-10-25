// app/results.tsx
// Daftar hasil ujian yang sudah dipublikasikan untuk siswa yang login.
// Data hanya berisi baris dengan is_published=true berkat RLS
// (policy student_results_published).
import { useCallback, useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { fetchAllPublishedResults } from '../lib/exams';
import { AppButton, Body, ErrorBanner, Screen, Spinner } from '../lib/ui';
import type { ResultRow } from '../lib/types';

type ResultRowWithExam = ResultRow & { exams: { title: string } };

export default function ResultsScreen() {
  const router = useRouter();
  const { profile, ready, isStudent, signOut } = useAuth();
  const [data, setData] = useState<ResultRowWithExam[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    const res = await fetchAllPublishedResults(profile);
    if (res.error) {
      setError('Gagal memuat hasil ujian.');
      setData([]);
    } else {
      setData(res.data);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    if (profile) load();
  }, [profile, load]);

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

  return (
    <Screen title="Hasil Ujian Anda">
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        onRefresh={load}
        refreshing={loading}
        contentContainerStyle={{ paddingVertical: 8 }}
        ListEmptyComponent={
          <Body>{loading ? 'Memuat hasil…' : 'Belum ada hasil ujian yang dipublikasikan.'}</Body>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Body style={{ color: '#eceff1', fontWeight: '600' }}>
                {item.exams?.title ?? `Attempt ${item.attempt_id.slice(0, 8)}`}
              </Body>
              <View style={{ alignItems: 'flex-end' }}>
                <Body style={{ color: '#4caf50' }}>{item.is_published ? 'Dipublikasikan' : 'Disimpan'}</Body>
                <Body>{item.score} / {item.max_score}</Body>
              </View>
            </View>
            <Body>Benar: {item.correct_answers} / {item.total_questions}</Body>
            <AppButton
              title="Lihat detail"
              onPress={() => router.push(`/result/${encodeURIComponent(item.attempt_id)}`)}
              style={{ backgroundColor: '#1a202c' }}
            />
          </View>
        )}
      />
      {error ? <ErrorBanner message={error} /> : null}
    </Screen>
  );
}

const styles = {
  card: {
    backgroundColor: '#1d2733',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 10,
  } as const,
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' } as const,
};
