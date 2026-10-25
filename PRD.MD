# PRODUCT REQUIREMENTS DOCUMENT (PRD)
# SISTEM COMPUTER BASED TEST (CBT) BERBASIS ANDROID DAN WEB

**Versi:** 2.0  
**Status:** Draft kebutuhan produk  
**Platform:** Android dan Web  
**Target implementasi:** Sekolah  
**Pengguna:** Administrator, guru, dan siswa

---

## 1. Ringkasan Produk

Sistem Computer Based Test (CBT) adalah platform ujian digital yang terdiri atas dua aplikasi terpisah, yaitu aplikasi Android untuk siswa dan dashboard web untuk guru serta administrator.

Dashboard web digunakan guru untuk mengelola kelas, membuat bank soal, menyusun ujian, mengatur jadwal, memantau pengerjaan, dan melihat hasil ujian.

Aplikasi Android digunakan siswa untuk login, melihat ujian yang tersedia, mengerjakan soal dengan batas waktu, mengirim jawaban, serta melihat nilai sesuai kebijakan sekolah.

Kedua aplikasi terhubung dengan satu backend dan database online. Data pengguna, kelas, ujian, jawaban, serta hasil ujian dikelola secara terpusat.

## 2. Latar Belakang

Pelaksanaan ujian secara manual memerlukan proses distribusi soal, pengumpulan jawaban, koreksi, dan rekapitulasi nilai.

Sistem CBT dikembangkan untuk mendigitalisasi proses ujian agar pengelolaan soal lebih terstruktur, koreksi pilihan ganda lebih cepat, dan hasil ujian lebih mudah diakses oleh guru.

Pemisahan aplikasi berdasarkan perangkat dan peran diharapkan membuat pengalaman penggunaan lebih sesuai: guru menggunakan komputer untuk administrasi, sedangkan siswa mengerjakan ujian melalui smartphone Android.

## 3. Tujuan Produk

1. Menyediakan sistem ujian digital untuk sekolah.
2. Memudahkan guru mengelola soal dan pelaksanaan ujian.
3. Memungkinkan siswa mengikuti ujian menggunakan aplikasi Android.
4. Menghitung nilai pilihan ganda secara otomatis.
5. Menyediakan rekap hasil ujian untuk guru.
6. Menyimpan data ujian dalam satu database online.
7. Menjaga keamanan soal, jawaban, dan hasil ujian.
8. Menyediakan sistem yang dapat dikembangkan dan dipelihara secara bertahap.

## 4. Arsitektur Produk

Produk terdiri atas tiga komponen utama.

### 4.1 Project A — Aplikasi Android Siswa

Nama direktori yang disarankan: `cbt-android`

Teknologi:
- React Native.
- Expo.
- TypeScript.
- Expo Router.
- Supabase client.

Fungsi utama:
- Login siswa.
- Melihat daftar ujian.
- Membaca petunjuk ujian.
- Mengerjakan soal.
- Menampilkan timer.
- Menyimpan jawaban.
- Mengirim ujian.
- Melihat hasil dan riwayat ujian sesuai izin.

### 4.2 Project B — Dashboard Web Guru dan Administrator

Nama direktori yang disarankan: `cbt-web`

Teknologi:
- React.
- Vite.
- TypeScript.
- React Router.
- Supabase client.
- Pustaka antarmuka dan tabel yang sesuai kebutuhan.

Fungsi utama:
- Login guru dan administrator.
- Dashboard ringkasan.
- Manajemen pengguna dan kelas.
- Manajemen mata pelajaran.
- Manajemen bank soal.
- Pembuatan dan pengaturan ujian.
- Pemantauan ujian.
- Rekap dan ekspor nilai.

### 4.3 Backend dan Database Bersama

Teknologi:
- Supabase Auth untuk autentikasi.
- PostgreSQL untuk database.
- Row Level Security (RLS) untuk membatasi akses data.
- Database functions atau backend tepercaya untuk proses sensitif.

Kedua project menggunakan backend yang sama. Namun, kredensial, hak akses, dan fungsi masing-masing aplikasi tetap dibatasi berdasarkan peran pengguna.

**Ketentuan keamanan:** anon/publishable key dapat digunakan pada aplikasi klien sesuai konfigurasi Supabase, tetapi service-role key dan rahasia server tidak boleh dimasukkan ke aplikasi Android atau kode frontend web.

## 5. Target Pengguna dan Hak Akses

### 5.1 Administrator

Administrator bertanggung jawab atas pengelolaan sistem.

Hak akses:
- Mengelola akun guru dan siswa.
- Membuat dan mengelola kelas.
- Mengelola mata pelajaran.
- Menghubungkan siswa ke kelas.
- Melihat dan mengelola data ujian sesuai kewenangannya.
- Mengelola konfigurasi sistem.

### 5.2 Guru

Guru bertanggung jawab atas pembuatan dan pelaksanaan ujian.

Hak akses:
- Login ke dashboard web.
- Melihat kelas yang menjadi tanggung jawabnya.
- Mengelola bank soal yang dimiliki atau diizinkan.
- Membuat, mengubah, menerbitkan, dan menjadwalkan ujian.
- Melihat peserta dan status pengerjaan.
- Melihat hasil ujian dan rekap nilai.
- Membuka hasil ujian untuk siswa sesuai kebijakan.

Guru tidak boleh mengakses data yang berada di luar kewenangannya.

### 5.3 Siswa

Siswa menggunakan aplikasi Android untuk mengikuti ujian.

Hak akses:
- Login ke aplikasi.
- Melihat ujian yang tersedia bagi kelasnya.
- Melihat petunjuk ujian.
- Memulai ujian pada waktu yang diizinkan.
- Menjawab dan meninjau soal.
- Mengirim jawaban.
- Melihat status pengumpulan.
- Melihat nilai sendiri setelah hasil diumumkan.

Siswa tidak boleh membuat ujian, mengubah soal, membaca kunci jawaban, mengubah nilai, atau mengakses jawaban siswa lain.

## 6. Kebutuhan Fungsional Dashboard Web

### FR-WEB-01: Autentikasi

- Guru dan administrator dapat login.
- Sistem memvalidasi akun dan status pengguna.
- Sistem mengarahkan pengguna ke dashboard berdasarkan peran.
- Pengguna dapat logout.
- Halaman internal tidak dapat diakses tanpa autentikasi dan izin yang sesuai.

### FR-WEB-02: Dashboard

Dashboard menampilkan informasi sesuai peran, misalnya:
- Jumlah kelas yang dikelola.
- Jumlah siswa yang terdaftar.
- Jumlah ujian aktif, terjadwal, dan selesai.
- Ringkasan hasil ujian.
- Aktivitas ujian terbaru.

Informasi hanya boleh mencakup data yang dapat diakses pengguna.

### FR-WEB-03: Manajemen Pengguna

- Administrator dapat menambahkan dan menonaktifkan akun.
- Administrator dapat mengatur peran dan kelas pengguna.
- Sistem menyediakan pencarian dan filter pengguna.
- Sistem memvalidasi data wajib dan mencegah akun duplikat sesuai aturan identitas.
- Perubahan peran hanya dapat dilakukan oleh pihak berwenang.

### FR-WEB-04: Manajemen Kelas dan Mata Pelajaran

- Administrator dapat membuat, mengubah, dan mengarsipkan kelas.
- Administrator dapat membuat dan mengelola data mata pelajaran.
- Siswa dapat dihubungkan dengan kelas.
- Guru dapat ditugaskan ke kelas atau mata pelajaran sesuai struktur sekolah.

### FR-WEB-05: Bank Soal

- Guru dapat menambah, melihat, mengubah, dan menghapus soal.
- Jenis soal pada MVP adalah pilihan ganda dengan satu jawaban benar.
- Soal berisi pertanyaan, pilihan jawaban, kunci jawaban, dan bobot nilai.
- Soal dapat dikelompokkan berdasarkan mata pelajaran atau topik.
- Guru dapat melakukan pratinjau soal.
- Soal yang sudah digunakan pada ujian yang memiliki hasil harus dikelola dengan aturan yang menjaga integritas riwayat ujian.
- Kunci jawaban tidak disediakan melalui endpoint yang dapat diakses siswa.

### FR-WEB-06: Pembuatan Ujian

Guru dapat mengatur:
- Judul dan deskripsi ujian.
- Mata pelajaran.
- Kelas peserta.
- Daftar soal.
- Waktu pembukaan dan penutupan ujian.
- Durasi pengerjaan.
- Pengacakan urutan soal.
- Pengacakan pilihan jawaban jika didukung.
- Kebijakan pengumpulan jawaban.
- Kebijakan pengumuman nilai.

Ujian dapat disimpan sebagai draft dan diterbitkan setelah validasi. Perubahan terhadap ujian yang sudah dimulai harus dibatasi agar tidak mengubah hasil secara tidak adil.

### FR-WEB-07: Pemantauan Ujian

- Guru dapat melihat jumlah peserta yang berhak mengikuti ujian.
- Guru dapat melihat status belum mulai, sedang mengerjakan, sudah mengumpulkan, atau waktu habis.
- Guru dapat melihat waktu pengumpulan berdasarkan waktu server.
- Guru tidak dapat melihat jawaban yang belum dikumpulkan kecuali terdapat kebutuhan pengawasan yang secara eksplisit diizinkan dan aman.

### FR-WEB-08: Rekap Hasil

- Guru dapat melihat nilai per siswa.
- Guru dapat melihat ringkasan nilai per ujian.
- Guru dapat memfilter hasil berdasarkan kelas dan ujian.
- Guru dapat membuka atau menunda pengumuman hasil.
- Sistem menyediakan ekspor CSV pada MVP jika memungkinkan.
- Hasil ujian tidak boleh dapat diubah langsung melalui permintaan frontend yang tidak sah.

## 7. Kebutuhan Fungsional Aplikasi Android

### FR-APP-01: Login Siswa

- Siswa dapat login menggunakan akun yang valid.
- Sistem hanya mengizinkan akun siswa memasuki fitur pengerjaan ujian.
- Aplikasi menampilkan pesan yang jelas ketika login gagal.
- Siswa dapat logout.
- Sesi autentikasi ditangani secara aman.

### FR-APP-02: Dashboard Siswa

Dashboard menampilkan:
- Ujian yang akan datang.
- Ujian yang sedang tersedia.
- Ujian yang sudah selesai.
- Riwayat ujian.
- Informasi status dan pengumuman.

### FR-APP-03: Detail Ujian

Siswa dapat melihat:
- Nama ujian.
- Mata pelajaran.
- Jadwal.
- Durasi.
- Jumlah soal.
- Petunjuk.
- Tombol mulai yang hanya aktif ketika persyaratan terpenuhi.

### FR-APP-04: Pengerjaan Soal

- Aplikasi menampilkan pertanyaan dan pilihan jawaban.
- Siswa dapat memilih satu jawaban.
- Siswa dapat berpindah ke soal sebelumnya dan berikutnya.
- Aplikasi menampilkan indikator nomor soal yang telah dan belum dijawab.
- Siswa dapat meninjau jawaban sebelum mengumpulkan.
- Jawaban yang berubah harus disimpan dengan status yang jelas.
- Sistem menampilkan indikator penyimpanan atau pengiriman jawaban.

### FR-APP-05: Timer Ujian

- Timer menampilkan sisa waktu pengerjaan.
- Waktu ditentukan berdasarkan waktu server.
- Menutup aplikasi tidak boleh mereset durasi ujian.
- Ketika waktu habis, sistem menjalankan proses pengumpulan sesuai kebijakan ujian.
- Sistem memulihkan sesi yang sah ketika aplikasi dibuka kembali.
- Timer tidak boleh hanya bergantung pada jam perangkat.

### FR-APP-06: Pengumpulan Jawaban

- Siswa dapat mengumpulkan jawaban sebelum waktu berakhir.
- Sistem meminta konfirmasi sebelum pengumpulan final.
- Setelah dikumpulkan, sesi tidak dapat diubah kecuali kebijakan ujian secara eksplisit mengizinkannya.
- Sistem mencegah pengumpulan ganda yang menghasilkan nilai duplikat.
- Siswa mendapat informasi bahwa pengumpulan berhasil atau masih bermasalah.

### FR-APP-07: Hasil dan Riwayat

- Siswa dapat melihat status penyelesaian ujian.
- Nilai ditampilkan hanya setelah hasil dibuka oleh sistem atau guru.
- Siswa hanya dapat mengakses nilai dan riwayat miliknya sendiri.
- Kunci jawaban dan pembahasan tidak ditampilkan sebelum diizinkan.

## 8. Aturan Bisnis Ujian

1. Setiap ujian harus memiliki waktu pembukaan, waktu penutupan, durasi, peserta, dan soal yang valid.
2. Siswa hanya dapat mengikuti ujian yang ditugaskan kepada kelasnya.
3. Sistem menentukan waktu ujian menggunakan waktu server.
4. Setiap siswa memiliki sesi pengerjaan yang tercatat.
5. Aturan jumlah percobaan harus ditetapkan oleh guru sebelum ujian diterbitkan.
6. Jawaban yang sudah diterima server menjadi sumber utama ketika terjadi gangguan koneksi.
7. Penilaian pilihan ganda dilakukan melalui fungsi server yang tepercaya.
8. Nilai tidak boleh ditentukan berdasarkan data kunci jawaban yang dikirim ke perangkat siswa.
9. Pengumpulan ujian harus idempoten, sehingga permintaan berulang tidak menciptakan hasil baru.
10. Perubahan soal atau kunci jawaban setelah ujian berlangsung harus mengikuti kebijakan koreksi dan mempertahankan jejak perubahan yang relevan.

### Rumus Penilaian

Nilai = (Total bobot jawaban benar / Total bobot seluruh soal) × 100

Untuk soal berbobot sama, nilai dapat dihitung dari jumlah jawaban benar dibagi jumlah soal dikalikan 100. Ujian tanpa soal harus ditolak.

## 9. Rancangan Database

Tabel inti yang disarankan:

1. `profiles`: identitas dan peran pengguna.
2. `classes`: informasi kelas.
3. `class_members`: hubungan siswa dengan kelas.
4. `subjects`: mata pelajaran.
5. `teacher_assignments`: penugasan guru ke kelas atau mata pelajaran.
6. `questions`: soal dan metadata soal.
7. `question_options`: pilihan jawaban dan referensi jawaban benar yang terlindungi.
8. `exams`: konfigurasi dan jadwal ujian.
9. `exam_questions`: hubungan ujian dengan soal beserta bobot dan urutannya.
10. `exam_attempts`: sesi pengerjaan setiap siswa.
11. `answers`: jawaban siswa untuk setiap soal.
12. `results`: nilai dan status hasil ujian.
13. `audit_logs`: catatan tindakan penting yang diperlukan untuk audit.

### Relasi utama

- Satu kelas memiliki banyak siswa.
- Satu guru dapat ditugaskan ke beberapa kelas atau mata pelajaran.
- Satu ujian memiliki banyak soal.
- Satu siswa dapat memiliki sesi ujian sesuai kebijakan percobaan.
- Satu sesi ujian memiliki jawaban untuk soal-soal yang dikerjakan.
- Satu sesi yang telah dinilai memiliki hasil yang konsisten.

Kunci jawaban harus dipisahkan dari data soal yang boleh dibaca siswa atau dilindungi melalui fungsi server yang memverifikasi sesi ujian. RLS harus diterapkan dan diuji pada semua tabel yang dapat diakses melalui API.

## 10. Arsitektur Komunikasi

Alur komunikasi:

1. Guru menggunakan dashboard web.
2. Dashboard web mengirim permintaan ke layanan backend.
3. Backend memvalidasi identitas, peran, dan kewenangan guru.
4. Backend menyimpan konfigurasi ujian ke database.
5. Aplikasi Android siswa meminta daftar ujian yang diizinkan.
6. Backend memverifikasi kelas, jadwal, dan status ujian.
7. Aplikasi menampilkan soal tanpa membocorkan kunci jawaban.
8. Jawaban dikirim dan disimpan melalui mekanisme yang aman.
9. Backend memproses pengumpulan dan penilaian.
10. Dashboard web menampilkan rekap hasil sesuai hak akses.

Permintaan sensitif, termasuk penilaian, pengumpulan final, dan perubahan hak akses, harus diverifikasi di sisi server. Jangan mengandalkan validasi antarmuka klien saja.

## 11. Struktur Project

```text
cbt-system/
├── cbt-android/
│   ├── app/
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── types/
│   ├── assets/
│   ├── app.json
│   └── package.json
│
├── cbt-web/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── features/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── types/
│   ├── public/
│   └── package.json
│
└── docs/
    ├── PRD.md
    ├── DATABASE.md
    ├── API.md
    └── TEST-PLAN.md
```

Struktur ini adalah rekomendasi awal. Struktur final dapat disesuaikan dengan framework dan kebutuhan proyek.

## 12. Kebutuhan Nonfungsional

### Keamanan

- HTTPS untuk komunikasi.
- Autentikasi yang aman.
- RLS pada database.
- Pemisahan hak akses administrator, guru, dan siswa.
- Perlindungan kunci jawaban.
- Validasi data pada server.
- Pembatasan percobaan akses dan permintaan yang mencurigakan.
- Pengelolaan rahasia server di lingkungan backend.
- Pencatatan tindakan penting dan penanganan kesalahan tanpa membocorkan informasi sensitif.

### Kinerja

- Dashboard mampu memuat data secara bertahap.
- Tabel besar menggunakan pagination.
- Aplikasi menampilkan status loading, berhasil, dan gagal.
- Jawaban disimpan dengan mekanisme yang meminimalkan kehilangan data.
- Beban ujian serentak perlu diuji sebelum implementasi nyata.

### Kompatibilitas

- Dashboard mendukung browser desktop modern.
- Antarmuka web responsif.
- Aplikasi Android mendukung perangkat yang ditetapkan pada tahap implementasi.
- Versi minimum Android dan target browser ditentukan sebelum pengujian.

### Ketersediaan

- Sistem memerlukan koneksi internet untuk mengikuti ujian pada MVP.
- Kegagalan koneksi ditangani dengan indikator status dan pemulihan sesi.
- Sistem tidak boleh mengklaim jawaban tersimpan jika server belum mengonfirmasi penyimpanannya.

## 13. Kriteria Penerimaan

Produk MVP diterima apabila:

1. Guru dan administrator dapat login ke dashboard web sesuai hak akses.
2. Siswa dapat login ke aplikasi Android.
3. Guru dapat mengelola kelas dan bank soal.
4. Guru dapat menerbitkan ujian dengan jadwal dan durasi.
5. Siswa yang berhak dapat memulai ujian pada waktu yang benar.
6. Timer tetap konsisten setelah aplikasi ditutup dan dibuka kembali.
7. Jawaban tersimpan serta dapat dipulihkan sesuai aturan.
8. Pengumpulan ujian menghasilkan paling banyak satu hasil final per sesi.
9. Penilaian menghasilkan skor yang sesuai dengan jawaban dan bobot.
10. Guru dapat melihat rekap nilai.
11. Siswa tidak dapat membaca kunci jawaban atau nilai siswa lain.
12. Uji akses tanpa izin, gangguan koneksi, dan pengumpulan berulang berhasil ditangani dengan benar.

## 14. Rencana Pengujian

### Pengujian fungsional
- Login dan logout.
- Manajemen pengguna dan kelas.
- CRUD bank soal.
- Pembuatan dan penerbitan ujian.
- Validasi jadwal dan durasi.
- Navigasi soal.
- Penyimpanan dan perubahan jawaban.
- Pengumpulan manual dan otomatis.
- Perhitungan nilai.
- Rekap hasil.

### Pengujian keamanan
- Siswa mencoba mengakses dashboard guru.
- Siswa mencoba mengakses soal yang tidak ditugaskan.
- Siswa mencoba membaca kunci jawaban.
- Siswa mencoba mengubah hasil ujian.
- Guru mencoba mengakses data di luar kewenangannya.
- Permintaan pengumpulan dikirim berulang kali.
- Pengguna tidak terautentikasi mencoba membaca data terlindungi.

### Pengujian kondisi nyata
- Koneksi internet terputus sementara.
- Aplikasi ditutup ketika ujian berlangsung.
- Perangkat mengalami pergantian jaringan.
- Waktu ujian habis ketika siswa belum mengumpulkan.
- Beberapa siswa mengerjakan ujian secara bersamaan.

## 15. Rencana Implementasi

### Fase 1 — Analisis dan desain
Memvalidasi kebutuhan sekolah, menyelesaikan PRD, membuat alur pengguna, dan merancang UI/UX.

### Fase 2 — Fondasi backend
Membuat proyek Supabase, skema database, autentikasi, RLS, dan fungsi backend yang diperlukan.

### Fase 3 — Dashboard web
Membangun login, dashboard, manajemen kelas, pengguna, mata pelajaran, dan bank soal.

### Fase 4 — Pembuatan ujian
Membangun konfigurasi ujian, jadwal, penugasan peserta, dan penerbitan ujian.

### Fase 5 — Aplikasi Android
Membangun login siswa, daftar ujian, halaman pengerjaan soal, timer, dan pengumpulan jawaban.

### Fase 6 — Penilaian dan rekap
Membangun penilaian di server, halaman hasil siswa, dan rekap nilai guru.

### Fase 7 — Integrasi dan pengujian
Menguji kedua aplikasi terhadap backend yang sama, termasuk hak akses dan kondisi jaringan.

### Fase 8 — Build dan implementasi
Membuat APK atau AAB, deploy dashboard web, melakukan uji coba, dan menyusun dokumentasi skripsi.

## 16. Batasan MVP

- Jenis soal utama adalah pilihan ganda dengan satu jawaban benar.
- Ujian membutuhkan koneksi internet.
- Ujian offline belum termasuk ruang lingkup awal.
- Integrasi Exam Browser dan penguncian perangkat belum termasuk MVP.
- Pengawasan melalui kamera tidak termasuk MVP.
- Penilaian esai otomatis tidak termasuk MVP.
- Analisis butir soal lanjutan menjadi pengembangan berikutnya.
- Implementasi mengikuti kebijakan dan infrastruktur sekolah.

## 17. Indikator Keberhasilan

- Kedua aplikasi terintegrasi dengan backend yang sama.
- Semua alur inti berhasil diuji.
- Penilaian otomatis sesuai dengan aturan.
- Tidak ditemukan akses tanpa izin dalam skenario pengujian yang ditetapkan.
- Guru dapat mengelola ujian dan memeriksa hasil melalui web.
- Siswa dapat mengerjakan ujian melalui Android.
- Hasil pengujian dan evaluasi pengguna terdokumentasi untuk laporan skripsi.

## 18. Catatan Akademik

PRD ini merupakan dokumen kebutuhan produk dan acuan pengembangan perangkat lunak. Judul skripsi, metode penelitian, instrumen pengujian, dan prosedur evaluasi harus disesuaikan dengan pedoman perguruan tinggi serta persetujuan dosen pembimbing.

Sebelum implementasi di sekolah, lakukan uji coba terbatas, verifikasi keamanan data, dan pastikan prosedur penggunaan disetujui oleh pihak sekolah.
