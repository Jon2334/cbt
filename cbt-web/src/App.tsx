import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import './App.css';

// --- Pages ---
function DashboardHome() {
  return (
    <div className="dashboard-home">
      <div className="stat-card">
        <h3>Total Ujian</h3>
        <p className="stat-value">0</p>
      </div>
      <div className="stat-card">
        <h3>Siswa Aktif</h3>
        <p className="stat-value">0</p>
      </div>
      <div className="stat-card">
        <h3>Kelas Terdaftar</h3>
        <p className="stat-value">0</p>
      </div>
    </div>
  );
}

function ExamsPage() {
  return (
    <div>
      <h2>Kelola Ujian</h2>
      <p>Buat, edit, dan jadwalkan ujian CBT.</p>
      <button className="primary-btn">Buat Ujian Baru</button>
    </div>
  );
}

function QuestionsPage() {
  return (
    <div>
      <h2>Bank Soal</h2>
      <p>Kelola pertanyaan dan jawaban untuk setiap mata pelajaran.</p>
    </div>
  );
}

function ResultsPage() {
  return (
    <div>
      <h2>Hasil Ujian</h2>
      <p>Lihat rekap nilai dan statistik peserta ujian.</p>
    </div>
  );
}

function SettingsPage() {
  return (
    <div>
      <h2>Pengaturan</h2>
      <p>Kelola data sekolah, guru, dan konfigurasi sistem.</p>
    </div>
  );
}

// --- Layout ---
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="logo">CBT Dashboard</div>
        <nav>
          <NavLink to="/" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>Beranda</NavLink>
          <NavLink to="/exams" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>Ujian</NavLink>
          <NavLink to="/questions" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>Bank Soal</NavLink>
          <NavLink to="/results" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>Hasil</NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>Pengaturan</NavLink>
        </nav>
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-footer">
        <p>CBT Web Dashboard v1.0.0 — Fondasi Proyek</p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardHome />} />
          <Route path="/exams" element={<ExamsPage />} />
          <Route path="/questions" element={<QuestionsPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;