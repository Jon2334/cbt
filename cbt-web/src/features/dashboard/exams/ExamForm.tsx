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
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import type { Exam, Subject, ClassRecord } from '../../../types/cbt';
import { Save, X } from 'lucide-react';

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
    loadDependencies();
    loadExam();
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

  const onChange = (k: keyof FormValues, v: any) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      status: 'draft' as const,
    };

    let err: any;
    if (isEdit && id) {
      const r = await supabase.from('exams').update(payload).eq('id', id);
      err = r.error;
    } else {
      const r = await supabase.from('exams').insert([payload]);
      err = r.error;
    }
    setSaving(false);
    if (err) {
      setError(err.message);
    } else {
      alert(isEdit ? 'Ujian diperbarui.' : 'Ujian dibuat.');
      navigate('/exams');
    }
  };

  if (loading) return <div className="loading">Memuat…</div>;

  return (
    <div className="p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {isEdit ? 'Edit Ujian' : 'Buat Ujian Baru'}
        </h1>
        <button
          onClick={() => navigate('/exams')}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"
        >
          <X size={16} /> Batal
        </button>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2"
      >
        <div className="md:col-span-2">
          <label className="block text-sm font-medium">Judul ujian *</label>
          <input
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.title}
            onChange={(e) => onChange('title', e.target.value)}
            placeholder="Contoh: Ulangan Tengah Semester Matematika"
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium">Deskripsi</label>
          <textarea
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.description}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder="Deskripsi singkat (opsional)"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Mata pelajaran *</label>
          <select
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.subject_id}
            onChange={(e) => onChange('subject_id', e.target.value)}
            required
          >
            <option value="">Pilih mata pelajaran</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Kelas *</label>
          <select
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.class_id}
            onChange={(e) => onChange('class_id', e.target.value)}
            required
          >
            <option value="">Pilih kelas</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.grade_level ?? '-'})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Mulai *</label>
          <input
            type="datetime-local"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.open_at}
            onChange={(e) => onChange('open_at', e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Tutup *</label>
          <input
            type="datetime-local"
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.close_at}
            onChange={(e) => onChange('close_at', e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Durasi (menit) *</label>
          <input
            type="number"
            min={1}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.duration_minutes}
            onChange={(e) =>
              onChange('duration_minutes', Number(e.target.value))
            }
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Kesempatan ulang</label>
          <input
            type="number"
            min={1}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.max_attempts}
            onChange={(e) => onChange('max_attempts', Number(e.target.value))}
          />
        </div>

        <div className="flex items-end gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={form.shuffle_questions}
              onChange={(e) =>
                onChange('shuffle_questions', e.target.checked)
              }
            />
            Acak soal
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={form.shuffle_options}
              onChange={(e) =>
                onChange('shuffle_options', e.target.checked)
              }
            />
            Acak pilihan
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={form.show_results_after}
              onChange={(e) =>
                onChange('show_results_after', e.target.checked)
              }
            />
            Tampilkan hasil setelah selesai
          </label>
        </div>

        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? (
              <>
                <svg
                  className="-ml-1 h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <span>{isEdit ? 'Menyimpan…' : 'Membuat…'}</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{isEdit ? 'Perbarui' : 'Simpan sebagai draft'}</span>
              </>
            )}
          </button>
        </div>
      </form>
      <p className="mt-4 text-xs text-slate-500">
        * wajib diisi. Ujian disimpan sebagai draft; publikasi dilakukan di
        halaman Kelola Ujian lalu tambahkan soal melalui Bank Soal.
      </p>
    </div>
  );
}
