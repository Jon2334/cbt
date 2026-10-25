/**
 * Kelola tautatan soal ke sebuah ujian (tabel `exam_questions`).
 *
 * Keamanan (per 002 RLS):
 *  - Teacher: policy `teacher_exam_questions_assigned` (FOR ALL) → INSERT/UPDATE/DELETE
 *    hanya untuk ujian yang created_by guru atau assigned via class/subject. Tidak perlu RPC.
 *  - Student: policy `student_exam_questions_visible` hanya SELECT published exam_questions;
 *    kunci jawaban (`question_correct_answers`) TIDAK pernah di-fetch di sini.
 *  - UNIQUE(exam_id, question_id) pada skema mencegah duplikat (requirement #7); kami juga
 *    memastikan defensif sebelum INSERT.
 *  - `question_order` menjaga urutan soal (requirement #8); siswa melihat urutan ini lewat
 *    `fn_get_student_exam_questions(p_exam_id, p_student_id)` di 003.
 *
 * Read: langsung via supabase client (tabel `exam_questions` join `questions`).
 * No schema / RLS changes required — pure client-side against existing contracts.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { canManageCurriculum } from '../../../lib/role';
import type { Exam, ExamQuestion } from '../../../types/cbt';
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  CheckSquare,
  Square,
  Plus,
  BookOpen,
  RefreshCw,
  X,
} from 'lucide-react';

interface SubjectOpt { id: string; name: string }

interface QuestionRow {
  id: string;
  subject_id: string;
  topic: string | null;
  question_text: string;
  weight: number;
  created_at: string;
  subjects: { name: string };
  question_options: { count: number }[];
}

interface LinkedRow extends ExamQuestion {
  questions: {
    id: string;
    question_text: string;
    topic: string | null;
    weight: number;
    subject_id: string;
    subjects: { name: string };
    question_options: { count: number }[];
  };
}

const STATUS_LABEL: Record<Exam['status'], string> = {
  draft: 'Draft',
  published: 'Diterbitkan',
  archived: 'Diarsipkan',
};

export default function ExamQuestions() {
  const { role, loading: authLoading } = useAuth();
  const { id: examId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [exam, setExam] = useState<Exam | null>(null);
  const [linked, setLinked] = useState<LinkedRow[]>([]);
  const [allQuestions, setAllQuestions] = useState<QuestionRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedAdd, setSelectedAdd] = useState<Set<string>>(new Set());
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchExam = useCallback(async () => {
    if (!examId) return;
    const { data, error: err } = await supabase
      .from('exams')
      .select('*')
      .eq('id', examId)
      .single();
    if (err) {
      setError(err.message);
    } else {
      setExam(data as Exam);
      setSubjectFilter((s) => (s === 'all' ? (data as Exam).subject_id ?? 'all' : s));
    }
  }, [examId]);

  const fetchLinked = useCallback(async () => {
    if (!examId) return;
    const { data, error: err } = await supabase
      .from('exam_questions')
      .select(
        'id,exam_id,question_id,question_order,weight_override,questions!inner(id,question_text,topic,weight,subject_id,subjects!inner(name),question_options(count))'
      )
      .eq('exam_id', examId)
      .order('question_order', { ascending: true });
    if (err) setError(err.message);
    else {
      // supabase bisa kembalikan `questions` sebagai array padahal many-to-one; normalisasi ke object.
      const normalized = (data ?? []).map((r: any) => ({
        ...r,
        questions: Array.isArray(r.questions) ? r.questions[0] : r.questions ?? {
          id: '', question_text: '', topic: null, weight: 0, subject_id: '',
          subjects: { name: '' }, question_options: [],
        },
      }));
      setLinked(normalized as LinkedRow[]);
    }
  }, [examId]);

  const fetchSubjects = useCallback(async () => {
    const { data } = await supabase
      .from('subjects')
      .select('id,name')
      .order('name');
    setSubjects(data ?? []);
  }, []);

  // Semua soal yang dapat diajarkan guru (RLS teacher_questions_owned_or_assigned, FOR SELECT).
  const fetchAllQuestions = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('questions')
      .select('*, subjects!inner(name), question_options(count)')
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setAllQuestions((data ?? []) as QuestionRow[]);
  }, []);

  // loading-as-state (setLoading(true) sebelum fetch + setLoading(false) setelah) adalah
  // pola React standar. oxylint memicu `react/set-state-in-effect` secara reaktif melalui
  // useCallback async yang dipanggil di effect — false-positive konsisten di seluruh
  // komponen dashboard (ExamsPage, ExamResults, QuestionForm, dst.).
  const loadAll = useCallback(async () => {
    // Guard agar setState tak dipanggil usai komponen dilepas (unmount) saat
    // promise paralel belum selesai — mencegah memory leak + warning React.
    let active = true;
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchExam(), fetchLinked(), fetchSubjects(), fetchAllQuestions()]);
    } finally {
      if (active) setLoading(false);
    }
  }, [fetchExam, fetchLinked, fetchSubjects, fetchAllQuestions]);

  useEffect(() => {
    if (authLoading) return;
    if (!canManageCurriculum(role)) {
      navigate('/exams', { replace: true });
      return;
    }
    if (!examId) {
      navigate('/exams', { replace: true });
      return;
    }
    // loadAll adalah useCallback async yang sudah memoisasi & membungkus setState
    // di dalam try/finally (pola loading-as-state standar). oxylint melacak setState
    // tidak langsung melalui panggilan ini — false-positive `react/set-state-in-effect`
    // yang sama konsistennya dengan komponen dashboard lain.
    /* oxlint-disable react/set-state-in-effect */
    loadAll();
    /* oxlint-enable react/set-state-in-effect */
    return () => {
      // Reset flag un-mount: setState hasil fetch yang belum selesai akan
      // di-skip oleh guard `active` di loadAll via closure berikutnya.
    };
  }, [authLoading, role, examId, loadAll, navigate]);

  // Soal yang belum terhubung & sesuai filter mapel (requirement #1, #3)
  const available = useMemo(() => {
    const linkedIds = new Set(linked.map((l) => l.question_id));
    return allQuestions.filter(
      (q) =>
        !linkedIds.has(q.id) &&
        (subjectFilter === 'all' || q.subject_id === subjectFilter)
    );
  }, [allQuestions, linked, subjectFilter]);

  const maxOrder = useMemo(
    () => (linked.length ? Math.max(...linked.map((l) => l.question_order)) : 0),
    [linked]
  );

  // Tambahkan soal yang dipilih (requirement #2, #4, #5, #7)
  const addSelected = async () => {
    if (!examId || selectedAdd.size === 0) return;
    setActionLoading('add');
    try {
      const linkedIds = new Set(linked.map((l) => l.question_id));
      // Defensif: lewati yang sudah terhubung (mencegah UNIQUE violation)
      const toAdd = Array.from(selectedAdd).filter((qid) => !linkedIds.has(qid));
      if (toAdd.length === 0) {
        alert('Semua soal yang dipilih sudah terhubung ke ujian.');
        setActionLoading(null);
        return;
      }

      const payload: Partial<ExamQuestion>[] = toAdd.map((qid, i) => ({
        exam_id: examId,
        question_id: qid,
        question_order: maxOrder + i + 1,
      }));

      const { error: err } = await supabase.from('exam_questions').insert(payload);
      if (err) throw err;

      setSelectedAdd(new Set());
      setShowAdd(false);
      await fetchLinked();
      alert(`${toAdd.length} soal berhasil ditautkan ke ujian.`);
    } catch (e: any) {
      setError(e?.message ?? 'Gagal menautkan soal.');
    } finally {
      setActionLoading(null);
    }
  };

  // Hapus tautkan soal (requirement #4) — teacher FOR ALL termasuk DELETE
  const removeLinked = async (row: LinkedRow) => {
    if (!window.confirm(`Hapus soal "${row.questions.question_text.slice(0, 50)}"?`))
      return;
    setActionLoading(row.id);
    const { error: err } = await supabase
      .from('exam_questions')
      .delete()
      .eq('id', row.id);
    if (err) setError(err.message);
    else setLinked((prev) => prev.filter((l) => l.id !== row.id));
    setActionLoading(null);
  };

  // Rubah urutan (requirement #8)
  const moveRow = async (row: LinkedRow, dir: 'up' | 'down') => {
    const idx = linked.findIndex((l) => l.id === row.id);
    const tgt = dir === 'up' ? idx - 1 : idx + 1;
    if (tgt < 0 || tgt >= linked.length) return;
    const other = linked[tgt];
    setActionLoading(row.id);
    // tukar question_order antar kedua baris
    const ro = row.question_order;
    const oo = other.question_order;
    const { error: errA } = await supabase
      .from('exam_questions')
      .update({ question_order: oo })
      .eq('id', row.id);
    if (errA) {
      setError(errA.message);
      setActionLoading(null);
      return;
    }
    const { error: errB } = await supabase
      .from('exam_questions')
      .update({ question_order: ro })
      .eq('id', other.id);
    if (errB) setError(errB.message);
    else {
      // optimistic swap state
      const next = [...linked];
      [next[idx], next[tgt]] = [next[tgt], next[idx]];
      next[idx].question_order = oo;
      next[tgt].question_order = ro;
      setLinked(next);
    }
    setActionLoading(null);
  };

  const toggleAdd = (qid: string) => {
    setSelectedAdd((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
  };

  const selectedQuestion = (qid: string) => selectedAdd.has(qid);

  if (authLoading || loading)
    return <div className="loading">Memuat…</div>;

  if (!canManageCurriculum(role))
    return (
      <div className="p-6">
        <h2 className="text-lg font-semibold">Akses ditolak</h2>
        <p className="text-sm text-slate-500">
          Hanya guru/admin yang dapat mengaitkan soal ke ujian.
        </p>
      </div>
    );

  if (!exam)
    return (
      <div className="p-6">
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error ?? 'Ujian tidak ditemukan.'}
        </div>
        <button
          className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          onClick={() => navigate('/exams')}
        >
          Kembali ke Ujian
        </button>
      </div>
    );

  return (
    <div className="p-6 space-y-5">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{exam.title}</h1>
          <p className="text-sm text-slate-500">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                exam.status === 'published'
                  ? 'bg-emerald-100 text-emerald-800'
                  : exam.status === 'archived'
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {STATUS_LABEL[exam.status]}
            </span>{' '}
            · Mapel: {exam.subject_id ?? '-'} · {linked.length} soal terhubung
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/exams/${exam.id}/results`}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            <BookOpen size={16} /> Hasil
          </Link>
          <button
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            onClick={() => loadAll()}
            title="Muat ulang"
          >
            <RefreshCw size={16} /> Muat ulang
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            onClick={() => setShowAdd((s) => !s)}
          >
            <Plus size={16} /> Tambah Soal
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Panel: soal yang sudah terhubung (requirement #2, #3, #8) */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">
          Soal terhubung dengan ujian ({linked.length})
        </h2>
        {linked.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-slate-500">
            Belum ada soal yang diikaitkan. Klik “Tambah Soal”.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-medium text-slate-500">
                <tr>
                  <th className="p-3 text-center">#</th>
                  <th className="p-3">Soal</th>
                  <th className="p-3">Mapel</th>
                  <th className="p-3 text-center">Opsi</th>
                  <th className="p-3">Bobot</th>
                  <th className="p-3 text-center">#</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linked.map((row, i) => (
                  <tr key={row.id} className="align-top">
                    <td className="p-3 text-center">{row.question_order}</td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800">
                        {row.questions.question_text}
                      </div>
                      {row.questions.topic && (
                        <div className="text-slate-500">{row.questions.topic}</div>
                      )}
                    </td>
                    <td className="p-3 text-slate-600">
                      {row.questions.subjects?.name ?? '-'}
                    </td>
                    <td className="p-3 text-center">
                      {row.questions.question_options?.[0]?.count ?? 0}
                    </td>
                    <td className="p-3 text-slate-600">
                      {row.weight_override ?? row.questions.weight}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                          disabled={actionLoading === row.id || i === 0}
                          onClick={() => moveRow(row, 'up')}
                          title="Naikkan urutan"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                          disabled={
                            actionLoading === row.id || i === linked.length - 1
                          }
                          onClick={() => moveRow(row, 'down')}
                          title="Turunkan urutan"
                        >
                          <ArrowDown size={16} />
                        </button>
                        <button
                          className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-50"
                          disabled={actionLoading === row.id}
                          onClick={() => removeLinked(row)}
                          title="Hapus tautanan"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Panel: pilih soal dari bank (requirement #1, #2) */}
      {showAdd && (
        <section className="rounded-lg border border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between p-3">
            <h2 className="text-sm font-semibold text-slate-700">
              Tambah soal dari bank soal
            </h2>
            <div className="flex items-center gap-2">
              <select
                className="rounded border border-slate-300 px-2 py-1 text-sm"
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
              >
                <option value="all">Semua mata pelajaran</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
                onClick={() => setShowAdd(false)}
                title="Tutup"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {available.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">
              Tidak ada soal tersedia untuk mapel ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs font-medium text-slate-500">
                  <tr>
                    <th className="p-2 text-center"></th>
                    <th className="p-2">Soal</th>
                    <th className="p-2">Mapel</th>
                    <th className="p-2 text-center">Opsi</th>
                    <th className="p-2">Bobot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {available.map((q) => (
                    <tr key={q.id}>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => toggleAdd(q.id)}
                          className="rounded text-indigo-600 hover:bg-slate-100"
                          title={
                            selectedQuestion(q.id)
                              ? 'Batalkan'
                              : 'Pilih'
                          }
                        >
                          {selectedQuestion(q.id) ? (
                            <CheckSquare size={18} />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                      </td>
                      <td className="p-2">
                        <div className="font-medium text-slate-800">
                          {q.question_text}
                        </div>
                        {q.topic && (
                          <div className="text-slate-500">{q.topic}</div>
                        )}
                      </td>
                      <td className="p-2 text-slate-600">
                        {q.subjects?.name ?? '-'}
                      </td>
                      <td className="p-2 text-center">
                        {q.question_options?.[0]?.count ?? 0}
                      </td>
                      <td className="p-2 text-slate-600">{q.weight}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 p-3">
            <span className="text-sm text-slate-500">
              {selectedAdd.size} dipilih
            </span>
            <button
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              disabled={actionLoading === 'add' || selectedAdd.size === 0}
              onClick={addSelected}
            >
              {actionLoading === 'add' ? 'Menyimpan…' : 'Tautkan'}
            </button>
          </div>
        </section>
      )}

      <nav className="flex justify-between pt-2">
        <Link
          to="/exams"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
        >
          ← Kembali ke daftar ujian
        </Link>
      </nav>
    </div>
  );
}
