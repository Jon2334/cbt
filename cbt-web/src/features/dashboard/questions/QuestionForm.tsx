/**
 * Form soal pilihan ganda (buat/edit).
 * - INSERT/UPDATE `questions` (teacher_questions FOR ALL)
 * - INSERT/DELETE `question_options` (teacher_question_options FOR ALL, ON DELETE CASCADE)
 * - UPSERT `question_correct_answers` (teacher_question_correct_answers FOR ALL)
 *
 * created_by di-set dari session profile (tidak dipercaya dari input).
 * Kunci jawaban disimpan ke tabel terpisah; komponen tidak menampilkannya di
 * list (hanya dipilih saat membuat/editing oleh teacher).
 *
 * Perubahan UI/UX: field dikelompokkan (info soal vs pilihan jawaban), tiap
 * pilihan menampilkan huruf + penanda "Kunci", ada ringkasan "Jawaban benar",
 * dan tombol hapus hanya muncul bila pilihan > 2.
 */
import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import {
  AlertCircle,
  Award,
  BookOpen,
  CircleCheck,
  FileText,
  Info,
  Plus,
  Save,
  Trash2,
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
} from '../../../components/ui';

interface OptionRow {
  id?: string;
  text: string;
  is_correct: boolean;
}

interface NewQuestion {
  question_text: string;
  topic: string;
  subject_id: string;
  weight: number;
  options: OptionRow[];
  correct_option_order: number; // 1-based order index
}

const letter = (i: number) => String.fromCharCode(65 + i);

export default function QuestionForm() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState<NewQuestion>({
    question_text: '',
    topic: '',
    subject_id: '',
    weight: 1,
    options: [
      { text: '', is_correct: false },
      { text: '', is_correct: false },
    ],
    correct_option_order: 0,
  });
  const [loading, setLoading] = useState(id ? true : false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const fetchSubjects = useCallback(async () => {
    const { data } = await supabase.from('subjects').select('id,name').order('name');
    setSubjects(data ?? []);
  }, []);

  const fetchQuestion = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from('questions')
      .select('*, question_options(*)')
      .eq('id', id)
      .single();
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const q = data as {
      question_text: string;
      topic: string | null;
      subject_id: string;
      weight: number | null;
      question_options?: Array<{ id: string; option_text: string }>;
    };
    const rawOpts = q.question_options ?? [];
    const opts: OptionRow[] = rawOpts.map((o) => ({
      id: o.id,
      text: o.option_text,
      is_correct: false,
    }));

    // Ambil kunci jawaban (khusus teacher/admin) untuk ditandai di form.
    const { data: ca } = await supabase
      .from('question_correct_answers')
      .select('correct_option_id')
      .eq('question_id', id)
      .single();
    const correctId = ca?.correct_option_id;

    setForm({
      question_text: q.question_text,
      topic: q.topic ?? '',
      subject_id: q.subject_id,
      weight: q.weight ?? 1,
      options: opts.map((o) => ({ ...o, is_correct: o.id === correctId })),
      correct_option_order: opts.findIndex((o) => o.id === correctId) + 1,
    });
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void fetchSubjects();
    void fetchQuestion();
  }, [fetchSubjects, fetchQuestion]);

  const setCorrect = (order: number) =>
    setForm((f) => ({
      ...f,
      correct_option_order: order,
      options: f.options.map((o, i) => ({ ...o, is_correct: i + 1 === order })),
    }));

  const addOption = () =>
    setForm((f) => ({ ...f, options: [...f.options, { text: '', is_correct: false }] }));

  const removeOption = (idx: number) => {
    setForm((f) => {
      const next = [...f.options];
      next.splice(idx, 1);
      const newCorrect =
        f.correct_option_order === idx + 1
          ? 0
          : f.correct_option_order > idx + 1
            ? f.correct_option_order - 1
            : f.correct_option_order;
      return {
        ...f,
        options: next.map((o, i) => ({ ...o, is_correct: i + 1 === newCorrect })),
        correct_option_order: newCorrect,
      };
    });
  };

  const validate = (): string | null => {
    if (!form.subject_id) return 'Mata pelajaran wajib dipilih.';
    if (!form.question_text.trim()) return 'Teks soal wajib diisi.';
    if (form.options.length < 2) return 'Minimal 2 pilihan jawaban.';
    if (form.options.some((o) => !o.text.trim())) return 'Semua pilihan harus diisi.';
    if (!form.correct_option_order) return 'Pilih jawaban benar.';
    if (form.weight < 1) return 'Bobot harus >= 1.';
    return null;
  };

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

    const optsPayload = form.options.map((o, i) => ({
      option_text: o.text.trim(),
      option_order: i + 1,
    }));

    let qid = id;
    if (!isEdit) {
      const { data, error: err } = await supabase
        .from('questions')
        .insert([
          {
            subject_id: form.subject_id,
            topic: form.topic.trim() || null,
            question_text: form.question_text.trim(),
            weight: form.weight,
            created_by: profile.id,
          },
        ])
        .select('id')
        .single();
      if (err) {
        setError(err.message);
        setSaving(false);
        return;
      }
      qid = data.id;
    } else {
      const { error: err } = await supabase
        .from('questions')
        .update({
          subject_id: form.subject_id,
          topic: form.topic.trim() || null,
          question_text: form.question_text.trim(),
          weight: form.weight,
        })
        .eq('id', qid);
      if (err) {
        setError(err.message);
        setSaving(false);
        return;
      }
      // hapus opsi lama (kunci jawaban ikut terhapus karena ON DELETE CASCADE)
      await supabase.from('question_options').delete().eq('question_id', qid);
    }

    if (!qid) {
      setError('ID soal tidak tersedia.');
      setSaving(false);
      return;
    }

    const optsWithId = optsPayload.map((o) => ({ ...o, question_id: qid }));
    const { data: insertedOpts, error: errOpts } = await supabase
      .from('question_options')
      .insert(optsWithId)
      .select('id,option_order');
    if (errOpts) {
      setError(errOpts.message);
      setSaving(false);
      return;
    }

    // upsert kunci jawaban
    const correctOrder = form.correct_option_order;
    const correctOpt = insertedOpts?.find(
      (o: { option_order: number }) => o.option_order === correctOrder
    );
    if (!correctOpt) {
      setError('Opsi jawaban benar tidak ditemukan.');
      setSaving(false);
      return;
    }
    const { error: errCa } = await supabase.from('question_correct_answers').upsert(
      [
        {
          question_id: qid,
          correct_option_id: correctOpt.id,
        },
      ],
      { onConflict: 'question_id', ignoreDuplicates: false }
    );
    setSaving(false);
    if (errCa) setError(errCa.message);
    else navigate('/questions');
  };

  const showInvalid = (v: boolean) => submitted && v;

  if (loading) {
    return (
      <Card>
        <LoadingBlock label="Memuat soal…" />
      </Card>
    );
  }

  const correctLetter = form.correct_option_order
    ? letter(form.correct_option_order - 1)
    : '—';

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        icon={FileText}
        title={isEdit ? 'Edit Soal' : 'Tulis Soal Baru'}
        description="Soal pilihan ganda dengan satu jawaban benar. Soal ini dapat dipakai di banyak ujian."
        breadcrumb={[
          { label: 'Beranda', to: '/dashboard' },
          { label: 'Bank Soal', to: '/questions' },
          { label: isEdit ? 'Edit' : 'Baru' },
        ]}
        actions={
          <LinkButton to="/questions" variant="secondary" icon={X}>
            Batal
          </LinkButton>
        }
      />

      {error && (
        <Alert tone="red" icon={AlertCircle} title="Soal belum bisa disimpan" className="mb-4">
          {error}
        </Alert>
      )}

      {subjects.length === 0 && (
        <Alert tone="amber" icon={AlertCircle} title="Belum ada mata pelajaran" className="mb-4">
          Soal wajib terhubung ke mata pelajaran. Minta administrator menambahkannya
          lebih dulu.
        </Alert>
      )}

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Card>
          <CardHeader
            icon={BookOpen}
            title="Informasi soal"
            description="Mapel & topik memudahkan pencarian kembali di bank soal."
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
                onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
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
              label="Topik / bab"
              htmlFor="topic"
              hint="Opsional — contoh: Persamaan Kuadrat."
            >
              <TextInput
                id="topic"
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
                placeholder="opsional"
              />
            </Field>

            <Field
              label="Pertanyaan"
              htmlFor="question_text"
              required
              className="sm:col-span-2"
              error={showInvalid(!form.question_text.trim()) ? 'Teks soal wajib diisi.' : undefined}
            >
              <Textarea
                id="question_text"
                rows={4}
                value={form.question_text}
                invalid={showInvalid(!form.question_text.trim())}
                onChange={(e) => setForm({ ...form, question_text: e.target.value })}
                placeholder="Tulis pertanyaan di sini…"
              />
            </Field>

            <Field
              label="Bobot soal"
              htmlFor="weight"
              error={showInvalid(form.weight < 1) ? 'Bobot minimal 1.' : undefined}
              hint="Soal berbobot lebih besar menyumbang nilai lebih tinggi."
            >
              <TextInput
                id="weight"
                type="number"
                min={1}
                value={form.weight}
                invalid={showInvalid(form.weight < 1)}
                onChange={(e) =>
                  setForm({ ...form, weight: Number(e.target.value) || 1 })
                }
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            icon={CircleCheck}
            title="Pilihan jawaban"
            description="Minimal dua pilihan. Tandai satu pilihan sebagai jawaban benar."
            tone="green"
            action={
              <Badge tone="green" icon={Award}>
                Jawaban benar: {correctLetter}
              </Badge>
            }
          />
          <div className="space-y-3 p-5 sm:p-6">
            {form.options.map((o, i) => {
              const empty = showInvalid(!o.text.trim());
              return (
                <div
                  key={i}
                  className={
                    'flex flex-wrap items-center gap-2 rounded-lg border p-2 transition-colors ' +
                    (o.is_correct
                      ? 'border-emerald-300 bg-emerald-50/60'
                      : 'border-slate-200 bg-white')
                  }
                >
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600"
                    aria-hidden="true"
                  >
                    {letter(i)}
                  </span>
                  <div className="min-w-[180px] flex-1">
                    <label className="sr-only" htmlFor={`option-${i}`}>
                      Pilihan {letter(i)}
                    </label>
                    <TextInput
                      id={`option-${i}`}
                      value={o.text}
                      invalid={empty}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          options: f.options.map((x, j) =>
                            j === i ? { ...x, text: e.target.value } : x
                          ),
                        }))
                      }
                      placeholder={`Teks pilihan ${letter(i)}`}
                    />
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant={o.is_correct ? 'primary' : 'secondary'}
                    icon={CircleCheck}
                    onClick={() => setCorrect(i + 1)}
                    aria-pressed={o.is_correct}
                  >
                    {o.is_correct ? 'Kunci' : 'Jadikan kunci'}
                  </Button>

                  {form.options.length > 2 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => removeOption(i)}
                      aria-label={`Hapus pilihan ${letter(i)}`}
                    >
                      Hapus
                    </Button>
                  )}
                </div>
              );
            })}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={Plus}
                onClick={addOption}
              >
                Tambah pilihan
              </Button>
              {showInvalid(!form.correct_option_order) && (
                <p className="hint-error mt-0">Pilih salah satu jawaban benar.</p>
              )}
            </div>
          </div>
        </Card>

        <Alert tone="blue" icon={Info} title="Tentang kunci jawaban">
          Kunci jawaban hanya tersimpan di server dan tidak pernah dikirim ke aplikasi
          siswa. Menyimpan perubahan akan menulis ulang seluruh pilihan jawaban,
          termasuk kuncinya.
        </Alert>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link to="/questions" className="btn btn-ghost">
            Batal
          </Link>
          <Button type="submit" loading={saving} icon={Save}>
            {isEdit ? 'Simpan perubahan' : 'Simpan soal'}
          </Button>
        </div>
      </form>
    </div>
  );
}
