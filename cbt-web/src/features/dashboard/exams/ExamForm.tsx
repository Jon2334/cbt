/**
 * Form pembuatan / pengeditan ujian (draft). Dipakai untuk flow:
 *  guru membuat ujian -> menambahkan soal -> menentukan jadwal -> menetapkan
 *  kelas -> memublikasikan. Draft pertama disimpan dengan status 'draft' agar
 *  guru dapat melanjutkan menambahkan soal/pilihan jawaban/kunci (via halaman
 *  bank soal). Publish status='published' dilakukan di ExamsPage.
 *
 * INSERT/UPDATE langsung ke tabel `exams`; RLS `teacher_exams_owned_or_assigned`
 * (FOR ALL) melindungi — hanya guru pembuat yang dapat menulis. Kolom
 * `created_by` di-set ke id profil otorisasi (bukan dipercaya dari input).
 *
 * Catatan keamanan & integritas:
 * - `status` hanya dikirim saat INSERT. Saat UPDATE tidak dikirim, supaya
 *   menyunting ujian yang sudah terbit tidak diam-diam menurunkannya ke draft.
 * - Setelah ujian dibuat, pengguna langsung diarahkan ke halaman penyusunan soal
 *   (langkah berikutnya) alih-alih kembali ke daftar.
 */
import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import type { Exam, Subject, ClassRecord } from '../../../types/cbt';
import {
  AlertCircle,
  CalendarClock,
  Clock,
  Info,
  Layers,
  Save,
  Target,
  X,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  LinkButton,
  LoadingBlock,
  PageHeader,
  Select,
  TextInput,
  Textarea,
  Toggle,
} from '../../../components/ui';

type FormValues = {
  title: string;
  description: string;
  subject_id: string;
  class_id: string;
  open_at: string;
  close_at: string;
  duration_minutes: number;
  max_attempts: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  show_results_after: boolean;
};

const nowISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString();
};

const toDateTimeLocal = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const fromDateTimeLocal = (v: string) =>
  v ? new Date(v).toISOString() : nowISO();

export default function ExamForm() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [form, setForm] = useState<FormValues>({
    title: '',
    description: '',
    subject_id: '',
    class_id: '',
    open_at: toDateTimeLocal(nowISO()),
    close_at: '',
    duration_minutes: 60,
    max_attempts: 1,
    shuffle_questions: false,
    shuffle_options: false,
    show_results_after: true,
  });
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(id ? true : false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const loadDependencies = useCallback(async () => {
    const [{ data: s }, { data: c }] = await Promise.all([
      supabase.from('subjects').select('*').order('name'),
      supabase.from('classes').select('*').order('name'),
    ]);
    setSubjects(s ?? []);
    setClasses((c ?? []).filter((x: ClassRecord) => !x.is_archived));
  }, []);

  const loadExam = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('exams')
      .select('*')
      .eq('id', id)
      .single();
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const e = data as Exam;
    setForm({
      title: e.title,
      description: e.description ?? '',
      subject_id: e.subject_id,
      class_id: e.class_id,
      open_at: toDateTimeLocal(e.open_at),
      close_at: toDateTimeLocal(e.close_at),
      duration_minutes: e.duration_minutes,
      max_attempts: e.max_attempts,
      shuffle_questions: e.shuffle_questions,
      shuffle_options: e.shuffle_options,
      show_results_after: e.show_results_after,
    });
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void loadDependencies();
    void loadExam();
  }, [loadDependencies, loadExam]);

  const validate = (): string | null => {
    if (!form.title.trim()) return 'Judul ujian wajib diisi.';
    if (!form.subject_id) return 'Mata pelajaran wajib dipilih.';
    if (!form.class_id) return 'Kelas wajib dipilih.';
    if (!form.open_at || !form.close_at) return 'Jadwal wajib diisi.';
    if (new Date(form.close_at) <= new Date(form.open_at))
      return 'Tutup harus setelah Mulai.';
    if (form.duration_minutes <= 0) return 'Durasi harus lebih dari 0.';
    if (form.max_attempts < 1) return 'Minimal 1 kesempatan.';
    return null;
  };

  const onChange = <K extends keyof FormValues>(k: K, v: FormValues[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    if (!profile?.id) {
      setError('Sesi tidak tersedia.');
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      subject_id: form.subject_id,
      class_id: form.class_id,
      created_by: profile.id,
      open_at: fromDateTimeLocal(form.open_at),
      close_at: fromDateTimeLocal(form.close_at),
      duration_minutes: form.duration_minutes,
      max_attempts: form.max_attempts,
      shuffle_questions: form.shuffle_questions,
      shuffle_options: form.shuffle_options,
      show_results_after: form.show_results_after,
      ...(isEdit ? {} : { status: 'draft' as const }),
    };

    if (isEdit && id) {
      const { error: err } = await supabase.from('exams').update(payload).eq('id', id);
      setSaving(false);
      if (err) setError(err.message);
      else navigate('/exams');
      return;
    }

    // INSERT mengembalikan id agar pengguna langsung dibawa ke langkah
    // berikutnya: menambahkan soal ke ujian ini.
    const { data, error: err } = await supabase
      .from('exams')
      .insert([payload])
      .select('id')
      .single();
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    const newId = (data as { id: string } | null)?.id;
    navigate(newId ? `/exams/${newId}/questions` : '/exams');
  };

  const showInvalid = (v: boolean) => submitted && v;
  const maxClose = form.open_at;

  if (loading) {
    return (
      <Card>
        <LoadingBlock label="Memuat data ujian…" />
      </Card>
    );
  }

  const missingMaster = subjects.length === 0 || classes.length === 0;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        icon={CalendarClock}
        title={isEdit ? 'Edit Ujian' : 'Buat Ujian Baru'}
        description="Tentukan peserta, jadwal, dan aturan pengerjaan. Soal ditambahkan setelah ujian disimpan."
        breadcrumb={[
          { label: 'Beranda', to: '/dashboard' },
          { label: 'Ujian', to: '/exams' },
          { label: isEdit ? 'Edit' : 'Baru' },
        ]}
        actions={
          <LinkButton to="/exams" variant="secondary" icon={X}>
            Batal
          </LinkButton>
        }
      />

      {error && (
        <Alert tone="red" icon={AlertCircle} title="Data belum bisa disimpan" className="mb-4">
          {error}
        </Alert>
      )}

      {missingMaster && (
        <Alert tone="amber" icon={Info} title="Data dasar belum lengkap" className="mb-4">
          {subjects.length === 0 && <p>Belum ada mata pelajaran.</p>}
          {classes.length === 0 && <p>Belum ada kelas aktif.</p>}
          <p className="mt-1">
            Mata pelajaran dan kelas hanya bisa dibuat oleh administrator (menu
            Pengaturan &amp; Peran → panduan SQL).
          </p>
        </Alert>
      )}

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Card>
          <CardHeader
            icon={Layers}
            title="Informasi dasar"
            description="Nama ujian dilihat siswa pada aplikasi."
          />
          <div className="space-y-4 p-5 sm:p-6">
            <Field
              label="Judul ujian"
              htmlFor="title"
              required
              error={showInvalid(!form.title.trim()) ? 'Judul wajib diisi.' : undefined}
              hint="Contoh: Ulangan Tengah Semester Matematika."
            >
              <TextInput
                id="title"
                value={form.title}
                invalid={showInvalid(!form.title.trim())}
                onChange={(e) => onChange('title', e.target.value)}
                placeholder="Ulangan Tengah Semester Matematika"
              />
            </Field>

            <Field
              label="Deskripsi"
              htmlFor="description"
              hint="Opsional — tampil sebagai keterangan ujian."
            >
              <Textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(e) => onChange('description', e.target.value)}
                placeholder="Deskripsi singkat (opsional)"
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            icon={Target}
            title="Peserta"
            description="Menentukan soal mana yang boleh dipakai dan siapa yang bisa mengerjakan."
            tone="green"
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <Field
              label="Mata pelajaran"
              htmlFor="subject_id"
              required
              error={showInvalid(!form.subject_id) ? 'Pilih mata pelajaran.' : undefined}
            >
              <Select
                id="subject_id"
                value={form.subject_id}
                invalid={showInvalid(!form.subject_id)}
                onChange={(e) => onChange('subject_id', e.target.value)}
              >
                <option value="">Pilih mata pelajaran</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Kelas"
              htmlFor="class_id"
              required
              error={showInvalid(!form.class_id) ? 'Pilih kelas.' : undefined}
              hint="Hanya siswa anggota kelas ini yang dapat mengerjakan."
            >
              <Select
                id="class_id"
                value={form.class_id}
                invalid={showInvalid(!form.class_id)}
                onChange={(e) => onChange('class_id', e.target.value)}
              >
                <option value="">Pilih kelas</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.grade_level ?? '-'})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            icon={Clock}
            title="Jadwal & durasi"
            description="Waktu mengikuti zona waktu perangkat Anda."
            tone="amber"
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <Field
              label="Dibuka"
              htmlFor="open_at"
              required
              error={showInvalid(!form.open_at) ? 'Waktu buka wajib diisi.' : undefined}
            >
              <TextInput
                id="open_at"
                type="datetime-local"
                value={form.open_at}
                invalid={showInvalid(!form.open_at)}
                onChange={(e) => onChange('open_at', e.target.value)}
              />
            </Field>

            <Field
              label="Ditutup"
              htmlFor="close_at"
              required
              error={
                showInvalid(!form.close_at)
                  ? 'Waktu tutup wajib diisi.'
                  : showInvalid(
                        Boolean(form.open_at && form.close_at) &&
                          new Date(form.close_at) <= new Date(form.open_at)
                      )
                    ? 'Waktu tutup harus setelah waktu buka.'
                    : undefined
              }
              hint="Setelah waktu ini siswa tidak dapat mulai mengerjakan."
            >
              <TextInput
                id="close_at"
                type="datetime-local"
                min={maxClose}
                value={form.close_at}
                invalid={
                  showInvalid(
                    !form.close_at ||
                      (Boolean(form.open_at && form.close_at) &&
                        new Date(form.close_at) <= new Date(form.open_at))
                  )
                }
                onChange={(e) => onChange('close_at', e.target.value)}
              />
            </Field>

            <Field
              label="Durasi pengerjaan (menit)"
              htmlFor="duration_minutes"
              required
              error={showInvalid(form.duration_minutes <= 0) ? 'Durasi minimal 1 menit.' : undefined}
              hint="Dihitung sejak siswa mulai mengerjakan."
            >
              <TextInput
                id="duration_minutes"
                type="number"
                min={1}
                value={form.duration_minutes}
                invalid={showInvalid(form.duration_minutes <= 0)}
                onChange={(e) => onChange('duration_minutes', Number(e.target.value))}
              />
            </Field>

            <Field
              label="Kesempatan mengerjakan"
              htmlFor="max_attempts"
              error={showInvalid(form.max_attempts < 1) ? 'Minimal 1 kesempatan.' : undefined}
              hint="Jumlah percobaan yang diizinkan untuk tiap siswa."
            >
              <TextInput
                id="max_attempts"
                type="number"
                min={1}
                value={form.max_attempts}
                invalid={showInvalid(form.max_attempts < 1)}
                onChange={(e) => onChange('max_attempts', Number(e.target.value))}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            icon={Layers}
            title="Opsi pengerjaan"
            description="Atur pengacakan dan tampilan nilai untuk siswa."
            tone="purple"
          />
          <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
            <Toggle
              id="shuffle_questions"
              checked={form.shuffle_questions}
              onChange={(v) => onChange('shuffle_questions', v)}
              label="Acak urutan soal"
              hint="Setiap siswa mendapat urutan berbeda."
            />
            <Toggle
              id="shuffle_options"
              checked={form.shuffle_options}
              onChange={(v) => onChange('shuffle_options', v)}
              label="Acak pilihan jawaban"
              hint="Posisi A/B/C/D tidak tetap."
            />
            <Toggle
              id="show_results_after"
              checked={form.show_results_after}
              onChange={(v) => onChange('show_results_after', v)}
              label="Tampilkan hasil setelah selesai"
              hint="Siswa melihat nilainya bila sudah dipublikasikan."
            />
          </div>
        </Card>

        <Alert tone="blue" icon={Info} title="Alur penyusunan ujian">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Simpan ujian (status awal: <strong>draft</strong>).</li>
            <li>Tambahkan soal dari bank soal pada halaman berikutnya.</li>
            <li>Terbitkan ujian di halaman <strong>Ujian</strong> agar siswa bisa mengerjakan.</li>
          </ol>
        </Alert>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            to="/exams"
            className="btn btn-ghost"
            aria-label="Batal dan kembali ke daftar ujian"
          >
            Batal
          </Link>
          <Button
            type="submit"
            loading={saving}
            icon={Save}
            disabled={missingMaster}
          >
            {isEdit ? 'Simpan perubahan' : 'Simpan & tambah soal'}
          </Button>
          {subjects.length > 0 && classes.length > 0 && (
            <Badge tone="slate">Draft tersimpan otomatis saat disimpan</Badge>
          )}
        </div>
      </form>
    </div>
  );
}
