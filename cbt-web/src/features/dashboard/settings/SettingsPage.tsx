/**
 * Pengaturan & Peran (khusus administrator).
 *
 * Halaman ini menggantikan stub "Halaman ini akan dikembangkan selanjutnya".
 * Isinya: matriks hak akses, detail akun yang sedang masuk, dan penunjuk ke
 * halaman Kelas & Pengguna. Panduan SQL tetap disertakan hanya sebagai jalur
 * cadangan untuk operasi massal.
 */
import { Link } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Database,
  ExternalLink,
  GraduationCap,
  Info,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  School,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';
import { useAuth } from '../../../lib/auth';
import { canManageUsers } from '../../../lib/role';
import {
  Alert,
  Badge,
  Card,
  CardHeader,
  PageHeader,
  TableWrap,
  Td,
  Th,
  type Tone,
} from '../../../components/ui';

interface CapabilityRow {
  label: string;
  admin: 'ya' | 'baca' | 'tidak';
  teacher: 'ya' | 'baca' | 'tidak';
  student: 'ya' | 'baca' | 'tidak';
}

/**
 * Matriks ini mengikuti policy RLS di supabase/migrations/002_rls_policies.sql
 * (classes, class_members, teacher_assignments, exams, results).
 */
const CAPABILITIES: CapabilityRow[] = [
  { label: 'Mengelola pengguna & peran', admin: 'ya', teacher: 'tidak', student: 'tidak' },
  { label: 'Membuat & mengubah kelas', admin: 'ya', teacher: 'baca', student: 'baca' },
  { label: 'Mendaftarkan siswa ke kelas', admin: 'ya', teacher: 'baca', student: 'tidak' },
  { label: 'Menetapkan guru ke kelas & mapel', admin: 'ya', teacher: 'baca', student: 'tidak' },
  { label: 'Membuat & menyunting soal', admin: 'ya', teacher: 'ya', student: 'tidak' },
  { label: 'Membuat, menerbitkan, mengarsipkan ujian', admin: 'ya', teacher: 'ya', student: 'tidak' },
  { label: 'Melihat hasil & publikasi nilai', admin: 'ya', teacher: 'ya', student: 'baca' },
  { label: 'Mengerjakan ujian', admin: 'tidak', teacher: 'tidak', student: 'ya' },
];

const ACCESS_LABEL: Record<CapabilityRow['admin'], { text: string; tone: Tone }> = {
  ya: { text: 'Penuh', tone: 'green' },
  baca: { text: 'Baca saja', tone: 'blue' },
  tidak: { text: 'Tidak ada', tone: 'slate' },
};

function AccessCell({ value }: { value: CapabilityRow['admin'] }) {
  const { text, tone } = ACCESS_LABEL[value];
  return <Badge tone={tone}>{text}</Badge>;
}

const GUIDES = [
  {
    icon: ClipboardList,
    title: 'Alur membuat ujian',
    steps: [
      'Tentukan mata pelajaran & kelas dulu (dikelola admin).',
      'Tulis soal di menu Bank Soal dan pilih mata pelajarannya.',
      'Buat ujian: pilih kelas, mapel, jadwal, durasi, dan jumlah percobaan.',
      'Tambahkan soal ke ujian, lalu ubah status ke published.',
    ],
  },
  {
    icon: BookOpen,
    title: 'Tips bank soal',
    steps: [
      'Satu soal = satu topik agar mudah dicari ulang.',
      'Bobot soal menentukan kontribusinya pada nilai akhir.',
      'Opsi jawaban diacak bila opsi "acak pilihan" aktif di ujian.',
    ],
  },
  {
    icon: BarChart3,
    title: 'Alur hasil & publikasi',
    steps: [
      'Nilai terbentuk otomatis setelah siswa mengumpulkan jawaban.',
      'Buka menu Hasil untuk melihat rekap per ujian.',
      'Gunakan publikasi nilai bila siswa boleh melihat nilainya.',
    ],
  },
];

export default function SettingsPage() {
  const { profile, role } = useAuth();

  if (!canManageUsers(role)) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader
          icon={Settings}
          title="Pengaturan & Peran"
          description="Halaman ini khusus administrator."
          tone="slate"
        />
        <Alert tone="amber" icon={ShieldCheck} title="Akses terbatas">
          Akun Anda masuk sebagai <strong>guru</strong>. Menu pengguna, kelas, dan
          mata pelajaran hanya dapat dibuka oleh administrator. Hubungi admin
          sekolah bila Anda memerlukannya.
        </Alert>
        <div className="mt-5">
          <Link className="btn btn-primary" to="/dashboard">
            <LayoutDashboard size={16} /> Kembali ke beranda
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        icon={Settings}
        title="Pengaturan & Peran"
        description="Ringkasan hak akses, informasi akun, dan panduan pengelolaan data sekolah."
        tone="purple"
        breadcrumb={[{ label: 'Beranda', to: '/dashboard' }, { label: 'Pengaturan & Peran' }]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            icon={UserCog}
            title="Matriks hak akses"
            description="Ditentukan policy RLS di server — tampilan menu hanya mengikuti."
          />
          <div className="p-3 sm:p-4">
            <TableWrap>
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr>
                    <Th>Kemampuan</Th>
                    <Th align="center">Admin</Th>
                    <Th align="center">Guru</Th>
                    <Th align="center">Siswa</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {CAPABILITIES.map((c) => (
                    <tr key={c.label} className="hover:bg-slate-50">
                      <Td>{c.label}</Td>
                      <Td align="center">
                        <AccessCell value={c.admin} />
                      </Td>
                      <Td align="center">
                        <AccessCell value={c.teacher} />
                      </Td>
                      <Td align="center">
                        <AccessCell value={c.student} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              icon={ShieldCheck}
              title="Akun Anda"
              description="Data dibaca dari tabel profiles."
              tone="green"
            />
            <dl className="divide-y divide-slate-100">
              {[
                { k: 'Nama', v: profile?.full_name || '—' },
                { k: 'Email', v: profile?.email || '—' },
                { k: 'Peran', v: 'Administrator' },
                { k: 'ID pengguna', v: profile?.id || '—' },
              ].map((row) => (
                <div key={row.k} className="flex items-start justify-between gap-3 px-5 py-3">
                  <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    {row.k}
                  </dt>
                  <dd className="truncate text-right text-sm text-slate-700">{row.v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Alert tone="blue" icon={KeyRound} title="Keamanan akun">
            Peran tidak bisa diubah dari browser. Buat akun admin/guru baru melalui
            admin SQL Supabase (insert <code>auth.users</code> + promote{' '}
            <code>profiles.role</code>), lalu minta pengguna mengganti kata
            sandinya.
          </Alert>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {GUIDES.map((g) => (
          <Card key={g.title}>
            <CardHeader icon={g.icon} title={g.title} />
            <ul className="space-y-2 p-5 text-sm text-slate-600">
              {g.steps.map((s) => (
                <li key={s} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader
          icon={Database}
          title="Kelola kelas, mapel & keanggotaan"
          description="Sudah tersedia di antarmuka web — tidak perlu menulis SQL."
          tone="green"
          action={
            <Link className="btn btn-primary btn-sm" to="/classes">
              <School size={14} /> Buka Kelas &amp; Pengguna
            </Link>
          }
        />
        <div className="space-y-4 p-5">
          <Alert tone="green" icon={School} title="Mulai dari halaman Kelas & Pengguna">
            Kelas, mata pelajaran, penugasan guru, dan keanggotaan siswa kini dapat
            dikelola langsung dari browser. Penulisan hanya diizinkan untuk peran{' '}
            <strong>admin</strong> (policy <code>admin_*_all</code> di server).
          </Alert>

          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
            <li>
              Buka halaman <strong>Kelas &amp; Pengguna</strong>.
            </li>
            <li>
              Buat <strong>kelas</strong> (mis. X IPA 1) beserta tahun ajarannya.
            </li>
            <li>
              Buat <strong>mata pelajaran</strong> (mis. Matematika, kode MTK).
            </li>
            <li>
              <strong>Tugaskan guru</strong> ke kelas &amp; mapel tersebut.
            </li>
            <li>
              <strong>Tambahkan siswa</strong> sebagai anggota kelas.
            </li>
            <li>
              Baru setelah itu buat <strong>ujian</strong> di halaman Ujian, karena
              ujian wajib punya kelas + mata pelajaran.
            </li>
          </ol>

          <Alert tone="amber" icon={Info} title="Kapan perlu SQL?">
            Hanya untuk operasi massal (mis. memindahkan puluhan siswa sekaligus atau
            impor data dari Excel). Untuk operasi sehari-hari, gunakan halaman Kelas
            &amp; Pengguna. Jalankan lewat Supabase Studio → <strong>SQL Editor</strong>.
          </Alert>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <GraduationCap size={16} /> Urutan yang benar
              </p>
              <p className="mt-1 text-xs text-slate-500">
                subjects → classes → teacher_assignments → class_members → exams
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Users size={16} /> Mengapa urutannya penting
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Fungsi <code>fn_start_exam</code> menolak siswa yang belum terdaftar
                di kelas ujian tersebut.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link className="btn btn-primary" to="/classes">
              <School size={16} /> Buka Kelas &amp; Pengguna
            </Link>
            <Link className="btn btn-secondary" to="/exams">
              <ClipboardList size={16} /> Buka halaman Ujian
            </Link>
            <Link className="btn btn-secondary" to="/questions">
              <ListChecks size={16} /> Buka Bank Soal
            </Link>
            <a
              className="btn btn-ghost"
              href="https://supabase.com/dashboard/projects"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} /> Supabase Studio
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
