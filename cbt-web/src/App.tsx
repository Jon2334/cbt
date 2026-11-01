/**
 * Kerangka aplikasi dashboard CBT (guru & admin).
 *
 * - `PublicRoute` : halaman login (dialihkan ke dashboard bila sudah masuk).
 * - `RequireAuth` : penjaga rute. Role SELALU dibaca dari tabel `profiles`
 *                   (lib/auth), bukan dari token/klien.
 * - `AppShell`    : sidebar + topbar yang menyesuaikan role (Guru/Administrator).
 *
 * Perubahan UI/UX: navigasi pindah ke sidebar berkelompok dengan keterangan
 * singkat per menu, topbar menampilkan halaman aktif, dan layar pemulihan
 * (profil/role gagal dimuat) diberi gaya agar tidak tampak seperti error mentah.
 */
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import {
  BarChart3,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  School,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from './lib/auth';
import { canManageUsers, hasRole, type UserRole } from './lib/role';
import { cn, Badge, type IconType } from './components/ui';
import LoginPage from './features/auth/LoginPage';
import DashboardHome from './features/dashboard/DashboardHome';
import ExamsPage from './features/dashboard/exams/ExamsPage';
import ExamForm from './features/dashboard/exams/ExamForm';
import ExamQuestions from './features/dashboard/exams/ExamQuestions';
import ExamResults from './features/dashboard/exams/ExamResults';
import QuestionsPage from './features/dashboard/questions/QuestionsPage';
import QuestionForm from './features/dashboard/questions/QuestionForm';
import SettingsPage from './features/dashboard/settings/SettingsPage';
import ClassesPage from './features/dashboard/classes/ClassesPage';

/** Label role yang mudah dibaca manusia. */
const ROLE_LABEL: Record<NonNullable<UserRole>, string> = {
  admin: 'Administrator',
  teacher: 'Guru',
  student: 'Siswa',
};

interface NavItem {
  to: string;
  label: string;
  description: string;
  icon: IconType;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Menu per role. Guru tidak melihat menu Administrasi; menyembunyikan menu
 * hanya demi kejelasan — penolakan sebenarnya tetap dilakukan RLS di server.
 */
function navSections(role: UserRole): NavSection[] {
  const sections: NavSection[] = [
    {
      title: 'Menu Utama',
      items: [
        {
          to: '/dashboard',
          label: 'Beranda',
          description: 'Ringkasan & langkah berikutnya',
          icon: LayoutDashboard,
        },
        {
          to: '/exams',
          label: 'Ujian',
          description: 'Buat, atur jadwal, terbitkan',
          icon: ClipboardList,
        },
        {
          to: '/questions',
          label: 'Bank Soal',
          description: 'Kumpulan soal & pilihan jawaban',
          icon: FileText,
        },
        {
          to: '/results',
          label: 'Hasil',
          description: 'Nilai peserta & publikasi',
          icon: BarChart3,
        },
      ],
    },
  ];

  if (canManageUsers(role)) {
    sections.push({
      title: 'Administrasi',
      items: [
        {
          to: '/classes',
          label: 'Kelas & Pengguna',
          description: 'Kelas, mapel, guru, anggota',
          icon: School,
        },
        {
          to: '/settings',
          label: 'Pengaturan & Peran',
          description: 'Hak akses & panduan admin',
          icon: Settings,
        },
      ],
    });
  }

  return sections;
}

/* -------------------------------------------------------------------------- */
/* Penjaga rute                                                               */
/* -------------------------------------------------------------------------- */

function FullScreenLoading({ label = 'Memeriksa sesi…' }: { label?: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-slate-100 text-slate-500">
      <span className="spinner size-6 text-brand-600" aria-hidden="true" />
      <p className="text-sm" role="status" aria-live="polite">
        {label}
      </p>
    </div>
  );
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoading label="Memuat halaman masuk…" />;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, role, loading, authError, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  if (loading) return <FullScreenLoading />;
  if (!user)
    return <Navigate to="/login" replace state={{ from: '/dashboard' }} />;

  // Sudah terautentikasi tetapi profil (sumber role) gagal dimuat. Jangan
  // dialihkan ke /login — PublicRoute akan memantulkannya kembali ke sini
  // (loop tak berujung). Tampilkan layar pemulihan yang bisa dipakai pengguna.
  if (!role) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-slate-100 px-4">
        <div className="card card-pad w-full max-w-md text-center">
          <span
            className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-100"
            aria-hidden="true"
          >
            <ShieldCheck size={24} />
          </span>
          <h1 className="text-lg font-bold">Profil tidak dapat dimuat</h1>
          <p className="mt-1 text-sm text-slate-500">
            {authError ??
              'Peran pengguna Anda tidak dapat dibaca dari server. Silakan masuk kembali.'}
          </p>
          <button
            type="button"
            className="btn btn-primary mt-5 w-full"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              try {
                await signOut();
              } finally {
                setSigningOut(false);
              }
            }}
          >
            {signingOut ? (
              <span className="spinner" aria-hidden="true" />
            ) : (
              <RefreshCw size={16} />
            )}
            Masuk kembali
          </button>
        </div>
      </div>
    );
  }

  if (!hasRole(role, 'teacher'))
    return <Navigate to="/login" replace state={{ from: '/dashboard' }} />;

  return <>{children}</>;
}

/* -------------------------------------------------------------------------- */
/* Kerangka aplikasi                                                          */
/* -------------------------------------------------------------------------- */

function SidebarContent({
  role,
  name,
  email,
  onNavigate,
  onLogout,
}: {
  role: UserRole;
  name: string;
  email: string;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  const sections = navSections(role);
  const initial = (name.trim()[0] ?? 'U').toUpperCase();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm"
          aria-hidden="true"
        >
          <GraduationCap size={22} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">CBT Sekolah</p>
          <p className="truncate text-xs text-slate-500">Panel Guru &amp; Admin</p>
        </div>
      </div>

      <nav
        aria-label="Menu utama"
        className="flex-1 space-y-5 overflow-y-auto px-3 py-4"
      >
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              {section.title}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150',
                        isActive
                          ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-100'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon
                          size={18}
                          className={cn(
                            'mt-0.5 shrink-0',
                            isActive ? 'text-brand-600' : 'text-slate-400'
                          )}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">
                            {item.label}
                          </span>
                          <span className="block text-[11px] leading-snug text-slate-400">
                            {item.description}
                          </span>
                        </span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white"
            aria-hidden="true"
          >
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{name}</p>
            <p className="truncate text-xs text-slate-500">{email}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white hover:text-red-600"
            title="Keluar"
            aria-label="Keluar dari akun"
          >
            <LogOut size={16} />
          </button>
        </div>
        <p className="mt-2 flex items-center gap-2 px-1 text-[11px] text-slate-400">
          Masuk sebagai
          <Badge tone={role === 'admin' ? 'purple' : 'brand'}>
            {ROLE_LABEL[role ?? 'teacher']}
          </Badge>
        </p>
      </div>
    </div>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Tutup drawer setiap kali pindah halaman.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Kunci scroll body ketika drawer terbuka (mobile).
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  const displayName =
    profile?.full_name?.trim() || profile?.email?.split('@')[0] || 'Pengguna';
  const displayEmail = profile?.email ?? '—';

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  // Judul topbar = menu aktif (cocokkan prefix terpanjang).
  const items = navSections(role).flatMap((s) => s.items);
  const activeItem = items
    .filter((i) => location.pathname.startsWith(i.to))
    .sort((a, b) => b.to.length - a.to.length)[0];

  return (
    <div className="min-h-svh bg-slate-100 lg:pl-72">
      {/* Overlay drawer (mobile) */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0',
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex justify-end p-2 lg:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            onClick={() => setDrawerOpen(false)}
            aria-label="Tutup menu"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <SidebarContent
            role={role}
            name={displayName}
            email={displayEmail}
            onNavigate={() => setDrawerOpen(false)}
            onLogout={handleLogout}
          />
        </div>
      </aside>

      {/* Topbar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Buka menu"
            aria-expanded={drawerOpen}
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">
              {activeItem?.label ?? 'Dashboard'}
            </p>
            <p className="hidden truncate text-xs text-slate-500 sm:block">
              {activeItem?.description ?? 'Panel guru & administrator'}
            </p>
          </div>
          <Badge tone={role === 'admin' ? 'purple' : 'brand'}>
            {role === 'admin' ? 'Admin' : 'Guru'}
          </Badge>
          <button
            type="button"
            onClick={handleLogout}
            className="hidden items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 sm:inline-flex"
          >
            <LogOut size={15} /> Keluar
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs text-slate-400 sm:px-6 lg:px-8">
        CBT Sekolah — panel {ROLE_LABEL[role ?? 'teacher']}. Peran pengguna
        diverifikasi di server (RLS + get_current_profile).
      </footer>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppShell>
                <Navigate to="/dashboard" replace />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <AppShell>
                <DashboardHome />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/exams"
          element={
            <RequireAuth>
              <AppShell>
                <ExamsPage />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/exams/new"
          element={
            <RequireAuth>
              <AppShell>
                <ExamForm />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/exams/:id/edit"
          element={
            <RequireAuth>
              <AppShell>
                <ExamForm />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/exams/:id/questions"
          element={
            <RequireAuth>
              <AppShell>
                <ExamQuestions />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/exams/:id/results"
          element={
            <RequireAuth>
              <AppShell>
                <ExamResults />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/questions"
          element={
            <RequireAuth>
              <AppShell>
                <QuestionsPage />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/questions/new"
          element={
            <RequireAuth>
              <AppShell>
                <QuestionForm />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/questions/:id/edit"
          element={
            <RequireAuth>
              <AppShell>
                <QuestionForm />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/results"
          element={
            <RequireAuth>
              <AppShell>
                <ExamsPage />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/classes"
          element={
            <RequireAuth>
              <AppShell>
                <ClassesPage />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <AppShell>
                <SettingsPage />
              </AppShell>
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
