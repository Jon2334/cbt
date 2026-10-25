// Pemetaan pesan exception PostgreSQL (baris-by-baris dari 003_database_functions.sql)
// menjadi pesan ramah pengguna di aplikasi.
//
// PRINSIP: semua string di bawah VERBIFIKASI dari komentar atau RAISE EXCEPTION
// di file migrasi. Jika ada error yang TIDAK ada di daftar ini, jangan tebak —
// tampilkan pesan generik aman tanpa merinci detail server.

import { PostgrestError } from '@supabase/supabase-js';

// Daftar pesan exception yang dikenal (hasil audit). Urutan tidak penting — kita pakai Map.
const KNOWN = new Map<string, string>([
  // ---- Guard identitas / peran ----
  ['ID siswa tidak sesuai dengan pengguna terautentikasi.', 'Sesi tidak valid. Silakan keluar dan masuk kembali.'],
  ['Pengguna bukan siswa atau tidak ditemukan.', 'Akun ini bukan siswa atau profil belum dibuat.'],

  // ---- Guard akses ujian ----
  ['Ujian tidak ditemukan.', 'Ujian tidak ditemukan.'],
  ['Ujian belum diterbitkan.', 'Ujian ini belum dipublikasikan.'],
  ['Ujian tidak dalam jendela waktu yang valid.', 'Ujian belum dibuka atau sudah ditutup.'],
  ['Siswa tidak terdaftar di kelas ujian ini.', 'Anda tidak terdaftar di kelas untuk ujian ini.'],
  ['Maksimal percobaan ujian sudah tercapai.', 'Jumlah percobaan ujian sudah mencapai batas maksimal.'],

  // ---- fn_save_answer ----
  // Format dinamis: "Tidak dapat menyimpan jawaban: attempt sudah %s, %s"
  // (status & detail attempt). Kita deteksi via prefix, bukan string penuh.
]);

// Prefix pesan dinamis yang perlu di-match (bukan string penuh).
const DYNAMIC_PREFIXES: Array<{ prefix: string; msg: string }> = [
  { prefix: 'Tidak dapat menyimpan jawaban: attempt sudah ', msg: 'Jawaban tidak dapat disimpan karena sesi ujian sudah selesai.' },
  { prefix: 'Soal tidak termemukan dalam ujian ini.', msg: 'Soal ini tidak ditemukan dalam ujian.' },
  { prefix: 'Soal tidak termasuk dalam ujian ini.', msg: 'Soal ini bukan bagian dari ujian. Silakan muat ulang ujian.' },
];

/**
 * Ubah error Supabase / Postgrest / unknown menjadi pesan yang boleh
 * ditampilkan ke pengguna. Log pesan asli hanya ke console (bukan UI).
 */
export function friendlyError(err: unknown, fallback = 'Terjadi kesalahan. Silakan coba lagi.'): string {
  if (!err) return fallback;

  // PostgrestError / PostgresError / unknown
  const postgrest = err as PostgrestError;
  const rawMsg = postgrest.message ?? String(err);

  if (!rawMsg) return fallback;

  // 1) Exact match
  const known = KNOWN.get(rawMsg);
  if (known) return known;

  // 2) Dynamic prefix match
  for (const { prefix, msg } of DYNAMIC_PREFIXES) {
    if (rawMsg.startsWith(prefix)) return msg;
  }

  // 3) Netral, tanpa bocorkan detail internal ke UI.
  // eslint-disable-next-line no-console
  console.warn('[cbt] friendlyError (raw):', rawMsg);
  return fallback;
}

/**
 * Return "true" jika error terlihat seperti "koneksi terputus / network" —
 * supaya UI bisa menampilkan tombol "Coba Lagi" atau mempertahankan state.
 */
export function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const p = err as PostgrestError & { code?: string; status?: number; name?: string };
  if (p.code === 'F0802' || p.code === 'PGRST301' || p.name === 'NetworkError') return true;
  const s = String((p as { status?: number }).status ?? '');
  // 0 = fetch gagal (offline)
  if (s === '0' || s === '') {
    // Tandai hanya jika jelas bukan error Postgres biasa (PGRST/P2xxx/kode valid)
    if (!/^(PGRST|42|23|28|21|22|38|39)/.test(String(p.code ?? ''))) return true;
  }
  return false;
}
