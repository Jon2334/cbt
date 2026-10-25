/**
 * Form soal pilihan ganda (buat/edit).
 * - INSERT/UPDATE `questions` (teacher_questions FOR ALL)
 * - INSERT/DELETE `question_options` (teacher_question_options FOR ALL, ON DELETE CASCADE)
 * - UPSERT `question_correct_answers` (teacher_question_correct_answers FOR ALL)
 *
 * created_by di-set dari session profile (tidak dipercaya dari input).
 * Kunci jawaban disimpan ke tabel terpisah; komponen tidak menampilkannya di
 * list (hanya dipilih saat membuat/editing oleh teacher).
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/auth';
import { Save, X, Plus, Trash2 } from 'lucide-react';

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
    if (err) { setError(err.message); setLoading(false); return; }

    const q = data as any;
    const opts: OptionRow[] = (q.question_options ?? []).map((o: any) => ({
      id: o.id,
      text: o.option_text,
      is_correct: false,
    }));
    // load correct answer (teacher-only)
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
    fetchSubjects();
    fetchQuestion();
  }, [fetchSubjects, fetchQuestion]);

  const setCorrect = (order: number) =>
    setForm((f) => ({ ...f, correct_option_order: order, options: f.options.map((o, i) => ({ ...o, is_correct: i + 1 === order })) }));

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
        options: next,
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    if (!profile?.id) { setError('Sesi tidak tersedia.'); return; }
    setSaving(true); setError(null);

    const optsPayload = form.options.map((o, i) => ({
      question_id: id ?? (undefined as any),
      option_text: o.text.trim(),
      option_order: i + 1,
    }));

    let qid = id;
    if (!isEdit) {
      const { data, error: err } = await supabase.from('questions').insert([{
        subject_id: form.subject_id,
        topic: form.topic.trim() || null,
        question_text: form.question_text.trim(),
        weight: form.weight,
        created_by: profile.id,
      }]).select('id').single();
      if (err) { setError(err.message); setSaving(false); return; }
      qid = data.id;
    } else {
      const { error: err } = await supabase.from('questions').update({
        subject_id: form.subject_id,
        topic: form.topic.trim() || null,
        question_text: form.question_text.trim(),
        weight: form.weight,
      }).eq('id', qid);
      if (err) { setError(err.message); setSaving(false); return; }
      // hapus opsi lama (correct answer ikut cascade delete)
      await supabase.from('question_options').delete().eq('question_id', qid);
    }

    // insert options
    const optsWithId = optsPayload.map((o) => ({ ...o, question_id: qid }));
    const { data: insertedOpts, error: errOpts } = await supabase
      .from('question_options')
      .insert(optsWithId)
      .select('id,option_order');
    if (errOpts) { setError(errOpts.message); setSaving(false); return; }

    // upsert kunci jawaban
    const correctOrder = form.correct_option_order;
    const correctOpt = insertedOpts?.find((o: any) => o.option_order === correctOrder);
    if (!correctOpt) { setError('Opsi jawaban benar tidak ditemukan.'); setSaving(false); return; }
    const { error: errCa } = await supabase.from('question_correct_answers').upsert([{
      question_id: qid as string,
      correct_option_id: correctOpt.id,
    }], { onConflict: 'question_id', ignoreDuplicates: false });
    setSaving(false);
    if (errCa) setError(errCa.message);
    else { alert(isEdit ? 'Soal diperbarui.' : 'Soal dibuat.'); navigate('/questions'); }
  };

  if (loading) return <div className="loading">Memuat…</div>;

  return (
    <div className="p-6 max-w-3xl">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">{isEdit ? 'Edit Soal' : 'Soal Baru'}</h1>
        <button onClick={() => navigate('/questions')} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"><X size={16} /> Batal</button>
      </header>

      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium">Mata pelajaran *</label>
          <select className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.subject_id} onChange={(e) => setForm({...form, subject_id: e.target.value})} required>
            <option value="">Pilih mata pelajaran</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Topik / Bab</label>
          <input className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.topic} onChange={(e) => setForm({...form, topic: e.target.value})} placeholder="opsional" />
        </div>

        <div>
          <label className="block text-sm font-medium">Pertanyaan *</label>
          <textarea className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={3}
            value={form.question_text} onChange={(e) => setForm({...form, question_text: e.target.value})}
            placeholder="Teks soal..." required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Bobot</label>
            <input type="number" min={1} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.weight} onChange={(e) => setForm({...form, weight: Number(e.target.value) || 1})} />
          </div>
          <label className="flex items-end gap-2 text-sm">
            <span className="text-slate-500">Jawaban benar: {form.correct_option_order || '-'}</span>
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Pilihan Jawaban *</span>
            <button type="button" onClick={addOption} className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"><Plus size={14} /> Tambah</button>
          </div>
          {form.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 text-right text-sm font-medium">{String.fromCharCode(65 + i)}</span>
              <input className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={o.text} onChange={(e) => setForm({...form, options: form.options.map((x, j)=>(j===i?{...x, text:e.target.value}:x))})} />
              <input type="radio" name="correct" checked={o.is_correct} onChange={() => setCorrect(i + 1)} className="h-4 w-4 text-indigo-600" />
              {form.options.length > 2 && (
                <button type="button" onClick={() => removeOption(i)} className="rounded p-1 text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
            <Save size={16} />{isEdit ? 'Perbarui' : 'Simpan'}</button>
        </div>
      </form>
    </div>
  );
}
