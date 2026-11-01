// app/index.tsx
// Mengganti placeholder "Fitur ujian akan diimplementasikan..." dengan gate otorisasi.
// - belum selesai memuat sesi → loading.
// - belum ada sesi → arahkan ke /sign-in.
// - sudah login tapi profil masih dimuat → loading ("Menyiapkan profil siswa...").
// - sudah login sebagai siswa → arahkan ke /exams (daftar ujian).
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';
import { AppButton, Body, ErrorBanner, Screen, Spinner } from '../lib/ui';

export default function Index() {
  const { profile, ready, hasSession, authError, refreshProfile, signOut } = useAuth();

  if (!ready) {
    return (
      <Screen>
        <Spinner />
        <Body style={{ textAlign: 'center', marginTop: 12 }}>Memverifikasi sesi…</Body>
      </Screen>
    );
  }

  // Belum ada sesi → form masuk.
  if (!hasSession) {
    return <Redirect href="/sign-in" />;
  }

  // Ada sesi tapi profil belum tersedia: RPC get_current_profile() masih jalan
  // (atau gagal). Dulu di titik ini terjadi RACE — tepat setelah login `profile`
  // masih null selama RPC berjalan, sehingga pengguna yang BERHASIL login
  // langsung dilempar kembali ke /sign-in. Sekarang "belum login" (hasSession
  // false) dibedakan dari "sedang memuat profil" (hasSession true, profile null).
  if (!profile) {
    return (
      <Screen title="Memuat Profil">
        <Spinner />
        <Body style={{ textAlign: 'center', marginTop: 12 }}>Menyiapkan profil siswa...</Body>
        <ErrorBanner message={authError ? `Gagal memuat profil: ${authError}` : null} />
        {authError ? (
          <AppButton
            title="Coba Lagi"
            onPress={() => {
              void refreshProfile();
            }}
          />
        ) : null}
        <AppButton
          title="Keluar"
          onPress={() => {
            void signOut();
          }}
          style={{ backgroundColor: '#1a202c' }}
        />
      </Screen>
    );
  }

  return <Redirect href="/exams" />;
}