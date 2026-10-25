// app/index.tsx
// Mengganti placeholder "Fitur ujian akan diimplementasikan..." dengan gate otorisasi.
// - butuh sesi (ready): tunjukkan loading.
// - belum ada profile → arahkan ke /sign-in.
// - sudah login sebagai siswa → arahkan ke /exams (daftar ujian).
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';
import { Body, Screen, Spinner } from '../lib/ui';

export default function Index() {
  const { profile, ready } = useAuth();

  if (!ready) {
    return (
      <Screen>
        <Spinner />
        <Body style={{ textAlign: 'center', marginTop: 12 }}>Memverifikasi sesi…</Body>
      </Screen>
    );
  }

  if (!profile) {
    return <Redirect href="/sign-in" />;
  }

  return <Redirect href="/exams" />;
}