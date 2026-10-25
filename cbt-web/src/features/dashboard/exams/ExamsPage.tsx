/**
 * Halaman mana guru dapat melihat, membuat, mengedit, mempublikasikan, dan
 * melihat hasil ujian yang diajar/dibuatnya.
 *
 * Data diambil langsung via `supabase` client; RLS policy `teacher_exams_owned_or_assigned`
 * (FOR ALL) dan `teacher_results` (FOR ALL) menjamin guru hanya berinteraksi
 * dengan ujian & hasil yang berhak. Publish hasil pakai RPC `fn_publish_results`
 * (SECURITY DEFINER) — tidak ada write langsung ke `results`.
 */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { canManageCurriculum } from '../../../lib/role';
import type { Exam, ExamStatus } from '../../../types/cbt';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  FileText,
  List,
} from 'lucide-react';

interface ExamRow extends Exam {
  attempt_count: number;
}

const STATUS_LABEL: Record<ExamStatus, string> = {
  draft: 'Draft',
  published: 'Diterbitkan',
  archived: 'Diarsipkan',
};

const STATUS_COLOR: Record<ExamStatus, string> = {
  draft: 'bg-amber-100 text-amber-800',
  published: 'bg-emerald-100 text-emerald-800',
  archived: 'bg-slate-100 text-slate-600',
};

export default function ExamsPage() {
  const { role, profile, loading: authLoading } = useAuth();
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('exams')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) throw err;

      const rows: ExamRow[] = [];
      for (const exam of (data ?? []) as Exam[]) {
        const { count } = await supabase
          .from('exam_attempts')
          .select('id', { count: 'exact', head: true })
          .eq('exam_id', exam.id);
        rows.push({ ...exam, attempt_count: count ?? 0 });
      }
      setExams(rows);
    } catch (e: any) {
      setError(e?.message ?? 'Gagal memuat daftar ujian.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  if (authLoading) return <div className="loading">Memuat…</div>;
  if (!canManageCurriculum(role))
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold">Akses ditolak</h2>
        <p className="text-sm text-slate-500">
          Hanya guru/admin yang dapat mengelola ujian.
        </p>
      </div>
    );

  const publishExam = async (exam: Exam, next: 'published' | 'draft') => {
    setProcessing(`${exam.id}:${next}`);
    const { error: err } = await supabase
      .from('exams')
      .update({ status: next })
      .eq('id', exam.id);
    if (err) {
      setError(err.message);
    } else {
      setExams((prev) =>
        prev.map((e) =>
          e.id === exam.id ? { ...e, status: next as ExamStatus } : e
        )
      );
    }
    setProcessing(null);
  };

  const publishResults = async (exam: Exam) => {
    const confirmed = window.confirm(
      `Publikasi hasil ujian "${exam.title}"? Peserta akan dapat melihat nilainya.`
    );
    if (!confirmed) return;
    setProcessing(`${exam.id}:publish-results`);
    const { error: err } = await supabase.rpc('fn_publish_results', {
      p_exam_id: exam.id,
      p_publish: true,
    });
    if (err) setError(err.message);
    else alert('Hasil ujian telah dipublikasikan.');
    setProcessing(null);
  };

  const archiveExam = async (exam: Exam) => {
    const confirmed = window.confirm(
      `Arsipkan ujian "${exam.title}"? Ujian tidak akan ditampilkan ke peserta lagi.`
    );
    if (!confirmed) return;
    setProcessing(`${exam.id}:archive`);
    const { error: err } = await supabase
      .from('exams')
      .update({ status: 'archived' })
      .eq('id', exam.id);
    if (err) setError(err.message);
    else
      setExams((prev) =>
        prev.map((e) => (e.id === exam.id ? { ...e, status: 'archived' } : e))
      );
    setProcessing(null);
  };

  const canBePublished = (exam: Exam) =>
    exam.status === 'draft' && exam.open_at && exam.close_at;

  return (
    <div className="p-6 space-y-4">
      {profile?.role === 'admin' && null}
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Kelola Ujian</h1>
          <p className="text-sm text-slate-500">
            Buat, ubah, publikasikan, dan pantau hasil ujian Anda.
          </p>
        </div>
        <Link
          to="/exams/new"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={18} /> Buat Ujian
        </Link>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading">Memuat ujian…</div>
      ) : exams.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
          <FileText className="mx-auto mb-2 text-slate-400" size={32} />
          <p className="text-slate-600">Belum ada ujian.</p>
          <p className="text-sm text-slate-400">
            Klik "Buat Ujian" untuk memulai.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-medium text-slate-500">
              <tr>
                <th className="p-3">Ujian</th>
                <th className="p-3">Status</th>
                <th className="p-3">Jadwal</th>
                <th className="p-3 text-center">Peserta</th>
                <th className="p-3 text-center">#</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {exams.map((e) => {
                const busy = processing === `${e.id}:${e.status === 'draft' ? 'published' : 'draft'}`;
                return (
                  <tr key={e.id} className="align-top">
                    <td className="p-3 align-top">
                      <div className="font-medium text-slate-800">
                        {e.title}
                      </div>
                      {e.description && (
                        <p className="max-w-xs text-wrap text-slate-500">
                          {e.description}
                        </p>
                      )}
                    </td>
                    <td className="p-3 align-top">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLOR[e.status]}`}
                      >
                        {STATUS_LABEL[e.status]}
                      </span>
                    </td>
                    <td className="p-3 align-top text-slate-600">
                      <div>
                        <Clock size={12} className="inline mr-1" />
                        Mulai:{' '}
                        {new Date(e.open_at).toLocaleString()}
                      </div>
                      <div>
                        Tutup:{' '}
                        {new Date(e.close_at).toLocaleString()}
                      </div>
                      <div className="text-slate-400">
                        Durasi: {e.duration_minutes} menit
                      </div>
                    </td>
                    <td className="p-3 align-top text-center">
                      {e.attempt_count}
                    </td>
                    <td className="p-3 align-top">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to={`/exams/${e.id}/edit`}
                          className="rounded p-1 text-slate-600 hover:bg-slate-100"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </Link>
                        <Link
                          to={`/exams/${e.id}/questions`}
                          className="rounded p-1 text-slate-600 hover:bg-slate-100"
                          title="Kelola Soal"
                        >
                          <List size={16} />
                        </Link>
                        <Link
                          to={`/exams/${e.id}/results`}
                          className="rounded p-1 text-slate-600 hover:bg-slate-100"
                          title="Hasil"
                        >
                          <Eye size={16} />
                        </Link>
                        {e.status === 'published' && (
                          <button
                            onClick={() => publishResults(e)}
                            disabled={processing === `${e.id}:publish-results`}
                            className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                            title="Publikasi Hasil"
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}
                        {canBePublished(e) && e.status === 'draft' && (
                          <button
                            onClick={() =>
                              publishExam(e, 'published')
                            }
                            disabled={busy}
                            className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                            title="Terbitkan"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        {e.status !== 'archived' && (
                          <button
                            onClick={() => archiveExam(e)}
                            disabled={processing === `${e.id}:archive`}
                            className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-50"
                            title="Arsipkan"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        {e.status === 'published' && (
                          <button
                            onClick={() => publishExam(e, 'draft')}
                            disabled={busy}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                            title="Batalkan publikasi"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
