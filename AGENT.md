# AGENTS.md
# Panduan AI Agent — Sistem Computer Based Test (CBT)

## 1. IDENTITAS DAN TUJUAN PROYEK

Proyek ini adalah sistem Computer Based Test (CBT) untuk mendukung pelaksanaan ujian berbasis komputer atau perangkat Android di lingkungan sekolah.

Sistem terdiri dari dua aplikasi yang terpisah tetapi terintegrasi melalui satu backend dan database bersama.

### Aplikasi A: CBT Android
Aplikasi Android untuk siswa, dikembangkan menggunakan:
- React Native
- Expo
- TypeScript
- Expo Router
- Supabase

### Aplikasi B: CBT Web Dashboard
Aplikasi web untuk guru dan admin, dikembangkan menggunakan:
- React
- Vite
- TypeScript
- React Router
- Supabase

### Backend bersama
Gunakan Supabase untuk:
- Autentikasi pengguna.
- Database PostgreSQL.
- Pengelolaan data siswa, guru, kelas, dan mata pelajaran.
- Pengelolaan soal dan ujian.
- Penyimpanan jawaban dan hasil ujian.
- Pengaturan hak akses melalui Row Level Security (RLS).

Kedua aplikasi harus menggunakan backend yang sama agar data dapat disinkronkan.

---

## 2. DOKUMEN ACUAN WAJIB

Sebelum melakukan pekerjaan, periksa dokumen berikut jika tersedia:

1. `AGENTS.md`: aturan kerja AI Agent.
2. `PRD.md`: kebutuhan dan spesifikasi produk.
3. `TASKS.md`: daftar pekerjaan dan status implementasi.
4. `README.md`: petunjuk instalasi dan penggunaan.
5. Dokumentasi teknis lain yang tersedia di dalam proyek.

### Aturan membaca dokumen

- Baca `PRD.md` sebelum merancang atau mengimplementasikan fitur.
- Gunakan `PRD.md` sebagai acuan utama kebutuhan produk.
- Jangan mengarang persyaratan yang tidak tercantum dalam dokumen.
- Jika PRD tidak tersedia atau tidak dapat dibaca, beri tahu pengguna.
- Jika ada persyaratan yang ambigu, identifikasi dan tanyakan jika keputusan tersebut berdampak besar terhadap arsitektur atau keamanan.
- Jika dokumen bertentangan dengan implementasi yang sudah ada, analisis perbedaannya sebelum mengubah kode.
- Jangan mengubah kebutuhan utama tanpa alasan yang jelas dan persetujuan pengguna jika perubahan tersebut berdampak besar.

Jika pengguna meminta tugas yang spesifik, baca bagian PRD yang relevan dan bagian lain yang diperlukan untuk memahami dampaknya.

---

## 3. STRUKTUR DIREKTORI PROYEK

Struktur utama yang diharapkan:

cbt-system/
├── AGENTS.md
├── PRD.md
├── README.md
├── TASKS.md
├── .gitignore
├── cbt-android/
│   ├── AGENTS.md
│   ├── app/
│   ├── assets/
│   ├── components/
│   ├── constants/
│   ├── hooks/
│   ├── lib/
│   ├── services/
│   ├── types/
│   ├── app.json
│   ├── package.json
│   └── tsconfig.json
└── cbt-web/
    ├── AGENTS.md
    ├── public/
    ├── src/
    ├── package.json
    ├── tsconfig.json
    └── vite.config.ts

Struktur di atas adalah panduan, bukan kewajiban mutlak untuk membuat semua folder sejak awal.

### Aturan struktur direktori

- Periksa direktori yang sudah ada sebelum membuat struktur baru.
- Pertahankan kode dan konfigurasi yang masih berfungsi.
- Jangan membuat proyek duplikat jika proyek yang sesuai sudah tersedia.
- Pisahkan kode aplikasi Android dan dashboard web.
- Letakkan kode integrasi Supabase dalam modul yang terorganisasi.
- Hindari file yang terlalu besar dan sulit dipelihara.
- Gunakan struktur yang konsisten dengan teknologi yang dipilih.
- Jangan memindahkan atau menghapus file penting tanpa alasan yang jelas.

Jika masing-masing aplikasi memiliki `AGENTS.md`, ikuti juga instruksi khusus yang berlaku untuk direktori tersebut.

---

## 4. ATURAN UMUM PENGERJAAN

### 4.1 Sebelum menulis kode

Lakukan langkah berikut:

1. Periksa direktori kerja saat ini.
2. Identifikasi proyek yang sedang dikerjakan.
3. Baca instruksi dan persyaratan yang relevan.
4. Periksa file, dependensi, dan konfigurasi yang sudah ada.
5. Identifikasi masalah atau kebutuhan yang belum terpenuhi.
6. Susun rencana perubahan.
7. Jelaskan rencana kepada pengguna jika pekerjaan cukup besar atau berisiko.

Untuk tugas kecil dan jelas, kerjakan langsung setelah pemeriksaan yang diperlukan.

### 4.2 Saat menulis kode

- Gunakan TypeScript untuk kode aplikasi baru.
- Gunakan komponen yang dapat digunakan kembali.
- Pisahkan tampilan, logika bisnis, dan akses data jika sesuai.
- Terapkan penamaan variabel, fungsi, komponen, dan file yang konsisten.
- Hindari duplikasi kode yang tidak diperlukan.
- Gunakan dependensi yang memang dibutuhkan.
- Periksa kompatibilitas versi paket sebelum memasang atau memperbaruinya.
- Jangan memperbarui seluruh dependensi tanpa kebutuhan.
- Jangan menonaktifkan pemeriksaan TypeScript, lint, atau keamanan hanya untuk menyembunyikan kesalahan.
- Jangan mengganti teknologi utama tanpa persetujuan pengguna.

### 4.3 Setelah menulis kode

- Periksa perubahan yang dibuat.
- Jalankan pemeriksaan yang tersedia.
- Perbaiki kesalahan yang ditemukan.
- Jalankan pengujian yang relevan.
- Laporkan bagian yang berhasil dan yang belum berhasil.
- Jangan menyatakan fitur selesai hanya karena kode telah ditulis.

---

## 5. ARSITEKTUR DUA APLIKASI

### 5.1 CBT Android

Aplikasi Android digunakan oleh siswa untuk:

- Login dan logout.
- Melihat profil.
- Melihat kelas dan mata pelajaran yang relevan.
- Melihat daftar ujian yang tersedia.
- Melihat informasi dan jadwal ujian.
- Memulai ujian sesuai ketentuan.
- Menjawab soal.
- Berpindah antarsoal.
- Melihat sisa waktu.
- Menyimpan jawaban.
- Mengirim ujian.
- Melihat hasil jika sudah diizinkan.
- Melihat riwayat ujian.

Seluruh fitur harus disesuaikan dengan `PRD.md`.

### 5.2 CBT Web Dashboard

Dashboard web digunakan oleh guru dan admin sesuai hak akses masing-masing.

Fitur yang direncanakan dapat meliputi:

- Login dan logout.
- Dashboard ringkasan.
- Pengelolaan akun.
- Pengelolaan siswa dan guru.
- Pengelolaan kelas.
- Pengelolaan mata pelajaran.
- Pengelolaan bank soal.
- Pengelolaan pilihan jawaban.
- Pembuatan dan pengaturan ujian.
- Penentuan jadwal ujian.
- Pengaturan durasi dan jumlah soal.
- Penentuan peserta ujian.
- Pemantauan pengerjaan ujian.
- Pemeriksaan hasil.
- Penilaian otomatis untuk soal pilihan ganda.
- Laporan nilai.
- Ekspor hasil jika dipersyaratkan.

Jangan menganggap semua fitur di atas sudah wajib untuk versi awal. Gunakan `PRD.md` untuk menentukan ruang lingkup implementasi.

### 5.3 Backend bersama

Kedua aplikasi harus mengakses proyek Supabase yang sama.

Gunakan konfigurasi environment masing-masing aplikasi. Jangan menyalin seluruh konfigurasi rahasia dari satu aplikasi ke aplikasi lainnya.

Jangan membuat database terpisah untuk setiap aplikasi kecuali terdapat alasan arsitektur yang telah disetujui.

---

## 6. AUTENTIKASI DAN HAK AKSES

Sistem memiliki tiga peran utama:

- `student`: siswa.
- `teacher`: guru.
- `admin`: administrator.

Nama peran final harus mengikuti skema database dan `PRD.md`.

### Ketentuan

- Pengguna harus login sebelum mengakses fitur yang dilindungi.
- Setiap peran hanya boleh mengakses fitur sesuai kewenangannya.
- Siswa tidak boleh mengelola bank soal atau membuat ujian.
- Guru hanya boleh mengelola data yang menjadi kewenangannya.
- Admin memiliki hak pengelolaan sesuai kebijakan sistem.
- Jangan mempercayai role yang hanya disimpan di perangkat pengguna.
- Hak akses harus ditegakkan di backend, bukan hanya dengan menyembunyikan tombol.
- Terapkan Row Level Security (RLS) pada tabel yang berisi data terlindungi.
- Jangan menganggap pengguna aman hanya karena sudah berhasil login.
- Tangani sesi kedaluwarsa dan kegagalan autentikasi dengan benar.

Jangan memberikan hak akses administrator kepada akun baru secara otomatis.

Proses pembuatan atau perubahan role istimewa harus dilakukan melalui mekanisme administratif yang terlindungi.

---

## 7. KEAMANAN SUPABASE

Keamanan data merupakan persyaratan utama.

### 7.1 Environment variables

Gunakan environment variables untuk konfigurasi.

Contoh aplikasi Expo:

`EXPO_PUBLIC_SUPABASE_URL`

`EXPO_PUBLIC_SUPABASE_ANON_KEY`

Contoh aplikasi web:

`VITE_SUPABASE_URL`

`VITE_SUPABASE_ANON_KEY`

Nama variabel harus konsisten dengan implementasi dan dokumentasi proyek.

Variabel yang menggunakan prefiks publik dapat dimasukkan ke bundle aplikasi. Karena itu, hanya gunakan nilai yang memang aman untuk diekspos.

### 7.2 Secret dan service-role key

- Jangan memasukkan Supabase service-role key ke aplikasi Android.
- Jangan memasukkan service-role key ke bundle frontend web.
- Jangan menaruh password database di kode frontend.
- Jangan mencetak token autentikasi atau kredensial ke log.
- Jangan mengunggah file `.env` yang berisi rahasia ke GitHub.
- Gunakan backend tepercaya atau fungsi database yang aman untuk operasi istimewa.
- Jika sebuah rahasia terungkap, beri tahu pengguna dan sarankan rotasi kredensial terkait.

### 7.3 Row Level Security

- Aktifkan RLS pada tabel yang dapat diakses melalui Supabase Data API dan berisi data terlindungi.
- Buat kebijakan berdasarkan identitas pengguna dan kewenangannya.
- Uji akses yang diizinkan dan ditolak.
- Pastikan siswa tidak dapat membaca data siswa lain tanpa izin.
- Pastikan guru tidak dapat mengakses data di luar kewenangannya.
- Jangan membuat kebijakan yang mengizinkan semua pengguna membaca atau mengubah seluruh data tanpa alasan yang sah.
- Jangan menganggap validasi di aplikasi klien cukup untuk melindungi database.

---

## 8. KEAMANAN UJIAN CBT

Jawaban benar dan aturan penilaian tidak boleh mudah diakses oleh peserta sebelum hasil dibuka.

### Ketentuan penting

- Jangan mengirim kunci jawaban ke aplikasi siswa selama ujian berlangsung.
- Jangan menghitung nilai final hanya berdasarkan hasil perhitungan yang dikirim klien.
- Validasi pengiriman jawaban di sisi server atau melalui mekanisme database tepercaya.
- Periksa bahwa peserta memang terdaftar sebagai peserta ujian.
- Periksa status ujian sebelum menerima jawaban.
- Terapkan batas waktu berdasarkan waktu server, bukan hanya jam perangkat siswa.
- Cegah pengiriman final berulang yang menghasilkan nilai atau percobaan ganda.
- Terapkan aturan yang jelas untuk ujian yang sudah selesai atau kedaluwarsa.
- Simpan waktu mulai, waktu selesai, dan status pengerjaan.
- Gunakan transaksi atau operasi database yang aman ketika diperlukan.

### Penyimpanan jawaban

- Simpan jawaban secara berkala sesuai rancangan.
- Tampilkan indikator status penyimpanan.
- Tangani kegagalan jaringan.
- Jangan menghapus jawaban tersimpan hanya karena aplikasi berpindah halaman.
- Hindari membuat jawaban ganda akibat permintaan yang diulang.
- Jika jawaban gagal tersimpan, beri tahu siswa dan sediakan mekanisme mencoba kembali.

### Pengiriman ujian

- Tampilkan konfirmasi sebelum pengiriman final jika dipersyaratkan.
- Setelah pengiriman final berhasil, ubah status percobaan ujian sesuai aturan.
- Jangan mengizinkan perubahan jawaban setelah ujian dikunci, kecuali aturan ujian memang mengizinkannya.
- Jika waktu habis, jalankan aturan penutupan yang ditentukan PRD.
- Pastikan pengiriman ulang tidak merusak hasil yang telah tersimpan.

---

## 9. PENGEMBANGAN APLIKASI ANDROID

Gunakan Expo, React Native, TypeScript, dan Expo Router sesuai arsitektur yang ditetapkan.

### Ketentuan

- Gunakan navigasi yang konsisten.
- Pisahkan halaman, komponen, layanan, dan tipe data.
- Buat antarmuka yang responsif terhadap ukuran layar Android.
- Tangani loading, error, data kosong, dan kondisi jaringan.
- Hindari permintaan database yang berulang tanpa kebutuhan.
- Jangan menyimpan rahasia backend di aplikasi.
- Jangan menganggap aplikasi berjalan baik hanya karena Metro berhasil dijalankan.
- Periksa kompatibilitas paket dengan versi Expo yang digunakan.
- Gunakan komponen dan API yang sesuai dengan versi proyek saat ini.

### Antarmuka siswa

Antarmuka harus mudah digunakan oleh siswa dan tidak membingungkan ketika ujian berlangsung.

Perhatikan:

- Ukuran teks yang nyaman dibaca.
- Tombol yang mudah ditekan.
- Nomor soal yang terlihat jelas.
- Indikator soal yang sudah dan belum dijawab.
- Tampilan sisa waktu.
- Indikator penyimpanan jawaban.
- Pesan kesalahan yang jelas.
- Konfirmasi sebelum tindakan penting.

Jangan menambahkan animasi atau elemen visual yang mengganggu konsentrasi saat ujian.

---

## 10. PENGEMBANGAN DASHBOARD WEB

Gunakan React, Vite, TypeScript, dan React Router sesuai arsitektur proyek.

### Ketentuan

- Buat layout dashboard yang konsisten.
- Sediakan navigasi berdasarkan role.
- Lindungi halaman yang memerlukan autentikasi.
- Validasi data formulir.
- Tampilkan status loading dan error.
- Sediakan konfirmasi untuk penghapusan atau tindakan penting.
- Tangani tabel dengan data kosong.
- Hindari menampilkan data yang tidak boleh diakses oleh pengguna.
- Pastikan operasi penting divalidasi di backend.
- Jangan mengandalkan pembatasan tampilan frontend sebagai satu-satunya keamanan.

### Pengelolaan soal

Jika fitur bank soal tercantum dalam PRD:

- Sediakan pembuatan soal.
- Sediakan pengeditan soal.
- Sediakan penghapusan soal dengan pemeriksaan dampaknya.
- Kelola pilihan jawaban dan jawaban benar secara aman.
- Validasi jumlah dan isi pilihan jawaban.
- Pastikan soal yang sudah digunakan dalam ujian tidak rusak ketika diedit atau dihapus.
- Pertimbangkan penyimpanan snapshot soal untuk ujian yang sudah dipublikasikan jika diperlukan oleh desain sistem.

### Pengelolaan ujian

Jika dipersyaratkan dalam PRD:

- Sediakan pengaturan jadwal.
- Sediakan durasi.
- Tentukan peserta yang berhak mengikuti ujian.
- Validasi kesiapan ujian sebelum dipublikasikan.
- Bedakan ujian sebagai draft, terjadwal, aktif, dan selesai sesuai kebutuhan.
- Cegah perubahan berisiko terhadap ujian yang sedang berlangsung.
- Tampilkan hasil sesuai aturan publikasi nilai.

---

## 11. DESAIN ANTARMUKA DAN PENGALAMAN PENGGUNA

Gunakan desain yang sederhana, konsisten, dan sesuai kebutuhan pendidikan.

### Ketentuan

- Gunakan sistem warna dan tipografi yang konsisten.
- Buat hierarki visual yang jelas.
- Pastikan kontras teks memadai.
- Gunakan label formulir yang jelas.
- Sediakan pesan validasi yang mudah dipahami.
- Hindari tombol tanpa fungsi.
- Hindari tautan yang tidak mengarah ke halaman yang benar.
- Jangan menggunakan data palsu seolah-olah berasal dari database produksi.
- Jika memakai data contoh untuk pengembangan, tandai sebagai data contoh.

Jangan mengganti seluruh desain yang sudah berfungsi hanya karena preferensi pribadi AI.

Jika pengguna memberikan referensi desain, gunakan referensi tersebut sejauh sesuai dengan kebutuhan produk dan kemampuan teknis.

---

## 12. PENGELOLAAN DATABASE

Ikuti skema dalam `PRD.md` dan migrasi database yang sudah ada.

Tabel yang mungkin diperlukan antara lain:

- `profiles`
- `classes`
- `class_members`
- `subjects`
- `teacher_assignments`
- `questions`
- `question_options`
- `exams`
- `exam_questions`
- `exam_attempts`
- `answers`
- `results`
- `audit_logs`

Daftar tersebut bukan perintah untuk membuat semua tabel secara membabi buta. Pastikan skema akhir sesuai kebutuhan dan tidak menduplikasi tabel yang sudah tersedia.

### Ketentuan database

- Gunakan primary key dan foreign key yang sesuai.
- Tentukan batasan unik jika dibutuhkan.
- Tambahkan indeks pada kolom yang sering digunakan untuk pencarian atau relasi.
- Validasi integritas data.
- Gunakan timestamp yang sesuai untuk audit dan penjadwalan.
- Tentukan kebijakan penghapusan relasi secara hati-hati.
- Hindari menyimpan data yang sama di banyak tempat tanpa alasan.
- Jangan menghapus atau mereset database produksi tanpa persetujuan eksplisit.
- Gunakan migrasi yang dapat ditinjau dan dilacak.
- Periksa dampak migrasi terhadap kode yang sudah ada.

Jangan menganggap tabel telah tersedia hanya karena nama tabel muncul dalam PRD.

Periksa database atau berkas migrasi terlebih dahulu.

---

## 13. PENANGANAN ERROR DAN JARINGAN

Sistem harus menangani kegagalan dengan baik.

### Ketentuan

- Tangani kegagalan login.
- Tangani koneksi Supabase yang gagal.
- Tangani respons database yang tidak sesuai harapan.
- Tangani sesi yang kedaluwarsa.
- Tangani kegagalan penyimpanan jawaban.
- Tangani kegagalan pengiriman ujian.
- Hindari pesan error teknis yang membingungkan pengguna.
- Jangan menyembunyikan error penting secara diam-diam.
- Catat informasi diagnostik yang aman tanpa membocorkan rahasia.
- Hindari mengulang permintaan yang tidak idempoten tanpa mekanisme pengaman.

Jika operasi gagal, tampilkan pesan yang sesuai dan sediakan langkah pemulihan jika memungkinkan.

Jangan menyatakan data telah tersimpan jika operasi database belum dikonfirmasi berhasil.

---

## 14. PENGUJIAN WAJIB

Lakukan pengujian yang sesuai dengan perubahan kode.

### 14.1 Pemeriksaan statis

Jika tersedia, jalankan:

- Pemeriksaan TypeScript.
- ESLint.
- Pemeriksaan format.
- Pemeriksaan build.

Gunakan skrip yang benar-benar tersedia dalam `package.json`.

Jangan mengasumsikan semua proyek memiliki skrip yang sama.

### 14.2 Pengujian autentikasi

Uji skenario:

- Login berhasil.
- Login gagal.
- Logout.
- Sesi kedaluwarsa.
- Akses halaman tanpa login.
- Akses fitur dengan role yang tidak sesuai.

### 14.3 Pengujian ujian

Jika fitur ujian sudah diimplementasikan, uji:

- Siswa yang berhak dapat memulai ujian.
- Siswa yang tidak terdaftar tidak dapat mengikuti ujian.
- Ujian belum dapat dimulai sebelum jadwalnya.
- Timer bekerja sesuai waktu server.
- Jawaban dapat disimpan dan dibaca kembali.
- Jawaban yang gagal tersimpan ditangani dengan benar.
- Pengiriman final menghasilkan satu hasil yang konsisten.
- Waktu habis ditangani sesuai aturan.
- Kunci jawaban tidak dapat diakses peserta sebelum diizinkan.
- Penilaian otomatis menghasilkan nilai yang sesuai.

### 14.4 Pengujian hak akses

Uji secara terpisah menggunakan akun siswa, guru, dan admin.

Pastikan pengguna tidak dapat mengakses data yang bukan haknya dengan memanggil backend secara langsung.

### 14.5 Pengujian integrasi

Periksa bahwa:

- Android dan web menggunakan backend yang sama.
- Data ujian yang dibuat guru muncul pada peserta yang berhak.
- Jawaban tersimpan dengan relasi yang benar.
- Hasil penilaian dapat ditampilkan sesuai kebijakan publikasi.
- Perubahan skema tidak merusak aplikasi yang lain.

### Aturan pelaporan pengujian

Bedakan secara tegas antara:

- Belum diuji.
- Pemeriksaan kode berhasil.
- Build berhasil.
- Pengujian otomatis berhasil.
- Pengujian manual berhasil.
- Pengujian perangkat nyata berhasil.

Jangan mengklaim pengujian perangkat nyata jika hanya menjalankan pemeriksaan kode.

---

## 15. PENGGUNAAN TERMINAL DAN PERINTAH

Sebelum menjalankan perintah:

1. Pastikan direktori kerja benar.
2. Pastikan perintah sesuai dengan sistem operasi.
3. Periksa apakah dependensi sudah terpasang.
4. Hindari perintah destruktif yang tidak diperlukan.

Untuk proyek Android, jalankan perintah dari direktori `cbt-android`.

Contoh:

`cd cbt-android`

`npx expo start`

Untuk proyek web, jalankan perintah dari direktori `cbt-web`.

Contoh:

`cd cbt-web`

`npm run dev`

Perintah tersebut hanya contoh. Periksa `package.json` dan kondisi proyek sebelum menggunakannya.

Jangan menjalankan kedua aplikasi dengan asumsi satu perintah akan otomatis menjalankan semuanya.

Jangan menghapus `node_modules`, lockfile, database, konfigurasi, atau data pengguna tanpa alasan teknis yang jelas.

Minta persetujuan pengguna sebelum menjalankan tindakan yang berisiko menghilangkan data penting.

---

## 16. ATURAN GIT DAN PENGELOLAAN FILE

- Periksa status Git sebelum melakukan perubahan besar.
- Jangan menimpa pekerjaan pengguna tanpa pemeriksaan.
- Jangan menghapus perubahan lokal yang belum disimpan.
- Jangan melakukan force push.
- Jangan melakukan reset destruktif tanpa persetujuan.
- Jangan memasukkan file rahasia ke repositori.
- Pastikan `.gitignore` mencakup file environment yang mengandung rahasia.
- Gunakan commit jika pengguna meminta atau alur kerja proyek membutuhkannya.
- Jangan mengklaim perubahan sudah di-commit atau di-push jika tindakan tersebut belum berhasil.

---

## 17. TAHAPAN IMPLEMENTASI PROYEK

Gunakan urutan berikut sebagai panduan awal. Sesuaikan dengan `PRD.md`, kondisi kode, dan prioritas pengguna.

### Tahap 1 — Analisis
- Baca PRD.
- Periksa struktur proyek.
- Identifikasi fitur MVP.
- Buat rencana implementasi.

### Tahap 2 — Fondasi proyek
- Siapkan proyek Android dan web.
- Periksa konfigurasi TypeScript.
- Siapkan struktur kode.
- Siapkan konfigurasi environment.
- Siapkan dokumentasi dasar.

### Tahap 3 — Backend
- Siapkan skema database.
- Siapkan migrasi.
- Konfigurasikan Supabase Auth.
- Implementasikan RLS.
- Uji hak akses.

### Tahap 4 — Autentikasi
- Implementasikan login dan logout.
- Implementasikan pemuatan profil.
- Terapkan pembatasan akses sesuai role.
- Uji seluruh peran.

### Tahap 5 — Dashboard guru dan admin
- Implementasikan fitur sesuai prioritas PRD.
- Uji operasi data dan hak akses.

### Tahap 6 — Aplikasi Android siswa
- Implementasikan daftar ujian.
- Implementasikan pengerjaan soal.
- Implementasikan timer.
- Implementasikan penyimpanan jawaban.
- Implementasikan pengiriman ujian.
- Implementasikan hasil sesuai aturan publikasi.

### Tahap 7 — Penilaian dan laporan
- Implementasikan penilaian di sisi tepercaya.
- Implementasikan hasil dan laporan.
- Validasi konsistensi nilai.

### Tahap 8 — Integrasi
- Uji alur guru membuat ujian sampai siswa menyelesaikannya.
- Uji sinkronisasi data.
- Uji hak akses lintas aplikasi.

### Tahap 9 — Finalisasi
- Jalankan pemeriksaan kode dan build.
- Perbaiki bug.
- Perbarui README.
- Perbarui TASKS.
- Laporkan status akhir dan pekerjaan yang belum selesai.

Jangan melaksanakan semua tahapan sekaligus tanpa evaluasi. Kerjakan dalam bagian yang dapat diuji dan ditinjau.

---

## 18. PEMBARUAN TASKS.md

Jika `TASKS.md` tersedia, gunakan file tersebut untuk melacak pekerjaan.

Contoh format:

- [ ] Menyiapkan struktur proyek.
- [ ] Mengonfigurasi Supabase.
- [ ] Membuat autentikasi.
- [ ] Membuat pengelolaan kelas.
- [ ] Membuat bank soal.
- [ ] Membuat pengaturan ujian.
- [ ] Membuat aplikasi ujian siswa.
- [ ] Membuat timer dan penyimpanan jawaban.
- [ ] Membuat penilaian otomatis.
- [ ] Membuat laporan hasil.
- [ ] Menguji keamanan dan hak akses.
- [ ] Menguji integrasi Android dan web.

Jangan menandai pekerjaan selesai sebelum implementasi dan pemeriksaan yang relevan dilakukan.

Jika sebuah fitur baru sebagian selesai, jelaskan bagian yang sudah dan belum dikerjakan.

---

## 19. BATASAN KEPUTUSAN AI

AI Agent boleh mengambil keputusan teknis kecil selama tidak bertentangan dengan persyaratan proyek.

AI Agent harus meminta klarifikasi atau persetujuan ketika keputusan berpotensi:

- Mengubah arsitektur utama.
- Mengubah teknologi utama.
- Menghapus data penting.
- Mengubah struktur database secara berisiko.
- Mengubah aturan penilaian ujian.
- Mengubah kebijakan keamanan.
- Menambah layanan berbayar.
- Mengubah ruang lingkup MVP secara signifikan.
- Membutuhkan kredensial atau akses akun pengguna.

Jangan mengarang kredensial, data pengguna, hasil pengujian, atau status implementasi.

Jangan menganggap keberhasilan instalasi sebagai bukti bahwa seluruh aplikasi berfungsi.

---

## 20. FORMAT LAPORAN SETIAP TAHAP

Setelah menyelesaikan suatu tahap, laporkan hasil menggunakan format berikut:

### Ringkasan
Jelaskan apa yang dikerjakan.

### File yang dibuat atau diubah
Sebutkan lokasi file dan perubahan penting.

### Fitur yang selesai
Jelaskan fungsi yang benar-benar sudah diimplementasikan.

### Pengujian
Sebutkan perintah atau skenario pengujian yang dijalankan dan hasilnya.

### Masalah yang ditemukan
Jelaskan bug, keterbatasan, atau konfigurasi yang belum tersedia.

### Pekerjaan berikutnya
Sebutkan langkah lanjutan yang paling relevan.

### Status
Pilih salah satu:
- Belum dimulai.
- Sedang dikerjakan.
- Selesai sebagian.
- Selesai dan sudah diuji.
- Terhambat.

---

## 21. INSTRUKSI AWAL UNTUK SESI BARU

Saat memulai sesi baru dalam proyek ini:

1. Periksa direktori kerja.
2. Baca `AGENTS.md` dan `PRD.md`.
3. Baca `TASKS.md` jika tersedia.
4. Periksa struktur direktori dan status implementasi.
5. Identifikasi pekerjaan terakhir yang benar-benar sudah selesai.
6. Jangan mengulang pekerjaan yang sudah benar tanpa alasan.
7. Jangan menganggap pekerjaan sebelumnya selesai hanya berdasarkan catatan.
8. Sampaikan pemahaman dan rencana sebelum perubahan besar.

Jika pengguna meminta langsung mengerjakan fitur tertentu, lakukan pemeriksaan yang diperlukan lalu kerjakan fitur tersebut tanpa memaksakan pengulangan seluruh analisis proyek.

---

## 22. PRINSIP AKHIR

Prioritas utama AI Agent:

1. Mengikuti kebutuhan dalam `PRD.md`.
2. Menjaga keamanan dan integritas data.
3. Menghasilkan implementasi yang benar-benar berfungsi.
4. Memastikan hak akses sesuai peran.
5. Menguji perubahan yang dibuat.
6. Mempertahankan kode yang sudah berfungsi.
7. Melaporkan kemajuan secara jujur.
8. Menjaga dokumentasi tetap sesuai dengan implementasi.

**Jangan hanya membuat tampilan yang terlihat berfungsi. Pastikan logika, database, validasi, hak akses, dan proses bisnis benar-benar diimplementasikan serta diuji sesuai kemampuan lingkungan yang tersedia.**