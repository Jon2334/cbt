/**
 * Kelola Ujian (guru & admin).
 *
 * Perubahan UI/UX:
 * - Tabel diganti daftar kartu berisi nama mapel + kelas + jadwal sehingga
 *   pengguna tidak perlu menerka ID/relasi.
 * - Aksi diberi label ("Soal", "Hasil", "Terbitkan", …), bukan ikon saja.
 * - Ada pencarian dan filter status (Semua/Draft/Terbitkan/Arsip).
 * - Keadaan kosong menjelaskan langkah yang harus dilakukan lebih dulu.
 *
 * Logika data tidak berubah: `exams` dibaca lewat klien Supabase dengan RLS
 * `teacher_exams_owned_or_assigned`; publikasi nilai lewat RPC
 * `fn_publish_results` (SECURITY DEFINER) — tidak ada penulisan langsung ke
 * tabel `results`. `open_at`/`close_at` adalah kolom NOT NULL, jadi tidak
 * mungkin bernilai null (pemeriksaan dipertahankan sebagai pengaman).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Ban,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock,
  Edit,
  Eye,
  FileText,
  Inbox,
  List,
  Plus,
  Rocket,
  Search,
  SlidersHorizontal,
  Trash2,
  Users,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { canManageCurriculum } from '../../../lib/role';
import type { Exam, ExamStatus } from '../../../types/cbt';
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
  TextInput,
  type Tone,
} from '../../../components/ui';

interface ExamRow extends Exam {
  attempt_count: number;
  subject_name: string | null;
  class_name: string | null;
}

const STATUS_LABEL: Record<ExamStatus, string> = {
  draft: 'Draft',
  published: 'Diterbitkan',
  archived: 'Diarsipkan',
};

const STATUS_TONE: Record<ExamStatus, Tone> = {
  draft: 'amber',
  published: 'green',
  archived: 'slate',
};

type StatusFilter = 'all' | ExamStatus;

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Semua' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Diterbitkan' },
  { value: 'archived', label: 'Diarsipkan' },
];

const fmt = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
};

export default function ExamsPage() {
  const { role, loading: authLoading } = useAuth();
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  const fetchExams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Coba ambil sekaligus nama mapel/kelas + jumlah peserta (menghindari
      // N+1 query). Bila relasi tidak tersedia, turun ke query sederhana.
      const enriched = await supabase
        .from('exams')
        .select('*, subjects(name), classes(name), exam_attempts(count)')
        .order('created_at', { ascending: false });

      if (!enriched.error) {
        const rows = ((enriched.data ?? []) as unknown as Array<
          Exam & {
            subjects?: { name: string } | null;
            classes?: { name: string } | null;
            exam_attempts?: Array<{ count: number }> | null;
          }
        >).map((e) => ({
          ...e,
          subject_name: e.subjects?.name ?? null,
          class_name: e.classes?.name ?? null,
          attempt_count: e.exam_attempts?.[0]?.count ?? 0,
        })) as ExamRow[];
        setExams(rows);
        return;
      }

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
        rows.push({
          ...exam,
          subject_name: null,
          class_name: null,
          attempt_count: count ?? 0,
        });
      }
      setExams(rows);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Gagal memuat daftar ujian.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchExams();
  }, [fetchExams]);

  const publishExam = async (exam: Exam, next: 'published' | 'draft') => {
    setProcessing(`${exam.id}:${next}`);
    setError(null);
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
      setNotice(
        next === 'published'
          ? `Ujian "${exam.title}" diterbitkan. Siswa di kelasnya sudah bisa mengerjakan.`
          : `Publikasi ujian "${exam.title}" dibatalkan (kembali menjadi draft).`
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
    setError(null);
    const { error: err } = await supabase.rpc('fn_publish_results', {
      p_exam_id: exam.id,
      p_publish: true,
    });
    if (err) setError(err.message);
    else {
      setNotice(`Hasil ujian "${exam.title}" dipublikasikan ke siswa.`);
      setExams((prev) =>
        prev.map((e) => (e.id === exam.id ? { ...e, status: e.status } : e))
      );
    }
    setProcessing(null);
  };

  const archiveExam = async (exam: Exam) => {
    const confirmed = window.confirm(
      `Arsipkan ujian "${exam.title}"? Ujian tidak akan ditampilkan ke peserta lagi.`
    );
    if (!confirmed) return;
    setProcessing(`${exam.id}:archive`);
    setError(null);
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
    exam.status === 'draft' && Boolean(exam.open_at && exam.close_at);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return exams.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        e.title.toLowerCase().includes(needle) ||
        (e.subject_name ?? '').toLowerCase().includes(needle) ||
        (e.class_name ?? '').toLowerCase().includes(needle)
      );
    });
  }, [exams, statusFilter, search]);

  const countByStatus = useMemo(() => {
    const base: Record<ExamStatus, number> = { draft: 0, published: 0, archived: 0 };
    for (const e of exams) base[e.status] += 1;
    return base;
  }, [exams]);

  if (authLoading) return <LoadingBlock label="Memeriksa sesi…" />;

  if (!canManageCurriculum(role)) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader
          icon={ClipboardList}
          title="Kelola Ujian"
          description="Halaman ini untuk guru dan administrator."
          tone="slate"
        />
        <Alert tone="amber" icon={AlertCircle} title="Akses ditolak">
          Hanya guru/admin yang dapat mengelola ujian. Akun siswa mengerjakan ujian
          lewat aplikasi Android.
        </Alert>
        <div className="mt-5">
          <LinkButton to="/dashboard" variant="secondary" icon={Inbox}>
            Kembali ke beranda
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        icon={ClipboardList}
        title="Kelola Ujian"
        description="Buat ujian, tambahkan soal, atur jadwal, lalu terbitkan ke kelas."
        breadcrumb={[{ label: 'Beranda', to: '/dashboard' }, { label: 'Ujian' }]}
        actions={
          <LinkButton to="/exams/new" icon={Plus}>
            Buat Ujian
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
            <label className="label" htmlFor="exam-search">
              Cari ujian
            </label>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <TextInput
                id="exam-search"
                className="pl-9"
                placeholder="Judul, mata pelajaran, atau kelas…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="w-full sm:w-48">
            <label className="label" htmlFor="exam-status">
              Status
            </label>
            <Select
              id="exam-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                  {f.value !== 'all' ? ` (${countByStatus[f.value]})` : ''}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-1 text-xs text-slate-500">
            <SlidersHorizontal size={14} aria-hidden="true" />
            {visible.length} dari {exams.length} ujian
          </div>
        </div>
      </Card>

      {loading ? (
        <Card>
          <LoadingBlock label="Memuat daftar ujian…" />
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-5">
          <EmptyState
            icon={FileText}
            title={
              exams.length === 0 ? 'Belum ada ujian' : 'Tidak ada ujian yang cocok'
            }
            description={
              exams.length === 0
                ? 'Ujian membutuhkan mata pelajaran dan kelas yang sudah dibuat administrator.'
                : 'Ubah kata kunci pencarian atau pilih status lain.'
            }
            actions={
              exams.length === 0 ? (
                <LinkButton to="/exams/new" icon={Plus}>
                  Buat Ujian
                </LinkButton>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('all');
                  }}
                  icon={Search}
                >
                  Bersihkan filter
                </Button>
              )
            }
            tips={
              <ol className="list-decimal space-y-1.5 pl-5">
                <li>
                  Pastikan <strong>mata pelajaran</strong> & <strong>kelas</strong>{' '}
                  sudah ada (dibuat admin).
                </li>
                <li>Buat ujian, lalu tambahkan soal dari bank soal.</li>
                <li>Terbitkan agar siswa bisa mengerjakan.</li>
              </ol>
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {visible.map((e) => {
            const busyPublish =
              processing === `${e.id}:${e.status === 'draft' ? 'published' : 'draft'}`;
            return (
              <li key={e.id}>
                <Card className="card-pad">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-bold">{e.title}</h2>
                        <Badge tone={STATUS_TONE[e.status]}>
                          {STATUS_LABEL[e.status]}
                        </Badge>
                      </div>
                      {e.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                          {e.description}
                        </p>
                      )}

                      <dl className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="flex items-center gap-2">
                          <BookOpen size={15} className="text-slate-400" aria-hidden="true" />
                          <dt className="sr-only">Mata pelajaran</dt>
                          <dd>{e.subject_name ?? 'Mapel tidak terbaca'}</dd>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users size={15} className="text-slate-400" aria-hidden="true" />
                          <dt className="sr-only">Kelas</dt>
                          <dd>{e.class_name ?? 'Kelas tidak terbaca'}</dd>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock size={15} className="text-slate-400" aria-hidden="true" />
                          <dt className="sr-only">Jadwal</dt>
                          <dd>{e.duration_minutes} menit</dd>
                        </div>
                        <div className="flex items-center gap-2">
                          <List size={15} className="text-slate-400" aria-hidden="true" />
                          <dt className="sr-only">Peserta</dt>
                          <dd>{e.attempt_count} peserta mengerjakan</dd>
                        </div>
                      </dl>

                      <p className="mt-2 text-xs text-slate-500">
                        Mulai: <strong>{fmt(e.open_at)}</strong> · Tutup:{' '}
                        <strong>{fmt(e.close_at)}</strong>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <LinkButton
                        to={`/exams/${e.id}/questions`}
                        variant="secondary"
                        size="sm"
                        icon={List}
                      >
                        Soal
                      </LinkButton>
                      <LinkButton
                        to={`/exams/${e.id}/results`}
                        variant="secondary"
                        size="sm"
                        icon={Eye}
                      >
                        Hasil
                      </LinkButton>
                      <LinkButton
                        to={`/exams/${e.id}/edit`}
                        variant="ghost"
                        size="sm"
                        icon={Edit}
                      >
                        Edit
                      </LinkButton>

                      {canBePublished(e) && (
                        <Button
                          size="sm"
                          icon={Rocket}
                          loading={busyPublish}
                          onClick={() => publishExam(e, 'published')}
                        >
                          Terbitkan
                        </Button>
                      )}
                      {e.status === 'published' && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={CheckCircle2}
                            loading={processing === `${e.id}:publish-results`}
                            onClick={() => publishResults(e)}
                          >
                            Publikasi nilai
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Ban}
                            loading={busyPublish}
                            onClick={() => publishExam(e, 'draft')}
                          >
                            Batalkan
                          </Button>
                        </>
                      )}
                      {e.status !== 'archived' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Trash2}
                          className="text-red-600 hover:bg-red-50"
                          loading={processing === `${e.id}:archive`}
                          onClick={() => archiveExam(e)}
                        >
                          Arsipkan
                        </Button>
                      )}
                    </div>
                  </div>

                  {e.status === 'draft' && !canBePublished(e) && (
                    <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <AlertCircle size={14} aria-hidden="true" />
                      Isi jadwal mulai &amp; tutup terlebih dahulu sebelum dapat
                      diterbitkan.
                    </p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-xs text-slate-400">
        Butuh memantau semua nilai?{' '}
        <Link className="text-brand-600 hover:underline" to="/results">
          Buka rekap hasil per ujian
        </Link>
        .
      </p>
    </div>
  );
}
