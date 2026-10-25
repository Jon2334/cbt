import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { LogIn } from 'lucide-react';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const res = await signIn(email, password);
    if (res.ok) {
      navigate('/dashboard', { replace: true });
    } else {
      setError(res.error ?? 'Login gagal.');
    }
    setSubmitting(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <LogIn size={28} />
          <h1>CBT Dashboard — Guru</h1>
          <p>Masuk ke akun Anda untuk melanjutkan.</p>
        </div>
        {error && <div className="login-error">{error}</div>}
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              placeholder="guru@sekolah.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            Kata Sandi
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="current-password"
            />
          </label>
          <button className="primary-btn" type="submit" disabled={submitting}>
            {submitting ? 'Masuk...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}
