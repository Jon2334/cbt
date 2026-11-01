/**
 * Kelola tautan soal ke sebuah ujian (tabel `exam_questions`).
 *
 * Keamanan (per 002 RLS):
 *  - Teacher: policy `teacher_exam_questions_assigned` (FOR ALL) → INSERT/UPDATE/DELETE
 *    hanya untuk ujian yang created_by guru atau assigned via class/subject. Tidak perlu RPC.
 *  - Student: policy `student_exam_questions_visible` hanya SELECT published exam_questions;
 *    kunci jawaban (`question_correct_answers`) TIDAK pernah di-fetch di sini.
 *  - UNIQUE(exam_id, question_id) pada skema mencegah duplikat; kami juga memastikan
 *    secara defensif sebelum INSERT.
 *  - `question_order` menjaga urutan soal; siswa melihat urutan ini lewat
 *    `fn_get_student_exam_questions(p_exam_id, p_student_id)` di 003.
 *
 * Perubahan UI/UX: status & jumlah soal ditampilkan sebagai lencana, urutan dapat
 * diatur dengan tombol berlabel, panel "tambah soal" berupa tabel dengan pemilihan
 * baris, dan keadaan kosong menjelaskan langkah berikutnya.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { canManageCurriculum } from '../../../lib/role';
import type { Exam, ExamQuestion } from '../../../types/cbt';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  CheckSquare,
  Info,
  List,
  Plus,
  RefreshCw,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  LoadingBlock,
  PageHeader,
  Select,
  TableWrap,
  Td,
  Th,
  type Tone,
} from '../../../components/ui';

interface SubjectOpt {
  id: string;
  name: string;
}

interface QuestionRow {
  id: string;
  subject_id: string;
  topic: string | null;
  question_text: string;
  weight: number;
  created_at: string;
  subjects: { name: string } | null;
  question_options: { count: number }[] | null;
}

interface LinkedRow extends ExamQuestion {
  questions: {
    id: string;
    question_text: string;
    topic: string | null;
    weight: number;
    subject_id: string;
    subjects: { name: string } | null;
    question_options: { count: number }[] | null;
  };
}

const STATUS_LABEL: Record<Exam['status'], string> = {
  draft: 'Draft',
  published: 'Diterbitkan',
  archived: 'Diarsipkan',
};

const STATUS_TONE: Record<Exam['status'], Tone> = {
  draft: 'amber',
  published: 'green',
  archived: 'slate',
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
  const [notice, setNotice] = useState<string | null>(null);
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
      const e = data as Exam;
      setExam(e);
      setSubjectFilter((s) => (s === 'all' ? (e.subject_id ?? 'all') : s));
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
    if (err) {
      setError(err.message);
      return;
    }
    // supabase dapat mengembalikan `questions` sebagai array walaupun relasinya
    // many-to-one; normalisasi ke object.
    const normalized = (data ?? []).map((r: unknown) => {
      const row = r as ExamQuestion & {
        questions?: LinkedRow['questions'] | LinkedRow['questions'][];
      };
      const q = Array.isArray(row.questions) ? row.questions[0] : row.questions;
      return {
        ...row,
        questions: q ?? {
          id: '',
          question_text: '',
          topic: null,
          weight: 0,
          subject_id: '',
          subjects: { name: '' },
          question_options: [],
        },
      };
    });
    setLinked(normalized as LinkedRow[]);
  }, [examId]);

  const fetchSubjects = useCallback(async () => {
    const { data } = await supabase
      .from('subjects')
      .select('id,name')
      .order('name');
    setSubjects((data ?? []) as SubjectOpt[]);
  }, []);

  // Semua soal yang dapat diajarkan guru (RLS teacher_questions_owned_or_assigned).
  const fetchAllQuestions = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('questions')
      .select('*, subjects!inner(name), question_options(count)')
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setAllQuestions((data ?? []) as unknown as QuestionRow[]);
  }, []);

  const loadAll = useCallback(async () => {
    let active = true;
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchExam(),
        fetchLinked(),
        fetchSubjects(),
        fetchAllQuestions(),
      ]);
    } finally {
      if (active) setLoading(false);
    }
    return () => {
      active = false;
    };
  }, [fetchExam, fetchLinked, fetchSubjects, fetchAllQuestions]);

  useEffect(() => {
    if (authLoading) return;
    if (!canManageCurriculum(role) || !examId) {
      navigate('/exams', { replace: true });
      return;
    }
    let cancelled = false;
    /* oxlint-disable react/set-state-in-effect */
    void loadAll().then((cleanup) => {
      // Bila komponen sudah dilepas sebelum fetch selesai, tandai aktif=false
      // supaya sisa setState dari closure diabaikan.
      if (cancelled) cleanup?.();
    });
    /* oxlint-enable react/set-state-in-effect */
    return () => {
      cancelled = true;
    };
  }, [authLoading, role, examId, loadAll, navigate]);

  // Soal yang belum terhubung & sesuai filter mapel.
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

  const totalWeight = useMemo(
    () =>
      linked.reduce(
        (sum, l) => sum + Number(l.weight_override ?? l.questions.weight ?? 0),
        0
      ),
    [linked]
  );

  const addSelected = async () => {
    if (!examId || selectedAdd.size === 0) return;
    setActionLoading('add');
    setError(null);
    try {
      const linkedIds = new Set(linked.map((l) => l.question_id));
      // Defensif: lewati yang sudah terhubung (mencegah pelanggaran UNIQUE).
      const toAdd = Array.from(selectedAdd).filter((qid) => !linkedIds.has(qid));
      if (toAdd.length === 0) {
        setNotice('Semua soal yang dipilih sudah terhubung ke ujian.');
        setActionLoading(null);
        return;
      }

      const payload: Partial<ExamQuestion>[] = toAdd.map((qid, i) => ({
        exam_id: examId,
        question_id: qid,
        question_order: maxOrder + i + 1,
      }));

      const { error: err } = await supabase.from('exam_questions').insert(payload);
      if (err) throw new Error(err.message);

      setSelectedAdd(new Set());
      setShowAdd(false);
      await fetchLinked();
      setNotice(`${toAdd.length} soal berhasil ditautkan ke ujian.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menautkan soal.');
    } finally {
      setActionLoading(null);
    }
  };

  const removeLinked = async (row: LinkedRow) => {
    const preview = row.questions.question_text.slice(0, 50);
    if (!window.confirm(`Hapus soal "${preview}" dari ujian ini?`)) return;
    setActionLoading(row.id);
    const { error: err } = await supabase
      .from('exam_questions')
      .delete()
      .eq('id', row.id);
    if (err) setError(err.message);
    else setLinked((prev) => prev.filter((l) => l.id !== row.id));
    setActionLoading(null);
  };

  const moveRow = async (row: LinkedRow, dir: 'up' | 'down') => {
    const idx = linked.findIndex((l) => l.id === row.id);
    const tgt = dir === 'up' ? idx - 1 : idx + 1;
    if (tgt < 0 || tgt >= linked.length) return;
    const other = linked[tgt];
    setActionLoading(row.id);
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

  if (authLoading || loading) {
    return (
      <Card>
        <LoadingBlock label="Memuat soal ujian…" />
      </Card>
    );
  }

  if (!canManageCurriculum(role)) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader
          icon={List}
          title="Soal Ujian"
          description="Halaman ini untuk guru dan administrator."
          tone="slate"
        />
        <Alert tone="amber" icon={AlertCircle} title="Akses ditolak">
          Hanya guru/admin yang dapat mengaitkan soal ke ujian.
        </Alert>
        <div className="mt-5">
          <LinkButton to="/exams" variant="secondary" icon={ArrowLeft}>
            Kembali ke daftar ujian
          </LinkButton>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader icon={List} title="Soal Ujian" tone="slate" />
        <Alert tone="red" icon={AlertCircle} title="Ujian tidak ditemukan">
          {error ?? 'Data ujian tidak dapat dimuat.'}
        </Alert>
        <div className="mt-5">
          <LinkButton to="/exams" variant="secondary" icon={ArrowLeft}>
            Kembali ke daftar ujian
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        icon={List}
        title={exam.title}
        description="Susun soal ujian dan atur urutannya. Siswa menerima soal pada urutan ini (kecuali opsi acak soal aktif)."
        breadcrumb={[
          { label: 'Beranda', to: '/dashboard' },
          { label: 'Ujian', to: '/exams' },
          { label: 'Soal' },
        ]}
        actions={
          <>
            <Badge tone={STATUS_TONE[exam.status]}>{STATUS_LABEL[exam.status]}</Badge>
            <Badge tone="brand" icon={List}>
              {linked.length} soal
            </Badge>
            <Badge tone="blue">Total bobot {totalWeight}</Badge>
            <LinkButton to={`/exams/${exam.id}/results`} variant="secondary" icon={BarChart3}>
              Hasil
            </LinkButton>
            <Button variant="secondary" icon={RefreshCw} onClick={() => void loadAll()}>
              Muat ulang
            </Button>
            <Button
              icon={showAdd ? X : Plus}
              onClick={() => setShowAdd((s) => !s)}
            >
              {showAdd ? 'Tutup panel' : 'Tambah Soal'}
            </Button>
          </>
        }
      />

      {error && (
        <Alert tone="red" icon={AlertCircle} title="Terjadi kesalahan" className="mb-4">
          {error}
        </Alert>
      )}
      {notice && (
        <Alert
          tone="green"
          icon={CheckCircle2}
          title="Berhasil"
          onDismiss={() => setNotice(null)}
          className="mb-4"
        >
          {notice}
        </Alert>
      )}

      {showAdd && (
        <Card className="mb-5">
          <CardHeader
            icon={Plus}
            title="Tambah soal dari bank soal"
            description="Hanya soal yang belum terhubung ke ujian ini yang ditampilkan."
            action={
              <div className="w-full sm:w-64">
                <label className="label sr-only" htmlFor="add-subject">
                  Filter mata pelajaran
                </label>
                <Select
                  id="add-subject"
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                >
                  <option value="all">Semua mata pelajaran</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            }
          />
          {available.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Info}
                title="Tidak ada soal yang bisa ditambahkan"
                description="Semua soal pada filter ini sudah terhubung, atau belum ada soal untuk mata pelajaran tersebut."
                actions={
                  <LinkButton to="/questions/new" icon={Plus}>
                    Tulis soal baru
                  </LinkButton>
                }
              />
            </div>
          ) : (
            <>
              <div className="p-3 sm:p-4">
                <TableWrap>
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead>
                      <tr>
                        <Th align="center" className="w-12">
                          Pilih
                        </Th>
                        <Th>Soal</Th>
                        <Th>Mapel</Th>
                        <Th align="center">Opsi</Th>
                        <Th align="center">Bobot</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {available.map((q) => {
                        const chosen = selectedAdd.has(q.id);
                        return (
                          <tr
                            key={q.id}
                            className={chosen ? 'bg-brand-50/60' : 'hover:bg-slate-50'}
                          >
                            <Td align="center">
                              <button
                                type="button"
                                onClick={() => toggleAdd(q.id)}
                                className="rounded p-1 text-brand-600 hover:bg-white"
                                aria-pressed={chosen}
                                aria-label={
                                  chosen
                                    ? 'Batalkan pemilihan soal'
                                    : 'Pilih soal untuk ditautkan'
                                }
                              >
                                {chosen ? <CheckSquare size={18} /> : <Square size={18} />}
                              </button>
                            </Td>
                            <Td className="max-w-xl">
                              <p className="font-medium text-slate-800">
                                {q.question_text}
                              </p>
                              {q.topic && (
                                <p className="mt-0.5 text-xs text-slate-500">
                                  Topik: {q.topic}
                                </p>
                              )}
                            </Td>
                            <Td>{q.subjects?.name ?? '—'}</Td>
                            <Td align="center">{q.question_options?.[0]?.count ?? 0}</Td>
                            <Td align="center">{q.weight}</Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableWrap>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-5 py-4">
                <span className="text-sm text-slate-500">
                  {selectedAdd.size} soal dipilih
                </span>
                <Button
                  icon={Plus}
                  loading={actionLoading === 'add'}
                  disabled={selectedAdd.size === 0}
                  onClick={addSelected}
                >
                  Tautkan ke ujian
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      <Card>
        <CardHeader
          icon={List}
          title={`Soal terhubung (${linked.length})`}
          description="Gunakan tombol naik/turun untuk mengubah urutan penyajian."
          action={
            linked.length > 0 ? (
              <LinkButton to={`/exams/${exam.id}/results`} variant="ghost" size="sm" icon={BarChart3}>
                Lihat hasil
              </LinkButton>
            ) : undefined
          }
        />
        {linked.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={List}
              title="Belum ada soal pada ujian ini"
              description="Ujian tanpa soal tidak dapat dikerjakan siswa."
              actions={
                <Button icon={Plus} onClick={() => setShowAdd(true)}>
                  Tambah soal sekarang
                </Button>
              }
              tips={
                <ol className="list-decimal space-y-1.5 pl-5">
                  <li>Klik <strong>Tambah Soal</strong> di kanan atas.</li>
                  <li>Pilih soal dari bank soal, lalu klik <strong>Tautkan</strong>.</li>
                  <li>Atur urutan, kemudian terbitkan ujian di halaman Ujian.</li>
                </ol>
              }
            />
          </div>
        ) : (
          <div className="p-3 sm:p-4">
            <TableWrap>
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr>
                    <Th align="center" className="w-16">
                      Urutan
                    </Th>
                    <Th>Soal</Th>
                    <Th>Mapel</Th>
                    <Th align="center">Opsi</Th>
                    <Th align="center">Bobot</Th>
                    <Th align="right">Aksi</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {linked.map((row, i) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <Td align="center">
                        <Badge tone="slate">{row.question_order}</Badge>
                      </Td>
                      <Td className="max-w-xl">
                        <p className="font-medium text-slate-800">
                          {row.questions.question_text}
                        </p>
                        {row.questions.topic && (
                          <p className="mt-0.5 text-xs text-slate-500">
                            Topik: {row.questions.topic}
                          </p>
                        )}
                      </Td>
                      <Td>{row.questions.subjects?.name ?? '—'}</Td>
                      <Td align="center">
                        {row.questions.question_options?.[0]?.count ?? 0}
                      </Td>
                      <Td align="center">
                        {row.weight_override ?? row.questions.weight}
                      </Td>
                      <Td align="right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                            disabled={actionLoading === row.id || i === 0}
                            onClick={() => moveRow(row, 'up')}
                            title="Naikkan urutan"
                            aria-label="Naikkan urutan soal"
                          >
                            <ArrowUp size={16} />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                            disabled={
                              actionLoading === row.id || i === linked.length - 1
                            }
                            onClick={() => moveRow(row, 'down')}
                            title="Turunkan urutan"
                            aria-label="Turunkan urutan soal"
                          >
                            <ArrowDown size={16} />
                          </button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Trash2}
                            className="text-red-600 hover:bg-red-50"
                            loading={actionLoading === row.id}
                            onClick={() => removeLinked(row)}
                          >
                            Hapus
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>
        )}
      </Card>

      <Alert tone="blue" icon={Info} title="Setelah soal tersusun" className="mt-5">
        Periksa kembali urutan dan bobot, lalu buka halaman{' '}
        <Link className="font-semibold underline" to="/exams">
          Ujian
        </Link>{' '}
        dan tekan <strong>Terbitkan</strong> agar siswa dapat mengerjakannya.
      </Alert>
    </div>
  );
}
