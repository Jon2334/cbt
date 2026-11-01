/**
 * Halaman masuk guru & administrator.
 *
 * Tata letak dua panel: panel kiri menjelaskan apa yang bisa dilakukan akun
 * guru/admin (supaya pengguna baru langsung paham), panel kanan berisi form.
 * Validasi di sini hanya untuk UX — otentikasi tetap divalidasi Supabase Auth,
 * dan role tetap dibaca dari tabel `profiles` (server), bukan dari token.
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  ClipboardList,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  LogIn,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';

// Validasi email sederhana (format standar). Cukup untuk UX.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CAPABILITIES = [
  {
    icon: ClipboardList,
    title: 'Kelola ujian',
    text: 'Buat ujian, atur jadwal & durasi, lalu terbitkan ke kelas.',
  },
  {
    icon: FileText,
    title: 'Bank soal',
    text: 'Simpan soal pilihan ganda beserta opsi jawabannya.',
  },
  {
    icon: BarChart3,
    title: 'Nilai peserta',
    text: 'Pantau hasil, publikasikan nilai, dan unduh laporan.',
  },
  {
    icon: Users,
    title: 'Khusus admin',
    text: 'Kelola pengguna, kelas, dan mata pelajaran sekolah.',
  },
];

export default function LoginPage() {
  const { signIn, authError } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const emailValid = EMAIL_RE.test(email.trim());
  const passwordTooShort = password.length > 0 && password.length < 6;
  const formValid = emailValid && password.length >= 6 && !submitting;
  const message = error || authError;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formValid) return;

    setSubmitting(true);
    setError('');

    const res = await signIn(email.trim(), password);
    if (res.ok) {
      navigate('/dashboard', { replace: true });
    } else {
      // Pesan asli dari Supabase (mis. kredensial salah / email belum
      // terverifikasi). Tidak menampilkan data sensitif apa pun.
      setError(res.error ?? 'Login gagal. Periksa email dan kata sandi Anda.');
    }
    setSubmitting(false);
  };

  const togglePassword = () => setShowPassword((v) => !v);

  return (
    <main className="min-h-svh bg-slate-100 lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Panel informasi (desktop) */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span
            className="flex size-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25"
            aria-hidden="true"
          >
            <GraduationCap size={24} />
          </span>
          <div>
            <p className="text-sm font-bold tracking-wide">CBT SEKOLAH</p>
            <p className="text-xs text-white/70">Ujian Berbasis Komputer</p>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Panel guru &amp; administrator
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/80">
            Satu tempat untuk menyusun soal, menyelenggarakan ujian, dan memantau
            nilai siswa. Menu di dalam panel menyesuaikan peran akun Anda.
          </p>

          <ul className="mt-8 space-y-4">
            {CAPABILITIES.map((c) => (
              <li key={c.title} className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20"
                  aria-hidden="true"
                >
                  <c.icon size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold">{c.title}</p>
                  <p className="text-xs text-white/75">{c.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="flex items-center gap-2 text-xs text-white/70">
          <ShieldCheck size={14} aria-hidden="true" />
          Peran akun diverifikasi di server — tidak dapat diubah dari browser.
        </p>
      </section>

      {/* Panel form */}
      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <form
          className="card w-full max-w-md p-6 sm:p-8"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span
              className="flex size-11 items-center justify-center rounded-xl bg-brand-600 text-white"
              aria-hidden="true"
            >
              <GraduationCap size={22} />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900">CBT Sekolah</p>
              <p className="text-xs text-slate-500">Panel Guru &amp; Admin</p>
            </div>
          </div>

          <span
            className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100"
            aria-hidden="true"
          >
            <LogIn size={22} />
          </span>
          <h1 className="mt-4 text-xl font-bold">Masuk ke akun Anda</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gunakan email dan kata sandi yang diberikan administrator sekolah.
          </p>

          {message && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          <div className="mt-5 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                className={
                  'input' + (!emailValid && email.length > 0 ? ' input-error' : '')
                }
                placeholder="nama@sekolah.sch.id"
                value={email}
                autoComplete="email"
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                required
                disabled={submitting}
              />
              {!emailValid && email.length > 0 && (
                <p className="hint-error">Format email tidak valid.</p>
              )}
            </div>

            <div>
              <label className="label" htmlFor="password">
                Kata sandi
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={
                    'input pr-12' + (passwordTooShort ? ' input-error' : '')
                  }
                  placeholder="Minimal 6 karakter"
                  value={password}
                  autoComplete="current-password"
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  required
                  minLength={6}
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-slate-500 transition-colors hover:text-slate-800"
                  onClick={togglePassword}
                  aria-label={
                    showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'
                  }
                  aria-pressed={showPassword}
                  disabled={submitting}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordTooShort && (
                <p className="hint-error">Kata sandi minimal 6 karakter.</p>
              )}
            </div>
          </div>

          <button
            className="btn btn-primary mt-6 w-full"
            type="submit"
            disabled={!formValid}
            aria-busy={submitting}
          >
            {submitting ? (
              <>
                <span className="spinner" aria-hidden="true" /> Memeriksa…
              </>
            ) : (
              <>
                <LogIn size={16} /> Masuk
              </>
            )}
          </button>

          <p className="mt-5 text-center text-xs text-slate-500">
            Belum punya akun guru atau admin? Hubungi administrator sekolah —
            pendaftaran mandiri hanya untuk akun siswa.
          </p>
        </form>
      </section>
    </main>
  );
}
