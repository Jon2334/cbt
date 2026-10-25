# VERIFICATION CHECKLIST — CBT Dashboard Guru (web)

Lokasi: D:\PROJECT_SKRIPSI\cbt-web
Build status: `npm run build` (tsc -b + vite) — 0 error; `npm run lint` — 0 error, peringatan `set-state-in-effect` (fetch-then-set, non-blocking).
Semua perubahan bersifat lokal; belum commit/push/deploy.

## A. Build & lint
| Cek | Perintah | Status |
|-----|----------|--------|
| TypeScript | `npx tsc -b --noEmit` (via `npm run build`) | LULUS (0 error) |
| Lint | `npx oxlint src` | 0 error; 4 warning `react(set-state-in-effect)` (pola fetch+setState) |
| Vite build | `npm run build` | LULUS (`dist/` terbentuk) |

## B. Dashboard routes (App.tsx)
- `/` `/dashboard`            → DashboardHome
- `/exams`                    → ExamsPage (RLS `teacher_exams_owned_or_assigned` FOR SELECT/ALL)
- `/exams/new`                → ExamForm (INSERT `exams` langsung, `created_by` dari session)
- `/exams/:id/edit`           → ExamForm (UPDATE `exams`)
- `/exams/:id/results`        → ExamResults (SELECT `results` via `teacher_results` FOR SELECT)
- `/questions`                → QuestionsPage (SELECT `questions`+join `subjects`)
- `/questions/new`            → QuestionForm (INSERT `questions`/`question_options`/`question_correct_answers` langsung)
- `/questions/:id/edit`       → QuestionForm (UPDATE `questions`, hapus+insert opsi, upsert kunci jawaban)
- `/results`                  → ExamsPage
- `/settings`                 → Stub

## C. RPC / query yang dipakai kode (dicocokkan ke migrasi)
| Komponen | Call | Sumber SQL | Keterangan |
|----------|------|-----------|------------|
| ExamsPage | `select exams.*` | `exams` | filter RLS teacher |
| ExamsPage | `rpc fn_publish_results({p_exam_id, p_publish})` | 003 | `p_exam_id UUID`, `p_publish BOOLEAN` — cocok |
| ExamForm  | `insert/update exams` | `exams` + RLS `teacher_exams_owned_or_assigned` FOR ALL | aman |
| ExamResults | `select results.* join profiles` | 002 `teacher_results` FOR SELECT | aman |
| QuestionsPage | `select questions, subjects!inner` | `questions`+`subjects` | RLS `teacher_questions...` |
| QuestionForm | `insert questions` | 001 | `created_by` dari session, bukan input |
| QuestionForm | `insert question_options` | 001 | `ON DELETE CASCADE` |
| QuestionForm | `upsert question_correct_answers` | 001 | `unique(question_id)`; siswa `denied` (002 l.314-320) |

## D. Verifikasi keamanan (tidak boleh dihack via client)
- Kunci jawaban (`question_correct_answers`) hanya SELECT/INSERT/UPDATE/DELETE oleh teacher/admin (002 l.282 FOR ALL); siswa denied (l.314-320). Form hanya menulis melalui client RLS — tidak mengekspor service-role.
- `created_by` diisi dari `useAuth().profile.id`, bukan dari input form.
- Publikasi hasil hanya via RPC `fn_publish_results` (SECURITY DEFINER), bukan update langsung ke `results`.
- Tidak ada `.env`/`.env.local` yang di-print/dibaca nilainya.

## E. Pengujian lokal yang tersedia
- TypeScript + Vite build sebagaimana di atas.
- Verifikasi runtime Supabase memerlukan akun demo (lihat BAGIAN C laporan).

## F. Yang belum diuji live (butuh akun demo)
- Login guru + role.
- CRUD ujian & publikasi via RPC.
- CRUD soal + kunci jawaban + cascade delete.
- Dapat hasil siswa (SELECT `results`).
