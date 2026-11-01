import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { listExamsWithStatus } from '../lib/exams';
import { AppButton, Body, ErrorBanner, Screen } from '../lib/ui';
import type { Exam, ExamStatusFlags } from '../lib/types';

type ExamWithStatus = Exam & ExamStatusFlags;

export default function ExamsListScreen() {
  const router = useRouter();
  const { profile, isStudent, ready, signOut } = useAuth();
  const [data, setData] = useState<ExamWithStatus[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guard setState setelah unmount + pembuangan hasil fetch yang sudah usang
  // (mis. pull-to-refresh ganda) supaya tidak menimpa data terbaru.
  const mounted = useRef(true);
  const reqSeq = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!profile) return;
    const seq = ++reqSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await listExamsWithStatus(profile);
      if (!mounted.current || seq !== reqSeq.current) return;
      if (res.error) {
        setError('Gagal memuat daftar ujian.');
        setData([]);
      } else {
        setData(res.data);
      }
    } catch (e) {
      // Exception tak terduga (mis. fetch gagal total) tidak boleh membuat
      // spinner berputar selamanya / promise rejection tanpa penangan.
      if (!mounted.current || seq !== reqSeq.current) return;
      setError(e instanceof Error ? `Gagal memuat daftar ujian: ${e.message}` : 'Gagal memuat daftar ujian.');
      setData([]);
    } finally {
      if (mounted.current && seq === reqSeq.current) setLoading(false);
    }
  }, [profile]);

  // WAJIB di dalam useEffect. Memanggil load() di badan render akan membuat
  // render-phase update (setLoading/setError sinkron) → React loop sampai
  // melempar "Too many re-renders" → aplikasi langsung tertutup setelah login.
  useEffect(() => {
    if (!ready || !profile) return;
    void load();
  }, [ready, profile, load]);

  const onRefresh = useCallback(() => {
    // Force reload session & exams.
    void load();
  }, [load]);

  if (!ready) {
    return (
      <Screen title="Ujian">
        <Body>Memuat sesi…</Body>
      </Screen>
    );
  }

  if (!isStudent) {
    return (
      <Screen title="Ujian">
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Body>Halaman ini khusus siswa. Peran Anda bukan student.</Body>
          <AppButton title="Keluar" onPress={() => signOut()} style={{ backgroundColor: '#1a202c' }} />
        </View>
      </Screen>
    );
  }

  const render = ({ item }: { item: ExamWithStatus }) => (
    <ExamCard item={item} router={router} />
  );

  return (
    <Screen title="Ujian">
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={render}
        contentContainerStyle={{ paddingVertical: 8 }}
        onRefresh={onRefresh}
        refreshing={loading}
        ListEmptyComponent={<Body>{loading ? 'Memuat ujian…' : 'Belum ada ujian yang tersedia.'}</Body>}
      />
      {error ? <ErrorBanner message={error} /> : null}
    </Screen>
  );
}

function statusLabel(item: ExamWithStatus): string {
  if (item.canResume && item.attempt?.status === 'in_progress') return 'Lanjutkan';
  if (item.completed) return 'Selesai';
  if (item.canStart) return 'Belum mulai';
  if (item.attemptsLeft === 0) return 'Kuota habis';
  return '?';
}

function statusColor(item: ExamWithStatus): string {
  if (item.canResume && item.attempt?.status === 'in_progress') return '#ffab40';
  if (item.completed) return '#4caf50';
  return '#90a4ae';
}

function ExamCard({ item, router }: { item: ExamWithStatus; router: ReturnType<typeof useRouter> }) {
  const label = statusLabel(item);
  const color = statusColor(item);
  const openDate = new Date(item.open_at).toLocaleString('id-ID');
  const closeDate = new Date(item.close_at).toLocaleString('id-ID');

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Body style={{ color: '#eceff1', fontWeight: '600' }}>{item.title}</Body>
          <Body>Deskripsi: {item.description || '-'}</Body>
          <Body>Buka: {openDate}</Body>
          <Body>Tutup: {closeDate}</Body>
          <Body>Durasi: {item.duration_minutes} menit</Body>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ ...styles.badge, backgroundColor: color + '22', borderColor: color }}>
            <Body style={{ color, fontWeight: '600' }}>{label}</Body>
          </View>
          <Body>{item.attemptsUsed}/{item.max_attempts} percobaan</Body>
        </View>
      </View>

      <View style={styles.cardActions}>
        {item.canResume && item.attempt?.status === 'in_progress' ? (
          <AppButton
            title={`Lanjutkan (${label})`}
            onPress={() => router.push(`/exam/${item.id}?attempt=${item.attempt!.id}`)}
          />
        ) : item.canStart ? (
          <AppButton title="Mulai Ujian" onPress={() => router.push(`/exam/${item.id}`)} />
        ) : null}
        <AppButton
          title="Riwayat Hasil"
          onPress={() => router.push(`/results`)}
          style={{ backgroundColor: '#1a202c' }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create<Record<string, ViewStyle>>({
  card: {
    backgroundColor: '#1d2733',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: 'row', gap: 8 },
  cardActions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
});
