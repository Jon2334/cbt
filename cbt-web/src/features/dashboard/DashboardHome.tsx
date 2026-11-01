/**
 * Beranda dashboard (guru & admin).
 *
 * Tujuan UX: pengguna langsung tahu (1) kondisi datanya sekarang dan
 * (2) langkah berikutnya yang harus dilakukan. Karena itu halaman ini punya
 * tiga blok: kartu statistik, pintasan tindakan, dan aktivitas terbaru.
 *
 * Catatan keamanan: semua angka diambil lewat klien Supabase dengan RLS aktif,
 * jadi guru hanya melihat data yang memang diizinkan untuknya.
 */
import { useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  FilePlus2,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Rocket,
  School,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { canManageUsers } from '../../lib/role';
import {
  Alert,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  LoadingBlock,
  PageHeader,
  StatCard,
  TableWrap,
  Td,
  Th,
} from '../../components/ui';

interface Counts {
  classes: number;
  students: number;
  exams: number;
  results: number;
}

/** Baris hasil yang sudah diperkaya nama ujian/siswa (bila join diizinkan RLS). */
interface RecentResult {
  id: string;
  score: number | null;
  is_published: boolean;
  graded_at: string;
  exam_id: string | null;
  student_id: string | null;
  exams?: { title: string } | null;
  profiles?: { full_name: string } | null;
}

const EMPTY_COUNTS: Counts = { classes: 0, students: 0, exams: 0, results: 0 };

export default function DashboardHome() {
  const { profile, role } = useAuth();
  const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS);
  const [recentResults, setRecentResults] = useState<RecentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Guard agar state tidak di-set setelah komponen dilepas (unmount).
    let active = true;
    setLoading(true);
    setError(null);

    async function load() {
      const [classesQ, studentsQ, examsQ, resultsQ] = await Promise.all([
        supabase.from('classes').select('id', { count: 'exact', head: true }),
        supabase.from('class_members').select('id', { count: 'exact', head: true }),
        supabase.from('exams').select('id', { count: 'exact', head: true }),
        supabase.from('results').select('id', { count: 'exact', head: true }),
      ]);

      if (!active) return;

      const failures = [classesQ, studentsQ, examsQ, resultsQ]
        .map((q) => q.error)
        .filter(Boolean);
      if (failures.length) {
        setError(failures.map((e) => e?.message ?? 'Gagal memuat data').join('; '));
      } else {
        setCounts({
          classes: classesQ.count ?? 0,
          students: studentsQ.count ?? 0,
          exams: examsQ.count ?? 0,
          results: resultsQ.count ?? 0,
        });
      }

      // Ambil aktivitas terbaru; coba dengan nama ujian/siswa lebih dulu, lalu
      // turun ke versi sederhana bila relasi tidak tersedia untuk role ini.
      const enriched = await supabase
        .from('results')
        .select(
          'id,score,is_published,graded_at,exam_id,student_id,exams(title),profiles(full_name)'
        )
        .order('graded_at', { ascending: false })
        .limit(5);

      if (!active) return;

      if (!enriched.error) {
        setRecentResults((enriched.data ?? []) as unknown as RecentResult[]);
      } else {
        const plain = await supabase
          .from('results')
          .select('id,score,is_published,graded_at,exam_id,student_id')
          .order('graded_at', { ascending: false })
          .limit(5);
        if (!active) return;
        if (plain.error) {
          setError((prev) =>
            prev ? `${prev}; ${plain.error.message}` : plain.error.message
          );
        } else {
          setRecentResults((plain.data ?? []) as RecentResult[]);
        }
      }

      if (active) setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const welcomeName =
    profile?.full_name?.trim() || profile?.email?.split('@')[0] || 'Guru';
  const isAdmin = canManageUsers(role);
  const isEmptyData = counts.classes === 0 && counts.exams === 0;

  const quickActions = [
    {
      to: '/exams/new',
      icon: FilePlus2,
      title: 'Buat ujian baru',
      text: 'Tentukan kelas, mata pelajaran, jadwal, dan durasi.',
    },
    {
      to: '/questions/new',
      icon: ListChecks,
      title: 'Tambah soal',
      text: 'Tulis soal pilihan ganda beserta opsi jawabannya.',
    },
    {
      to: '/questions',
      icon: BookOpen,
      title: 'Bank soal',
      text: 'Lihat & rapikan soal yang sudah tersimpan.',
    },
    isAdmin
      ? {
          to: '/classes',
          icon: School,
          title: 'Kelas & pengguna',
          text: 'Buat kelas, mapel, tugaskan guru, daftarkan siswa.',
        }
      : {
          to: '/results',
          icon: BarChart3,
          title: 'Lihat hasil ujian',
          text: 'Pantau nilai peserta dan publikasinya.',
        },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        icon={LayoutDashboard}
        title={`Selamat datang, ${welcomeName}`}
        description="Ringkasan data kelas dan ujian, serta langkah yang bisa Anda lakukan sekarang."
        actions={
          <Badge tone={isAdmin ? 'purple' : 'brand'}>
            {isAdmin ? 'Administrator' : 'Guru'}
          </Badge>
        }
      />

      {error && (
        <Alert
          tone="amber"
          icon={Inbox}
          title="Sebagian data gagal dimuat"
          className="mb-5"
        >
          {error}
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={ClipboardList}
          label="Kelas terdaftar"
          value={counts.classes}
          tone="brand"
          hint="Kelas aktif di tahun ajaran berjalan"
        />
        <StatCard
          icon={GraduationCap}
          label="Siswa terdaftar"
          value={counts.students}
          tone="green"
          hint="Total baris keanggotaan kelas"
        />
        <StatCard
          icon={BookOpen}
          label="Total ujian"
          value={counts.exams}
          tone="amber"
          hint="Termasuk draf yang belum diterbitkan"
        />
        <StatCard
          icon={BarChart3}
          label="Hasil dinilai"
          value={counts.results}
          tone="purple"
          hint="Ujian yang sudah punya nilai"
        />
      </div>

      {isEmptyData && !loading && (
        <Card className="mt-6">
          <EmptyState
            icon={Rocket}
            title="Belum ada kelas atau ujian"
            description="Mulai dari langkah paling dasar supaya ujian bisa dijalankan oleh siswa."
            actions={
              isAdmin ? (
                <>
                  <Link className="btn btn-primary" to="/classes">
                    <School size={16} /> Buka Kelas &amp; Pengguna
                  </Link>
                  <Link className="btn btn-secondary" to="/questions/new">
                    <ListChecks size={16} /> Tulis soal
                  </Link>
                </>
              ) : (
                <>
                  <Link className="btn btn-primary" to="/exams/new">
                    <FilePlus2 size={16} /> Buat ujian pertama
                  </Link>
                  <Link className="btn btn-secondary" to="/questions/new">
                    <ListChecks size={16} /> Tulis soal
                  </Link>
                </>
              )
            }
            tips={
              <ol className="list-decimal space-y-1.5 pl-5">
                <li>
                  Siapkan <strong>mata pelajaran</strong> dan <strong>kelas</strong>{' '}
                  {isAdmin ? (
                    <>
                      di halaman <strong>Kelas &amp; Pengguna</strong>.
                    </>
                  ) : (
                    <>(dilakukan administrator).</>
                  )}
                </li>
                <li>
                  Tulis soal di <strong>Bank Soal</strong> lalu pilih mata
                  pelajarannya.
                </li>
                <li>
                  Buat <strong>ujian</strong>, pilih kelas + mapel, tentukan
                  jadwal, lalu tambahkan soalnya.
                </li>
                <li>
                  Ubah status ujian menjadi <strong>published</strong> agar siswa
                  bisa mengerjakan.
                </li>
              </ol>
            }
          />
        </Card>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {quickActions.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="card flex items-start gap-3 p-5 transition-shadow hover:shadow-md"
          >
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100"
              aria-hidden="true"
            >
              <a.icon size={20} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-800">
                {a.title}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">{a.text}</span>
            </span>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader
          icon={Inbox}
          title="Aktivitas terbaru"
          description="Lima hasil ujian terakhir yang tercatat."
          action={
            <Link className="btn btn-secondary btn-sm" to="/results">
              Lihat semua
            </Link>
          }
        />
        {loading ? (
          <LoadingBlock label="Memuat aktivitas…" />
        ) : recentResults.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={Inbox}
              title="Belum ada hasil ujian"
              description="Hasil akan muncul di sini setelah siswa mengerjakan ujian."
            />
          </div>
        ) : (
          <div className="p-3 sm:p-4">
            <TableWrap>
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr>
                    <Th>Ujian</Th>
                    <Th>Siswa</Th>
                    <Th align="right">Nilai</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentResults.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <Td>
                        <span className="font-medium text-slate-800">
                          {r.exams?.title ?? r.exam_id?.slice(0, 8) ?? '—'}
                        </span>
                      </Td>
                      <Td>
                        {r.profiles?.full_name ?? r.student_id?.slice(0, 8) ?? '—'}
                      </Td>
                      <Td align="right" className="font-semibold text-slate-800">
                        {r.score ?? '—'}
                      </Td>
                      <Td>
                        {r.is_published ? (
                          <Badge tone="green">Dipublikasikan</Badge>
                        ) : (
                          <Badge tone="amber">Belum dipublikasikan</Badge>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>
        )}
      </Card>
    </div>
  );
}
