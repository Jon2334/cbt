/**
 * Daftar hasil siswa per ujian (guru & admin).
 *
 * Read-only via supabase client; RLS `teacher_results` (FOR ALL) membatasi ke
 * ujian yang diajar guru. Publish/unpublish hasil memakai RPC
 * `fn_publish_results(p_exam_id UUID, p_publish BOOLEAN)` (SECURITY DEFINER,
 * hanya guru pembuat ujian atau admin).
 *
 * Perubahan UI/UX: ringkasan statistik (jumlah peserta, rata-rata, tertinggi,
 * terendah, sudah dipublikasikan), warna nilai sesuai KKM, dan label pada aksi.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import type { Exam, Result } from '../../../types/cbt';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  BarChart3,
  CheckCircle2,
  Eye,
  EyeOff,
  Inbox,
  RefreshCw,
  TrendingUp,
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
  StatCard,
  TableWrap,
  Td,
  Th,
  type Tone,
} from '../../../components/ui';

interface Row extends Result {
  student_name: string;
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

/** Ambang batas tampilan nilai (konsisten dengan KKM umum 75). */
const scoreTone = (score: number): Tone =>
  score >= 75 ? 'green' : score >= 60 ? 'amber' : 'red';

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function ExamResults() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
        (resultsRes.data ?? []).map((r: unknown) => {
          const row = r as Result & { profiles?: { full_name?: string } | null };
          return {
            ...row,
            student_name: row.profiles?.full_name ?? '—',
          };
        })
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Gagal memuat data.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const togglePublish = async (target: Exam, next: boolean) => {
    if (!target) return;
    const action = next ? 'memublikasikan' : 'membatalkan publikasi';
    if (!window.confirm(`Yakin ${action} hasil ujian "${target.title}"?`)) return;
    setMutating(true);
    setError(null);
    const { error: err } = await supabase.rpc('fn_publish_results', {
      p_exam_id: target.id,
      p_publish: next,
    });
    if (err) {
      setError(err.message);
    } else {
      setNotice(
        next
          ? 'Nilai dipublikasikan — siswa dapat melihatnya.'
          : 'Publikasi nilai dibatalkan.'
      );
      setRows((prev) => prev.map((r) => ({ ...r, is_published: next })));
      await loadData();
    }
    setMutating(false);
  };

  const stats = useMemo(() => {
    if (rows.length === 0)
      return { avg: 0, max: 0, min: 0, published: 0, passed: 0 };
    const scores = rows.map((r) => Number(r.score) || 0);
    return {
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      max: Math.max(...scores),
      min: Math.min(...scores),
      published: rows.filter((r) => r.is_published).length,
      passed: scores.filter((s) => s >= 75).length,
    };
  }, [rows]);

  if (loading) {
    return (
      <Card>
        <LoadingBlock label="Memuat hasil ujian…" />
      </Card>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        icon={BarChart3}
        title={exam?.title ?? 'Hasil Ujian'}
        description="Rekap nilai peserta ujian ini. Publikasikan bila siswa boleh melihat nilainya."
        breadcrumb={[
          { label: 'Beranda', to: '/dashboard' },
          { label: 'Ujian', to: '/exams' },
          { label: 'Hasil' },
        ]}
        actions={
          <>
            {exam && <Badge tone={STATUS_TONE[exam.status]}>{STATUS_LABEL[exam.status]}</Badge>}
            <Button
              variant="secondary"
              icon={RefreshCw}
              loading={mutating}
              onClick={() => loadData()}
            >
              Muat ulang
            </Button>
            {exam &&
              (exam.status !== 'published' ? (
                <Button icon={Eye} onClick={() => togglePublish(exam, true)}>
                  Publikasikan hasil
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  icon={EyeOff}
                  onClick={() => togglePublish(exam, false)}
                >
                  Batalkan publikasi
                </Button>
              ))}
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Inbox}
          label="Peserta dinilai"
          value={rows.length}
          hint={`${stats.published} nilai sudah dipublikasikan`}
        />
        <StatCard
          icon={TrendingUp}
          label="Rata-rata nilai"
          value={stats.avg ? stats.avg.toFixed(2) : '—'}
          tone="purple"
          hint="Dibulatkan dua angka di belakang koma"
        />
        <StatCard
          icon={Award}
          label="Nilai tertinggi"
          value={rows.length ? stats.max.toFixed(2) : '—'}
          tone="green"
          hint={`Nilai terendah: ${rows.length ? stats.min.toFixed(2) : '—'}`}
        />
        <StatCard
          icon={CheckCircle2}
          label="Tuntas (≥ 75)"
          value={stats.passed}
          tone="amber"
          hint={`${rows.length ? Math.round((stats.passed / rows.length) * 100) : 0}% dari peserta`}
        />
      </div>

      <Card className="mt-6">
        <CardHeader
          icon={BarChart3}
          title="Daftar nilai"
          description="Diurutkan dari yang paling baru dinilai."
        />
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Inbox}
              title="Belum ada hasil untuk ujian ini"
              description="Nilai muncul setelah siswa mengumpulkan jawaban dan sistem menilainya."
              actions={
                <LinkButton to={`/exams/${id}/questions`} variant="secondary" icon={ArrowLeft}>
                  Periksa daftar soal
                </LinkButton>
              }
              tips={
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>Pastikan ujian sudah <strong>diterbitkan</strong>.</li>
                  <li>Pastikan siswa terdaftar sebagai anggota kelas ujian.</li>
                  <li>Setiap soal punya kunci jawaban agar bisa dinilai otomatis.</li>
                </ul>
              }
            />
          </div>
        ) : (
          <div className="p-3 sm:p-4">
            <TableWrap>
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr>
                    <Th>Peserta</Th>
                    <Th align="right">Nilai</Th>
                    <Th align="right">Maks</Th>
                    <Th align="center">Benar</Th>
                    <Th align="center">Total soal</Th>
                    <Th align="center">Publikasi</Th>
                    <Th>Dinilai</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <Td className="font-medium text-slate-800">{r.student_name}</Td>
                      <Td align="right">
                        <Badge tone={scoreTone(Number(r.score) || 0)}>
                          {Number(r.score).toFixed(2)}
                        </Badge>
                      </Td>
                      <Td align="right">{Number(r.max_score).toFixed(2)}</Td>
                      <Td align="center">{r.correct_answers}</Td>
                      <Td align="center">{r.total_questions}</Td>
                      <Td align="center">
                        {r.is_published ? (
                          <Badge tone="green">Terpublikasi</Badge>
                        ) : (
                          <Badge tone="slate">Belum</Badge>
                        )}
                      </Td>
                      <Td className="text-slate-400">{fmtDateTime(r.graded_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>
        )}
      </Card>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/exams"
          className="inline-flex items-center gap-2 text-sm text-brand-600 hover:underline"
        >
          <ArrowLeft size={16} /> Kembali ke daftar ujian
        </Link>
        {id && (
          <Button variant="secondary" onClick={() => navigate(`/exams/${id}/questions`)}>
            Atur soal ujian
          </Button>
        )}
      </div>
    </div>
  );
}
