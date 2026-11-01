/**
 * Kelas & Pengguna (khusus administrator).
 *
 * Sebelumnya pembuatan kelas/mapel/keanggotaan hanya bisa lewat SQL di Supabase.
 * Halaman ini menyediakan UI untuk operasi tersebut agar admin tidak perlu
 * menulis query:
 *   1. Kelas            → public.classes           (nama, tingkat, tahun ajaran, arsip)
 *   2. Mata pelajaran   → public.subjects          (nama, kode)
 *   3. Penugasan guru   → public.teacher_assignments (guru × kelas × mapel)
 *   4. Anggota kelas    → public.class_members     (siswa masuk/keluar kelas)
 *
 * Keamanan: seluruh penulisan memakai klien Supabase biasa TANPA service key.
 * Yang menjaga adalah RLS di server — hanya policy `admin_*_all` (migrasi 002)
 * yang mengizinkan tulis untuk tabel-tabel ini, dan policy itu memakai
 * `get_role()` yang membaca `auth.uid()` di server. Jadi menyembunyikan menu
 * hanya soal kerapian; penolakan sebenarnya tetap dari database.
 *
 * Semua `created_by` diisi dari profil sesi (server-verified), bukan dari input.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Info,
  Layers,
  Plus,
  School,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { canManageUsers } from '../../../lib/role';
import type { ClassRecord, Subject } from '../../../types/cbt';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  LoadingBlock,
  PageHeader,
  Select,
  StatCard,
  TableWrap,
  Td,
  TextInput,
  Th,
} from '../../../components/ui';

interface PersonRow {
  id: string;
  full_name: string;
  email: string | null;
  role: 'admin' | 'teacher' | 'student' | null;
}

interface MemberRow {
  id: string;
  class_id: string;
  student_id: string;
  joined_at: string;
}

interface AssignmentRow {
  id: string;
  teacher_id: string;
  class_id: string | null;
  subject_id: string | null;
}

interface ExamRow {
  id: string;
  class_id: string;
  status: 'draft' | 'published' | 'archived';
}

const currentAcademicYear = () => {
  const now = new Date();
  const y = now.getFullYear();
  return `${y}/${y + 1}`;
};

export default function ClassesPage() {
  const { profile, role, loading: authLoading } = useAuth();
  const isAdmin = canManageUsers(role);

  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [exams, setExams] = useState<ExamRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [showClassForm, setShowClassForm] = useState(false);
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);

  const [classForm, setClassForm] = useState({
    name: '',
    grade_level: 'X',
    academic_year: currentAcademicYear(),
  });
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '' });
  const [assignForm, setAssignForm] = useState({
    teacher_id: '',
    class_id: '',
    subject_id: '',
  });
  const [newStudentId, setNewStudentId] = useState('');

  /* ------------------------------------------------------------------ */
  /* Muat data                                                          */
  /* ------------------------------------------------------------------ */

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [cRes, sRes, pRes, mRes, aRes, eRes] = await Promise.all([
      supabase.from('classes').select('*').order('name'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('profiles').select('id,full_name,email,role').order('full_name'),
      supabase.from('class_members').select('id,class_id,student_id,joined_at'),
      supabase
        .from('teacher_assignments')
        .select('id,teacher_id,class_id,subject_id'),
      supabase.from('exams').select('id,class_id,status'),
    ]);

    const firstError =
      cRes.error || sRes.error || pRes.error || mRes.error || aRes.error || eRes.error;
    if (firstError) setError(firstError.message);

    const classList = (cRes.data ?? []) as ClassRecord[];
    setClasses(classList);
    setSubjects((sRes.data ?? []) as Subject[]);
    setPeople((pRes.data ?? []) as PersonRow[]);
    setMembers((mRes.data ?? []) as MemberRow[]);
    setAssignments((aRes.data ?? []) as AssignmentRow[]);
    setExams((eRes.data ?? []) as ExamRow[]);
    setSelectedClassId((prev) => prev ?? classList[0]?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      /* oxlint-disable react/set-state-in-effect */
      await loadAll();
      /* oxlint-enable react/set-state-in-effect */
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAdmin, loadAll]);

  /* ------------------------------------------------------------------ */
  /* Peta data                                                          */
  /* ------------------------------------------------------------------ */

  const peopleById = useMemo(() => {
    const map = new Map<string, PersonRow>();
    people.forEach((p) => map.set(p.id, p));
    return map;
  }, [people]);

  const students = useMemo(
    () => people.filter((p) => p.role === 'student'),
    [people]
  );
  const teachers = useMemo(
    () => people.filter((p) => p.role === 'teacher' || p.role === 'admin'),
    [people]
  );

  const memberCount = useMemo(() => {
    const map = new Map<string, number>();
    members.forEach((m) => map.set(m.class_id, (map.get(m.class_id) ?? 0) + 1));
    return map;
  }, [members]);

  const examCount = useMemo(() => {
    const map = new Map<string, number>();
    exams.forEach((e) => map.set(e.class_id, (map.get(e.class_id) ?? 0) + 1));
    return map;
  }, [exams]);

  const subjectName = useCallback(
    (id: string | null) => (id ? (subjects.find((s) => s.id === id)?.name ?? '—') : '—'),
    [subjects]
  );
  const className = useCallback(
    (id: string | null) => (id ? (classes.find((c) => c.id === id)?.name ?? '—') : '—'),
    [classes]
  );

  const selectedClass = classes.find((c) => c.id === selectedClassId) ?? null;
  const selectedMembers = useMemo(
    () => members.filter((m) => m.class_id === selectedClassId),
    [members, selectedClassId]
  );
  const memberIdsInSelected = useMemo(
    () => new Set(selectedMembers.map((m) => m.student_id)),
    [selectedMembers]
  );

  const activeClasses = classes.filter((c) => !c.is_archived);
  const stats = {
    classes: activeClasses.length,
    subjects: subjects.length,
    students: new Set(members.map((m) => m.student_id)).size,
    assignments: assignments.length,
  };

  /* ------------------------------------------------------------------ */
  /* Aksi                                                               */
  /* ------------------------------------------------------------------ */

  const run = async (key: string, fn: () => Promise<string | null>) => {
    setBusy(key);
    setError(null);
    const msg = await fn();
    if (msg) setError(msg);
    setBusy(null);
  };

  /** 1. Buat kelas baru. */
  const createClass = () =>
    run('create-class', async () => {
      const name = classForm.name.trim();
      if (!name) return 'Nama kelas wajib diisi.';
      if (!classForm.academic_year.trim()) return 'Tahun ajaran wajib diisi.';
      const { data, error: err } = await supabase
        .from('classes')
        .insert([
          {
            name,
            grade_level: classForm.grade_level.trim() || null,
            academic_year: classForm.academic_year.trim(),
            created_by: profile?.id ?? null,
          },
        ])
        .select('id')
        .single();
      if (err) return err.message;
      setClassForm({
        name: '',
        grade_level: classForm.grade_level,
        academic_year: classForm.academic_year,
      });
      setShowClassForm(false);
      setNotice(`Kelas "${name}" dibuat. Tambahkan siswa pada panel Anggota kelas.`);
      if (data?.id) setSelectedClassId(data.id);
      await loadAll();
      return null;
    });

  /** Arsipkan / aktifkan kembali kelas (soft delete). */
  const toggleArchive = (target: ClassRecord) =>
    run(`class-${target.id}`, async () => {
      const { error: err } = await supabase
        .from('classes')
        .update({ is_archived: !target.is_archived })
        .eq('id', target.id);
      if (err) return err.message;
      setNotice(
        target.is_archived
          ? `Kelas "${target.name}" diaktifkan kembali.`
          : `Kelas "${target.name}" diarsipkan.`
      );
      await loadAll();
      return null;
    });

  /** 2. Buat mata pelajaran. */
  const createSubject = () =>
    run('create-subject', async () => {
      const name = subjectForm.name.trim();
      if (!name) return 'Nama mata pelajaran wajib diisi.';
      const { error: err } = await supabase.from('subjects').insert([
        {
          name,
          code: subjectForm.code.trim() || null,
          created_by: profile?.id ?? null,
        },
      ]);
      if (err) return err.message;
      setSubjectForm({ name: '', code: '' });
      setShowSubjectForm(false);
      setNotice(`Mata pelajaran "${name}" dibuat.`);
      await loadAll();
      return null;
    });

  /** 3. Tugaskan guru ke kelas & mapel. */
  const createAssignment = () =>
    run('create-assignment', async () => {
      if (!assignForm.teacher_id || !assignForm.class_id || !assignForm.subject_id)
        return 'Guru, kelas, dan mata pelajaran wajib dipilih.';
      const exists = assignments.some(
        (a) =>
          a.teacher_id === assignForm.teacher_id &&
          a.class_id === assignForm.class_id &&
          a.subject_id === assignForm.subject_id
      );
      if (exists) return 'Penugasan ini sudah ada.';
      const { error: err } = await supabase.from('teacher_assignments').insert([
        {
          teacher_id: assignForm.teacher_id,
          class_id: assignForm.class_id,
          subject_id: assignForm.subject_id,
        },
      ]);
      if (err) return err.message;
      setAssignForm({ teacher_id: '', class_id: '', subject_id: '' });
      setShowAssignForm(false);
      setNotice('Penugasan guru disimpan — guru tersebut kini dapat mengajar kelas ini.');
      await loadAll();
      return null;
    });

  const deleteAssignment = (row: AssignmentRow) =>
    run(`assign-${row.id}`, async () => {
      const label = `${peopleById.get(row.teacher_id)?.full_name ?? 'Guru'} — ${className(
        row.class_id
      )} / ${subjectName(row.subject_id)}`;
      if (!window.confirm(`Hapus penugasan: ${label}?`)) return null;
      const { error: err } = await supabase
        .from('teacher_assignments')
        .delete()
        .eq('id', row.id);
      if (err) return err.message;
      setNotice('Penugasan dihapus.');
      await loadAll();
      return null;
    });

  /** 4. Tambah / hapus anggota kelas. */
  const addMember = () =>
    run('add-member', async () => {
      if (!selectedClassId) return 'Pilih kelas lebih dulu.';
      if (!newStudentId) return 'Pilih siswa yang ingin didaftarkan.';
      if (memberIdsInSelected.has(newStudentId))
        return 'Siswa ini sudah menjadi anggota kelas.';
      const { error: err } = await supabase.from('class_members').insert([
        { class_id: selectedClassId, student_id: newStudentId },
      ]);
      if (err) return err.message;
      setNewStudentId('');
      setNotice('Siswa ditambahkan ke kelas.');
      await loadAll();
      return null;
    });

  const removeMember = (row: MemberRow) =>
    run(`member-${row.id}`, async () => {
      const who = peopleById.get(row.student_id)?.full_name ?? 'Siswa';
      if (!window.confirm(`Keluarkan ${who} dari kelas ini?`)) return null;
      const { error: err } = await supabase
        .from('class_members')
        .delete()
        .eq('id', row.id);
      if (err) return err.message;
      setNotice('Siswa dikeluarkan dari kelas.');
      await loadAll();
      return null;
    });

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  if (authLoading) {
    return (
      <Card>
        <LoadingBlock label="Memeriksa hak akses…" />
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader
          icon={School}
          title="Kelas & Pengguna"
          description="Halaman ini khusus administrator."
          tone="slate"
        />
        <Alert tone="amber" icon={AlertCircle} title="Akses ditolak">
          Mengelola kelas, mata pelajaran, penugasan guru, dan keanggotaan siswa hanya
          dapat dilakukan oleh administrator (RLS `admin_*_all`).
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <Card>
        <LoadingBlock label="Memuat data kelas…" />
      </Card>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        icon={School}
        title="Kelas & Pengguna"
        description="Kelola kelas, mata pelajaran, penugasan guru, dan daftar siswa anggota kelas — tanpa perlu menulis SQL."
        breadcrumb={[
          { label: 'Beranda', to: '/dashboard' },
          { label: 'Kelas & Pengguna' },
        ]}
        actions={
          <>
            <Button
              variant="secondary"
              icon={BookOpen}
              onClick={() => setShowSubjectForm((s) => !s)}
            >
              {showSubjectForm ? 'Tutup form mapel' : 'Mata pelajaran baru'}
            </Button>
            <Button icon={Plus} onClick={() => setShowClassForm((s) => !s)}>
              {showClassForm ? 'Tutup form kelas' : 'Kelas baru'}
            </Button>
          </>
        }
      />

      {error && (
        <Alert tone="red" icon={AlertCircle} title="Operasi gagal" className="mb-4">
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
          icon={School}
          label="Kelas aktif"
          value={stats.classes}
          hint={`${classes.length - stats.classes} kelas diarsipkan`}
        />
        <StatCard
          icon={BookOpen}
          label="Mata pelajaran"
          value={stats.subjects}
          tone="green"
          hint="Dipakai bank soal & ujian"
        />
        <StatCard
          icon={Users}
          label="Siswa terdaftar"
          value={stats.students}
          tone="blue"
          hint={`${people.filter((p) => p.role === 'student').length} akun siswa`}
        />
        <StatCard
          icon={UserCog}
          label="Penugasan guru"
          value={stats.assignments}
          tone="purple"
          hint="Menentukan guru bisa mengajar kelas & mapel"
        />
      </div>

      {/* ------------------------------- Form kelas ------------------------------ */}
      {showClassForm && (
        <Card className="mt-6">
          <CardHeader
            icon={Plus}
            title="Buat kelas baru"
            description="Contoh: X IPA 1, tahun ajaran 2026/2027."
            tone="brand"
            action={
              <Button
                variant="ghost"
                size="sm"
                icon={X}
                onClick={() => setShowClassForm(false)}
              >
                Tutup
              </Button>
            }
          />
          <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
            <Field label="Nama kelas" htmlFor="class-name" required>
              <TextInput
                id="class-name"
                value={classForm.name}
                onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                placeholder="X IPA 1"
              />
            </Field>
            <Field label="Tingkat" htmlFor="class-grade" hint="X, XI, XII, atau lainnya.">
              <TextInput
                id="class-grade"
                value={classForm.grade_level}
                onChange={(e) =>
                  setClassForm({ ...classForm, grade_level: e.target.value })
                }
                placeholder="X"
              />
            </Field>
            <Field label="Tahun ajaran" htmlFor="class-year" required>
              <TextInput
                id="class-year"
                value={classForm.academic_year}
                onChange={(e) =>
                  setClassForm({ ...classForm, academic_year: e.target.value })
                }
                placeholder="2026/2027"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
            <Button
              variant="secondary"
              onClick={() => setShowClassForm(false)}
            >
              Batal
            </Button>
            <Button
              icon={Plus}
              loading={busy === 'create-class'}
              onClick={createClass}
            >
              Simpan kelas
            </Button>
          </div>
        </Card>
      )}

      {/* ------------------------------ Form mapel ------------------------------- */}
      {showSubjectForm && (
        <Card className="mt-6">
          <CardHeader
            icon={BookOpen}
            title="Mata pelajaran baru"
            description="Mata pelajaran wajib ada sebelum membuat soal atau ujian."
            tone="green"
            action={
              <Button
                variant="ghost"
                size="sm"
                icon={X}
                onClick={() => setShowSubjectForm(false)}
              >
                Tutup
              </Button>
            }
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <Field label="Nama mata pelajaran" htmlFor="subject-name" required>
              <TextInput
                id="subject-name"
                value={subjectForm.name}
                onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                placeholder="Matematika"
              />
            </Field>
            <Field label="Kode" htmlFor="subject-code" hint="Opsional — misal MTK.">
              <TextInput
                id="subject-code"
                value={subjectForm.code}
                onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                placeholder="MTK"
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
            <Button variant="secondary" onClick={() => setShowSubjectForm(false)}>
              Batal
            </Button>
            <Button
              icon={Plus}
              loading={busy === 'create-subject'}
              onClick={createSubject}
            >
              Simpan mata pelajaran
            </Button>
          </div>
        </Card>
      )}

      {/* --------------------------------- Kelas -------------------------------- */}
      <Card className="mt-6">
        <CardHeader
          icon={School}
          title={`Daftar kelas (${classes.length})`}
          description="Klik nama kelas untuk mengatur anggotanya di panel bawah."
        />
        {classes.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={School}
              title="Belum ada kelas"
              description="Kelas diperlukan agar siswa bisa terdaftar dan mengerjakan ujian."
              actions={
                <Button icon={Plus} onClick={() => setShowClassForm(true)}>
                  Buat kelas pertama
                </Button>
              }
              tips={
                <ol className="list-decimal space-y-1.5 pl-5">
                  <li>Buat kelas (mis. X IPA 1) dengan tahun ajaran.</li>
                  <li>Buat mata pelajaran (mis. Matematika).</li>
                  <li>Tugaskan guru ke kelas &amp; mapel.</li>
                  <li>Tambahkan siswa sebagai anggota kelas.</li>
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
                    <Th>Kelas</Th>
                    <Th>Tingkat</Th>
                    <Th>Tahun ajaran</Th>
                    <Th align="center">Anggota</Th>
                    <Th align="center">Ujian</Th>
                    <Th align="center">Status</Th>
                    <Th align="right">Aksi</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classes.map((c) => (
                    <tr
                      key={c.id}
                      className={
                        c.id === selectedClassId ? 'bg-brand-50/50' : 'hover:bg-slate-50'
                      }
                    >
                      <Td>
                        <button
                          type="button"
                          className="text-left font-medium text-brand-700 hover:underline"
                          onClick={() => setSelectedClassId(c.id)}
                        >
                          {c.name}
                        </button>
                      </Td>
                      <Td>{c.grade_level ?? '—'}</Td>
                      <Td>{c.academic_year}</Td>
                      <Td align="center">{memberCount.get(c.id) ?? 0}</Td>
                      <Td align="center">{examCount.get(c.id) ?? 0}</Td>
                      <Td align="center">
                        {c.is_archived ? (
                          <Badge tone="slate">Diarsipkan</Badge>
                        ) : (
                          <Badge tone="green">Aktif</Badge>
                        )}
                      </Td>
                      <Td align="right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={Users}
                            onClick={() => setSelectedClassId(c.id)}
                          >
                            Anggota
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={c.is_archived ? ArchiveRestore : Archive}
                            loading={busy === `class-${c.id}`}
                            onClick={() => toggleArchive(c)}
                          >
                            {c.is_archived ? 'Aktifkan' : 'Arsipkan'}
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

      {/* ------------------------------ Anggota kelas ---------------------------- */}
      {selectedClass && (
        <Card className="mt-6">
          <CardHeader
            icon={Users}
            title={`Anggota ${selectedClass.name}`}
            description="Hanya siswa anggota kelas yang dapat mengerjakan ujian kelas ini."
            tone="blue"
            action={
              <Badge tone="blue" icon={GraduationCap}>
                {selectedMembers.length} siswa
              </Badge>
            }
          />
          <div className="grid gap-3 border-b border-slate-100 p-5 sm:grid-cols-[1fr_auto] sm:items-end sm:p-6">
            <Field
              label="Tambah siswa ke kelas"
              htmlFor="add-student"
              hint="Daftar hanya menampilkan akun berperan siswa."
            >
              <Select
                id="add-student"
                value={newStudentId}
                onChange={(e) => setNewStudentId(e.target.value)}
              >
                <option value="">Pilih siswa…</option>
                {students
                  .filter((s) => !memberIdsInSelected.has(s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} {s.email ? `— ${s.email}` : ''}
                    </option>
                  ))}
              </Select>
            </Field>
            <Button
              icon={UserPlus}
              loading={busy === 'add-member'}
              disabled={!newStudentId}
              onClick={addMember}
            >
              Tambahkan
            </Button>
          </div>

          {students.length === 0 && (
            <div className="border-b border-amber-100 bg-amber-50 px-5 py-3 text-sm text-amber-900">
              Belum ada akun siswa. Akun siswa dibuat saat siswa mendaftar lewat
              aplikasi.
            </div>
          )}

          {selectedMembers.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Users}
                title="Kelas ini belum punya anggota"
                description="Tambahkan siswa memakai pilihan di atas."
              />
            </div>
          ) : (
            <div className="p-3 sm:p-4">
              <TableWrap>
                <table className="min-w-full divide-y divide-slate-200">
                  <thead>
                    <tr>
                      <Th>Nama siswa</Th>
                      <Th>Email</Th>
                      <Th>Bergabung</Th>
                      <Th align="right">Aksi</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedMembers.map((m) => {
                      const person = peopleById.get(m.student_id);
                      return (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <Td className="font-medium text-slate-800">
                            {person?.full_name ?? 'Siswa'}
                          </Td>
                          <Td className="text-slate-500">{person?.email ?? '—'}</Td>
                          <Td className="text-slate-400">
                            {new Date(m.joined_at).toLocaleDateString('id-ID', {
                              dateStyle: 'medium',
                            })}
                          </Td>
                          <Td align="right">
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={Trash2}
                              className="text-red-600 hover:bg-red-50"
                              loading={busy === `member-${m.id}`}
                              onClick={() => removeMember(m)}
                            >
                              Keluarkan
                            </Button>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            </div>
          )}
        </Card>
      )}

      {/* ----------------------------- Mata pelajaran --------------------------- */}
      <Card className="mt-6">
        <CardHeader
          icon={BookOpen}
          title={`Mata pelajaran (${subjects.length})`}
          description="Dipakai bank soal, ujian, dan penugasan guru."
          tone="green"
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={Plus}
              onClick={() => setShowSubjectForm(true)}
            >
              Tambah
            </Button>
          }
        />
        {subjects.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={BookOpen}
              title="Belum ada mata pelajaran"
              description="Soal dan ujian tidak bisa dibuat tanpa mata pelajaran."
              actions={
                <Button icon={Plus} onClick={() => setShowSubjectForm(true)}>
                  Tambah mata pelajaran
                </Button>
              }
            />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 p-5 sm:p-6">
            {subjects.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
              >
                <BookOpen size={14} className="text-emerald-600" />
                <span className="font-medium">{s.name}</span>
                {s.code && <Badge tone="slate">{s.code}</Badge>}
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* ---------------------------- Penugasan guru ---------------------------- */}
      <Card className="mt-6">
        <CardHeader
          icon={UserCog}
          title={`Penugasan guru (${assignments.length})`}
          description="Guru hanya melihat kelas & mapel yang ditugaskan kepadanya."
          tone="purple"
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={Plus}
              onClick={() => setShowAssignForm((s) => !s)}
            >
              {showAssignForm ? 'Tutup' : 'Tugaskan guru'}
            </Button>
          }
        />

        {showAssignForm && (
          <div className="border-b border-slate-100 bg-slate-50/60 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Guru" htmlFor="assign-teacher" required>
                <Select
                  id="assign-teacher"
                  value={assignForm.teacher_id}
                  onChange={(e) =>
                    setAssignForm({ ...assignForm, teacher_id: e.target.value })
                  }
                >
                  <option value="">Pilih guru…</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} {t.role === 'admin' ? '(admin)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Kelas" htmlFor="assign-class" required>
                <Select
                  id="assign-class"
                  value={assignForm.class_id}
                  onChange={(e) =>
                    setAssignForm({ ...assignForm, class_id: e.target.value })
                  }
                >
                  <option value="">Pilih kelas…</option>
                  {activeClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Mata pelajaran" htmlFor="assign-subject" required>
                <Select
                  id="assign-subject"
                  value={assignForm.subject_id}
                  onChange={(e) =>
                    setAssignForm({ ...assignForm, subject_id: e.target.value })
                  }
                >
                  <option value="">Pilih mapel…</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                icon={Plus}
                loading={busy === 'create-assignment'}
                onClick={createAssignment}
              >
                Simpan penugasan
              </Button>
            </div>
          </div>
        )}

        {assignments.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={UserCog}
              title="Belum ada penugasan guru"
              description="Tanpa penugasan, guru tidak melihat kelas/mapel dan tidak dapat membuat ujian untuk kelas tersebut."
              actions={
                <Button icon={Plus} onClick={() => setShowAssignForm(true)}>
                  Tugaskan guru
                </Button>
              }
            />
          </div>
        ) : (
          <div className="p-3 sm:p-4">
            <TableWrap>
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr>
                    <Th>Guru</Th>
                    <Th>Kelas</Th>
                    <Th>Mata pelajaran</Th>
                    <Th align="right">Aksi</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments.map((a) => {
                    const teacher = peopleById.get(a.teacher_id);
                    return (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <Td>
                          <p className="font-medium text-slate-800">
                            {teacher?.full_name ?? 'Guru'}
                          </p>
                          <p className="text-xs text-slate-500">{teacher?.email ?? '—'}</p>
                        </Td>
                        <Td>{className(a.class_id)}</Td>
                        <Td>{subjectName(a.subject_id)}</Td>
                        <Td align="right">
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Trash2}
                            className="text-red-600 hover:bg-red-50"
                            loading={busy === `assign-${a.id}`}
                            onClick={() => deleteAssignment(a)}
                          >
                            Hapus
                          </Button>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </div>
        )}
      </Card>

      <Alert tone="blue" icon={Info} title="Urutan yang disarankan" className="mt-6">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Buat <strong>kelas</strong> (mis. X IPA 1).</li>
          <li>Buat <strong>mata pelajaran</strong> (mis. Matematika).</li>
          <li><strong>Tugaskan guru</strong> ke kelas &amp; mapel tersebut.</li>
          <li><strong>Tambahkan siswa</strong> sebagai anggota kelas.</li>
          <li>Guru membuat ujian &amp; soal, lalu menerbitkannya.</li>
        </ol>
        <p className="mt-2 flex items-center gap-2">
          <Layers size={14} />
          Siswa tidak dapat mendaftar sendiri ke kelas — keanggotaan diatur di sini.
        </p>
      </Alert>
    </div>
  );
}
