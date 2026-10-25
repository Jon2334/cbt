import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { BarChart3, BookOpen, GraduationCap, ClipboardList } from 'lucide-react';
import type { Result } from '../../types/cbt';

interface Counts {
  classes: number;
  students: number;
  exams: number;
  results: number;
}

export default function DashboardHome() {
  const { profile, role } = useAuth();
  const [counts, setCounts] = useState<Counts>({
    classes: 0,
    students: 0,
    exams: 0,
    results: 0,
  });
  const [recentResults, setRecentResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    async function load() {
      const [classesQ, studentsQ, examsQ, resultsQ, recentQ] =
        await Promise.all([
          supabase.from('classes').select('id', { count: 'exact', head: true }),
          supabase
            .from('class_members')
            .select('id', { count: 'exact', head: true }),
          supabase.from('exams').select('id', { count: 'exact', head: true }),
          supabase
            .from('results')
            .select('id', { count: 'exact', head: true })
            .in('status', ['graded', 'released']),
          supabase
            .from('results')
            .select('id,exam_id,student_id,score,status,is_released,graded_at,created_at')
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

      if (!active) return;

      const errs = [classesQ, studentsQ, examsQ, resultsQ].filter(
        (q) => q.error
      );
      if (errs.length) {
        setError(
          errs.map((e) => e.error?.message ?? String(e.error)).join('; ')
        );
      } else {
        setCounts({
          classes: classesQ.count ?? 0,
          students: studentsQ.count ?? 0,
          exams: examsQ.count ?? 0,
          results: resultsQ.count ?? 0,
        });
      }

      if (recentQ.error) {
        setError((p) =>
          p ? `${p}; ${recentQ.error.message}` : recentQ.error.message
        );
      } else {
        setRecentResults((recentQ.data ?? []) as Result[]);
      }
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const welcomeName =
    profile?.full_name?.trim() || profile?.email?.split('@')[0] || 'Guru';

  return (
    <div className="dashboard-home">
      <div className="dashboard-hero">
        <h1>Selamat datang, {welcomeName}</h1>
        <p className="role-badge">{role}</p>
      </div>

      {error && <div className="dashboard-error">{error}</div>}

      <div className="stats-grid">
        <StatCard
          icon={<BarChart3 size={20} />}
          label="Kelas Terdaftar"
          value={counts.classes}
        />
        <StatCard
          icon={<GraduationCap size={20} />}
          label="Siswa Aktif"
          value={counts.students}
        />
        <StatCard
          icon={<BookOpen size={20} />}
          label="Total Ujian"
          value={counts.exams}
        />
        <StatCard
          icon={<ClipboardList size={20} />}
          label="Hasil Dinilai"
          value={counts.results}
        />
      </div>

      <section className="recent-section">
        <h2>Aktivitas Terbaru</h2>
        {loading ? (
          <p className="muted">Memuat data…</p>
        ) : recentResults.length === 0 ? (
          <p className="muted">Belum ada hasil ujian.</p>
        ) : (
          <table className="results-table">
            <thead>
              <tr>
                <th>Ujian</th>
                <th>Siswa</th>
                <th>Nilai</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentResults.map((r) => (
                <tr key={r.id}>
                  <td>{r.exam_id?.slice(0, 8)}…</td>
                  <td>{r.student_id?.slice(0, 8)}…</td>
                  <td>{r.score ?? '—'}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-body">
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
      </div>
    </div>
  );
}
