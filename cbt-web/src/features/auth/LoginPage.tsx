import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { Eye, EyeOff, LogIn } from 'lucide-react';

// Validasi email sederhana (format standar). Cukup untuk UX; otentikasi
// tetap divalidasi penuh oleh Supabase Auth di backend.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const emailValid = EMAIL_RE.test(email.trim());
  const formValid = emailValid && password.length >= 6 && !submitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formValid) return;

    setSubmitting(true);
    setError('');

    const res = await signIn(email.trim(), password);
    if (res.ok) {
      navigate('/dashboard', { replace: true });
    } else {
      // Pesan error asli dari Supabase (mis. kredensial salah, email belum
      // terverifikasi). Jangan menampilkan data sensitif.
      setError(res.error ?? 'Login gagal. Periksa email dan kata sandi Anda.');
    }
    setSubmitting(false);
  };

  const togglePassword = () => setShowPassword((v) => !v);

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit} noValidate>
        <div className="login-header">
          <div className="login-logo" aria-hidden="true">
            <LogIn size={32} />
          </div>
          <h1>Login Guru</h1>
          <p>Silakan masuk untuk mengelola ujian dan melihat hasil siswa.</p>
        </div>

        {error && <div className="login-error" role="alert">{error}</div>}

        <div className="form-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="guru@sekolah.id"
            value={email}
            autoComplete="email"
            onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
            required
            disabled={submitting}
          />
          {!emailValid && email.length > 0 && (
            <span className="field-hint error">Format email tidak valid.</span>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="password">Kata Sandi</label>
          <div className="password-wrapper">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              autoComplete="current-password"
              onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
              required
              minLength={6}
              disabled={submitting}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={togglePassword}
              aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
              aria-pressed={showPassword}
              tabIndex={0}
              disabled={submitting}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {password.length > 0 && password.length < 6 && (
            <span className="field-hint error">Kata sandi minimal 6 karakter.</span>
          )}
        </div>

        <button
          className="primary-btn"
          type="submit"
          disabled={!formValid}
          aria-busy={submitting}
        >
          {submitting ? (
            <span className="btn-loading">
              <span className="spinner" aria-hidden="true" />
              Masuk…
            </span>
          ) : (
            'Masuk'
          )}
        </button>

        <footer className="login-footer">
          <p className="muted">Belum punya akun guru? Hubungi administrator sekolah.</p>
        </footer>
      </form>
    </main>
  );
}
