/**
 * Bank soal: guru dapat melihat daftar soal (yang diajarkan) dan mengelola
 * soal pilihan ganda. Read via `questions` (join `subjects`) — RLS
 * `teacher_questions_owned_or_assigned` (FOR SELECT) memastikan guru hanya lihat
 * soal yg diajar/dibuat. Hapus via client — policy `FOR ALL` termasuk DELETE.
 *
 * KUNCI JAWABAN tidak pernah dibaca oleh komponen listhismpai — hanya disimpan
 * melalui `question_correct_answers` (hanya teacher/admin, lihat 002 lines 282
 * FOR ALL + 314-320 student denied).
 */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { canManageCurriculum } from '../../../lib/role';
import { Plus, Edit, Trash2, Search } from 'lucide-react';

interface SubjectOpt { id: string; name: string }
interface QRow {
  id: string;
  subject_id: string;
  topic: string | null;
  question_text: string;
  created_at: string;
  subjects: { name: string };
  question_options: { count: number }[];
}

export default function QuestionsPage() {
  const { role, loading: authLoading } = useAuth();
  const [questions, setQuestions] = useState<QRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectOpt[]>([]);
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchSubjects = useCallback(async () => {
    const { data } = await supabase.from('subjects').select('id,name').order('name');
    setSubjects(data ?? []);
  }, []);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    let q = supabase
      .from('questions')
      .select('*, subjects!inner(name), question_options(count)')
      .order('created_at', { ascending: false });
    if (subjectFilter !== 'all') q = q.eq('subject_id', subjectFilter);
    const { data, error: err } = await q;
    if (err) setError(err.message);
    else setQuestions((data ?? []) as QRow[]);
    setLoading(false);
  }, [subjectFilter]);

  useEffect(() => {
    fetchSubjects();
    fetchQuestions();
  }, [fetchSubjects, fetchQuestions]);

  const deleteQuestion = async (q: QRow) => {
    if (!window.confirm(`Hapus soal "${q.question_text.slice(0, 40)}..."?`)) return;
    setDeleting(q.id);
    // correct answer & options terhapus otomatis (CASCADE)
    const { error: err } = await supabase.from('questions').delete().eq('id', q.id);
    if (err) setError(err.message);
    else setQuestions((prev) => prev.filter((x) => x.id !== q.id));
    setDeleting(null);
  };

  if (authLoading) return <div className="loading">Memuat…</div>;
  if (!canManageCurriculum(role))
    return <div className="p-6"><h2 className="text-lg font-semibold">Akses ditolak</h2></div>;

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Bank Soal</h1>
          <p className="text-sm text-slate-500">Kelola soal pilihan ganda per mata pelajaran.</p>
        </div>
        <Link
          to="/questions/new"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
        >
          <Plus size={18} /> Soal Baru
        </Link>
      </header>

      <div className="flex items-center gap-3">
        <Search size={16} className="text-slate-400" />
        <select
          className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
        >
          <option value="all">Semua mata pelajaran</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      {loading ? <div className="loading">Memuat soal…</div> :
       questions.length === 0 ? (
         <div className="rounded border border-dashed border-slate-200 p-8 text-center text-slate-500">
           Belum ada soal. Klik "Soal Baru".
         </div>
       ) : (
         <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
           <table className="w-full text-left text-sm">
             <thead className="bg-slate-50 text-xs font-medium text-slate-500">
               <tr>
                 <th className="p-3">Soal</th>
                 <th className="p-3">Mapel</th>
                 <th className="p-3 text-center">Opsi</th>
                 <th className="p-3">#</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
               {questions.map((q) => (
                 <tr key={q.id}>
                   <td className="p-3">
                     <div className="font-medium text-slate-800">{q.question_text}</div>
                     {q.topic && <div className="text-slate-500">{q.topic}</div>}
                   </td>
                   <td className="p-3 text-slate-600">{q.subjects?.name}</td>
                   <td className="p-3 text-center">{q.question_options?.[0]?.count ?? 0}</td>
                   <td className="p-3">
                     <div className="flex justify-end gap-1">
                       <Link to={`/questions/${q.id}/edit`} className="rounded p-1 text-slate-600 hover:bg-slate-100" title="Edit"><Edit size={16} /></Link>
                       <button onClick={() => deleteQuestion(q)} disabled={deleting === q.id} className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-50" title="Hapus"><Trash2 size={16} /></button>
                     </div>
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
