/**
 * Bank Soal (guru & admin).
 *
 * Perubahan UI/UX: pencarian soal, filter mapel bergaya seragam, jumlah opsi
 * ditampilkan sebagai lencana, dan aksi tiap baris diberi label.
 *
 * KUNCI JAWABAN tidak pernah dibaca di halaman ini — hanya disimpan melalui
 * tabel `question_correct_answers` (hanya teacher/admin) di form soal.
 * RLS `teacher_questions_owned_or_assigned` (FOR ALL) membatasi data per guru.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Edit,
  FileText,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { canManageCurriculum } from '../../../lib/role';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  LinkButton,
  LoadingBlock,
  PageHeader,
  Select,
  TableWrap,
  Td,
  TextInput,
  Th,
} from '../../../components/ui';

interface SubjectOpt {
  id: string;
  name: string;
}

interface QRow {
  id: string;
  subject_id: string;
  topic: string | null;
  question_text: string;
  weight: number;
  created_at: string;
  subjects: { name: string } | null;
  question_options: { count: number }[] | null;
}

export default function QuestionsPage() {
  const { role, loading: authLoading } = useAuth();
  const [questions, setQuestions] = useState<QRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectOpt[]>([]);
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchSubjects = useCallback(async () => {
    const { data } = await supabase.from('subjects').select('id,name').order('name');
    setSubjects((data ?? []) as SubjectOpt[]);
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
    else setQuestions((data ?? []) as unknown as QRow[]);
    setLoading(false);
  }, [subjectFilter]);

  useEffect(() => {
    void fetchSubjects();
  }, [fetchSubjects]);

  useEffect(() => {
    void fetchQuestions();
  }, [fetchQuestions]);

  const deleteQuestion = async (q: QRow) => {
    const preview =
      q.question_text.length > 60
        ? `${q.question_text.slice(0, 60)}…`
        : q.question_text;
    if (!window.confirm(`Hapus soal "${preview}"?\n\nPilihan jawaban dan kunci jawabannya ikut terhapus.`))
      return;

    setDeleting(q.id);
    setError(null);
    // Opsi & kunci jawaban terhapus otomatis (ON DELETE CASCADE).
    const { error: err } = await supabase.from('questions').delete().eq('id', q.id);
    if (err) setError(err.message);
    else {
      setQuestions((prev) => prev.filter((x) => x.id !== q.id));
      setNotice('Soal berhasil dihapus.');
    }
    setDeleting(null);
  };

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return questions;
    return questions.filter(
      (q) =>
        q.question_text.toLowerCase().includes(needle) ||
        (q.topic ?? '').toLowerCase().includes(needle)
    );
  }, [questions, search]);

  if (authLoading) return <LoadingBlock label="Memeriksa sesi…" />;

  if (!canManageCurriculum(role)) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader
          icon={FileText}
          title="Bank Soal"
          description="Halaman ini untuk guru dan administrator."
          tone="slate"
        />
        <Alert tone="amber" icon={AlertCircle} title="Akses ditolak">
          Hanya guru/admin yang dapat mengelola bank soal.
        </Alert>
        <div className="mt-5">
          <LinkButton to="/dashboard" variant="secondary" icon={BookOpen}>
            Kembali ke beranda
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        icon={FileText}
        title="Bank Soal"
        description="Kumpulan soal pilihan ganda per mata pelajaran, siap dipakai di ujian mana pun."
        breadcrumb={[{ label: 'Beranda', to: '/dashboard' }, { label: 'Bank Soal' }]}
        actions={
          <LinkButton to="/questions/new" icon={Plus}>
            Soal Baru
          </LinkButton>
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

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[220px] flex-1">
            <label className="label" htmlFor="question-search">
              Cari soal
            </label>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <TextInput
                id="question-search"
                className="pl-9"
                placeholder="Teks soal atau topik…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="w-full sm:w-64">
            <label className="label" htmlFor="question-subject">
              Mata pelajaran
            </label>
            <Select
              id="question-subject"
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
          <p className="pb-1 text-xs text-slate-500">
            {visible.length} soal ditampilkan
          </p>
        </div>
      </Card>

      {subjects.length === 0 && !loading && (
        <Alert tone="amber" icon={AlertCircle} title="Belum ada mata pelajaran" className="mb-4">
          Soal wajib terhubung ke mata pelajaran. Minta administrator menambahkannya
          lebih dulu (menu Pengaturan &amp; Peran → panduan SQL).
        </Alert>
      )}

      {loading ? (
        <Card>
          <LoadingBlock label="Memuat soal…" />
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            icon={FileText}
            title={
              questions.length === 0 ? 'Belum ada soal' : 'Tidak ada soal yang cocok'
            }
            description={
              questions.length === 0
                ? 'Tulis soal sekali di sini, lalu pakai ulang di banyak ujian.'
                : 'Ubah kata kunci atau ganti filter mata pelajaran.'
            }
            actions={
              questions.length === 0 ? (
                <LinkButton to="/questions/new" icon={Plus}>
                  Tulis Soal
                </LinkButton>
              ) : (
                <Button
                  variant="secondary"
                  icon={Search}
                  onClick={() => {
                    setSearch('');
                    setSubjectFilter('all');
                  }}
                >
                  Bersihkan filter
                </Button>
              )
            }
            tips={
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Satu soal berisi minimal dua pilihan jawaban.</li>
                <li>Tandai satu jawaban benar sebagai kunci.</li>
                <li>Bobot soal menentukan pengaruhnya pada nilai akhir.</li>
              </ul>
            }
          />
        </Card>
      ) : (
        <TableWrap>
          <table className="min-w-full divide-y divide-slate-200">
            <thead>
              <tr>
                <Th className="w-12">#</Th>
                <Th>Soal</Th>
                <Th>Mapel</Th>
                <Th align="center">Opsi</Th>
                <Th align="center">Bobot</Th>
                <Th align="right">Aksi</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((q, idx) => (
                <tr key={q.id} className="hover:bg-slate-50">
                  <Td className="text-slate-400">{idx + 1}</Td>
                  <Td className="max-w-xl">
                    <p className="font-medium text-slate-800">{q.question_text}</p>
                    {q.topic && (
                      <p className="mt-1 text-xs text-slate-500">Topik: {q.topic}</p>
                    )}
                  </Td>
                  <Td>
                    <Badge tone="brand" icon={BookOpen}>
                      {q.subjects?.name ?? '—'}
                    </Badge>
                  </Td>
                  <Td align="center">
                    {q.question_options?.[0]?.count ?? 0}
                  </Td>
                  <Td align="center">{q.weight ?? 1}</Td>
                  <Td align="right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <LinkButton
                        to={`/questions/${q.id}/edit`}
                        variant="secondary"
                        size="sm"
                        icon={Edit}
                      >
                        Edit
                      </LinkButton>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        className="text-red-600 hover:bg-red-50"
                        loading={deleting === q.id}
                        onClick={() => deleteQuestion(q)}
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
      )}

      <p className="mt-6 text-xs text-slate-400">
        Siap dipakai?{' '}
        <Link className="text-brand-600 hover:underline" to="/exams">
          Buka halaman Ujian
        </Link>{' '}
        untuk menyusun soal ke dalam ujian.
      </p>
    </div>
  );
}
