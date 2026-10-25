/**
 * Daftar hasil siswa per ujian (guru). Read-only via supabase client;
 * RLS `teacher_results` (FOR ALL) membatasi ke ujian yang diajar guru.
 * Publish/unpublish hasil pakai RPC `fn_publish_results` (SECURITY DEFINER).
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import type { Exam, Result } from '../../../types/cbt';
import { ArrowLeft, Eye, EyeOff, RefreshCw } from 'lucide-react';

interface Row extends Result {
  student_name: string;
}

export default function ExamResults() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [examRes, resultsRes] = await Promise.all([
        supabase.from('exams').select('*').eq('id', id).single(),
        supabase
          .from('results')
          .select('*, profiles!inner(full_name)')
          .eq('exam_id', id)
          .order('graded_at', { ascending: false }),
      ]);
      if (examRes.error) throw new Error(examRes.error.message);
      if (resultsRes.error) throw new Error(resultsRes.error.message);

      setExam(examRes.data as Exam);
      setRows(
        (resultsRes.data ?? []).map((r: any) => ({
          ...(r as Result),
          student_name: r.profiles?.full_name ?? '—',
        }))
      );
    } catch (e: any) {
      setError(e?.message ?? 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const togglePublish = async (exam: Exam, next: boolean) => {
    if (!exam) return;
    const action = next ? 'memublikasikan' : 'membatalkan publikasi';
    if (!window.confirm(`Yakin ${action} hasil ujian "${exam.title}"?`)) return;
    setMutating(true);
    setError(null);
    const { error: err } = await supabase.rpc('fn_publish_results', {
      p_exam_id: exam.id,
      p_publish: next,
    });
    if (err) setError(err.message);
    else {
      setRows((prev) =>
        prev.map((r) => ({ ...r, is_published: next }))
      );
      await loadData();
    }
    setMutating(false);
  };

  if (loading) return <div className="loading">Memuat…</div>;

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <button
          onClick={() => navigate('/exams')}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} /> Kembali ke ujian
        </button>
      </header>

      {exam && (
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{exam.title}</h1>
          <span className="text-sm text-slate-500">
            {exam.status === 'published' ? 'Diterbitkan' : 'Draft'}
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        {exam && (
          <>
            {exam.status !== 'published' ? (
              <button
                onClick={() => togglePublish(exam, true)}
                disabled={mutating}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                <Eye size={16} /> Publikasikan Hasil
              </button>
            ) : (
              <button
                onClick={() => togglePublish(exam, false)}
                disabled={mutating}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <EyeOff size={16} /> Batalkan publikasi hasil
              </button>
            )}
            <button
              onClick={() => loadData()}
              disabled={mutating}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-slate-500">
          Belum ada hasil untuk ujian ini.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-medium text-slate-500">
              <tr>
                <th className="p-3">Peserta</th>
                <th className="p-3 text-right">Nilai</th>
                <th className="p-3 text-right">Max</th>
                <th className="p-3 text-right">Benar</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-center">Dipublikasi</th>
                <th className="p-3">Diveraksisi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="p-3">{r.student_name}</td>
                  <td className="p-3 text-right">{Number(r.score).toFixed(2)}</td>
                  <td className="p-3 text-right">{Number(r.max_score).toFixed(2)}</td>
                  <td className="p-3 text-right">{r.correct_answers}</td>
                  <td className="p-3 text-right">{r.total_questions}</td>
                  <td className="p-3 text-center">
                    {r.is_published ? 'Ya' : 'Tidak'}
                  </td>
                  <td className="p-3 text-slate-400">
                    {new Date(r.graded_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
