import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
} from 'react-router-dom';
import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from './lib/auth';
import { canManageUsers, hasRole } from './lib/role';
import LoginPage from './features/auth/LoginPage';
import DashboardHome from './features/dashboard/DashboardHome';
import ExamsPage from './features/dashboard/exams/ExamsPage';
import ExamForm from './features/dashboard/exams/ExamForm';
import ExamQuestions from './features/dashboard/exams/ExamQuestions';
import ExamResults from './features/dashboard/exams/ExamResults';
import QuestionsPage from './features/dashboard/questions/QuestionsPage';
import QuestionForm from './features/dashboard/questions/QuestionForm';
import './App.css';

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user)
    return <Navigate to="/login" replace state={{ from: '/dashboard' }} />;
  if (!hasRole(role, 'teacher'))
    return <Navigate to="/login" replace state={{ from: '/dashboard' }} />;
  return <>{children}</>;
}

function Loading() {
  return <div className="loading">Memuat…</div>;
}

function ProtectedLayout({ children }: { children: ReactNode }) {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'nav-link active' : 'nav-link';

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="logo">CBT Dashboard</div>
        <nav>
          <NavLink to="/dashboard" className={linkClass}>Beranda</NavLink>
          <NavLink to="/exams" className={linkClass}>Ujian</NavLink>
          <NavLink to="/questions" className={linkClass}>Bank Soal</NavLink>
          <NavLink to="/results" className={linkClass}>Hasil</NavLink>
          {canManageUsers(role) && (
            <NavLink to="/settings" className={linkClass}>Pengaturan</NavLink>
          )}
        </nav>
        <div className="user-menu">
          <span className="user-name">
            {profile?.full_name || profile?.email || 'Akun'}
          </span>
          <span className="role-badge">{role}</span>
          <button className="ghost-btn" onClick={handleLogout} aria-label="Keluar">
            <LogOut size={16} />
          </button>
        </div>
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-footer">
        <p>CBT Web Dashboard — Dashboard Guru</p>
      </footer>
    </div>
  );
}

function Stub() {
  return (
    <div>
      <h2>Berhasil masuk</h2>
      <p>Halaman ini akan dikembangkan selanjutnya.</p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/dashboard" element={<RequireAuth><ProtectedLayout><DashboardHome /></ProtectedLayout></RequireAuth>} />
        <Route path="/" element={<RequireAuth><ProtectedLayout><Navigate to="/dashboard" replace /></ProtectedLayout></RequireAuth>} />
        <Route path="/exams" element={<RequireAuth><ProtectedLayout><ExamsPage /></ProtectedLayout></RequireAuth>} />
        <Route path="/exams/new" element={<RequireAuth><ProtectedLayout><ExamForm /></ProtectedLayout></RequireAuth>} />
        <Route path="/exams/:id/edit" element={<RequireAuth><ProtectedLayout><ExamForm /></ProtectedLayout></RequireAuth>} />
        <Route path="/exams/:id/questions" element={<RequireAuth><ProtectedLayout><ExamQuestions /></ProtectedLayout></RequireAuth>} />
        <Route path="/exams/:id/results" element={<RequireAuth><ProtectedLayout><ExamResults /></ProtectedLayout></RequireAuth>} />
        <Route path="/questions" element={<RequireAuth><ProtectedLayout><QuestionsPage /></ProtectedLayout></RequireAuth>} />
        <Route path="/questions/new" element={<RequireAuth><ProtectedLayout><QuestionForm /></ProtectedLayout></RequireAuth>} />
        <Route path="/questions/:id/edit" element={<RequireAuth><ProtectedLayout><QuestionForm /></ProtectedLayout></RequireAuth>} />
        <Route path="/results" element={<RequireAuth><ProtectedLayout><ExamsPage /></ProtectedLayout></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><ProtectedLayout><Stub /></ProtectedLayout></RequireAuth>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
