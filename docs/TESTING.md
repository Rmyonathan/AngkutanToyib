# Panduan Tes Fitur — Sistem Manajemen Hauling Batubara

Dokumen ini dipakai untuk mengetes **semua fitur** sebelum aplikasi dipakai sungguhan. Ikuti urutannya dari atas ke bawah, karena data dari satu bagian dipakai di bagian berikutnya.

- Centang `[ ]` → `[x]` kalau hasilnya **sesuai**.
- Kalau tidak sesuai, tulis di [Catatan Bug](#15-catatan-bug) di bagian bawah.
- Perkiraan waktu: ± 2–3 jam untuk semuanya.

> 💡 Angka di skenario ini sengaja dibuat pasti (contoh: tonase 30 ton × Rp 75.000). Jadi setiap hasil hitungan di layar bisa dicocokkan dengan angka di dokumen ini.

---

## Daftar Isi

0. [Persiapan](#0-persiapan)
1. [Login & Navigasi](#1-login--navigasi)
2. [Master Data](#2-master-data)
3. [HPP Settings (tidak terhubung)](#3-hpp-settings-tidak-terhubung)
4. [Upload Dokumen (Supir)](#4-upload-dokumen-supir)
5. [Verifikasi Dokumen → DO dibuat (Admin)](#5-verifikasi-dokumen--do-dibuat-admin)
6. [Data DO & edit](#6-data-do--edit)
7. [Cek HPP & Profit (Buku Harian, Profitabilitas)](#7-cek-hpp--profit)
8. [Dashboard](#8-dashboard)
9. [Konsumsi Solar](#9-konsumsi-solar)
10. [Breakdown](#10-breakdown)
11. [Penagihan, Piutang & Pembayaran](#11-penagihan-piutang--pembayaran)
12. [Kas & Jurnal](#12-kas--jurnal)
13. [Laporan](#13-laporan)
14. [Settings: Audit Trail, Users & Role](#14-settings-audit-trail-users--role)
15. [Catatan Bug](#15-catatan-bug)

---

## 0. Persiapan

### 0.1 Jalankan aplikasi

```bash
npm install
npx prisma migrate reset --force   # HAPUS semua data → migration → seed (seperti migrate:fresh --seed)
# atau, kalau tidak mau menghapus data:
# npx prisma migrate deploy && npm run db:seed
npm run dev                 # buka http://localhost:3000
```

### 0.2 Akun tes (password semua: `password123`)

| Email / username | Role | Dipakai untuk |
|---|---|---|
| `owner@toyib.local` | Owner | Semua fitur |
| `admin@toyib.local` | Admin | Verifikasi (buat DO), master data, breakdown |
| `budi` | Supir (driver Budi Santoso, unit DT-01) | Upload foto |
| `finance@toyib.local` | Finance | Invoice, pembayaran, kas |
| *(dibuat di bagian 14)* | Manager | Lihat saja + verifikasi |

> Tips: pakai **2 browser** (misalnya Chrome untuk Owner/Admin dan Edge atau jendela Incognito untuk Supir/Finance) supaya tidak bolak-balik logout.
>
> Akun supir **dibuat dari Master Driver** (bagian 2.2), bukan dari menu Users. Supir login pakai **username**, bukan email.

### 0.3 Siapkan 3–4 foto apa saja

Contohnya foto kertas atau struk dari HP, untuk dipakai sebagai "Surat Jalan", "Nota Solar", dan "Nota Tol".

### 0.5 Alur baru (ringkas)

1. **Admin** siapkan master: customer + **daftar trip** (rute), driver + **akun login**, unit + **assign driver**.
2. **Supir** login → pilih **trip** → foto **Surat Jalan** (wajib) + **Nota Solar** (kalau isi solar) + nota biaya lain (opsional) dalam **satu kali kirim**. Mobil & nama supir otomatis dari akun login.
3. **Admin** buka Verifikasi → lihat foto → isi **No. tiket, tonase, KM, tarif, uang jalan, solar (liter × harga/liter)** → **DO otomatis dibuat** (status Verified).
4. DO → invoice → pembayaran seperti biasa.

### 0.4 Catat angka awal hari ini

Database mungkin sudah punya data. Buka `/dashboard` (Hari ini) sebagai Owner lalu catat angka berikut:

| Angka | Nilai awal |
|---|---|
| Cash out | Rp ________ |
| Kas masuk | Rp ________ |
| Total ritase | ________ |
| Unit breakdown | ________ |

---

## 1. Login & Navigasi

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 1.1 | Buka `http://localhost:3000` tanpa login | Diarahkan ke halaman Login | [ ] |
| 1.2 | Login dengan password salah | Muncul pesan gagal, tidak masuk | [ ] |
| 1.3 | Login `owner@toyib.local` | Masuk ke Owner Dashboard; kiri atas tertulis **Tambang Transport Abadi** · Angkutan Hauling Batubara | [ ] |
| 1.4 | Cek menu atas | Dashboard · Operasional ▾ · Master Data ▾ · Keuangan ▾ · Breakdown · Laporan · ⚙️ ▾ (kanan) | [ ] |
| 1.5 | Buka dropdown **Operasional** | Upload Dokumen, Verifikasi Dokumen, Data DO, Konsumsi Solar | [ ] |
| 1.6 | Buka dropdown **⚙️ Settings** | HPP Settings, Audit Trail, Users & Role | [ ] |
| 1.7 | Buka halaman mana saja di dalam dropdown | Tombol menu induknya menyala hitam | [ ] |
| 1.8 | Kecilkan jendela / buka di HP | Muncul tombol ☰; menu tampil per kelompok | [ ] |
| 1.9 | Klik **Logout** | Kembali ke halaman Login | [ ] |
| 1.10 | Buka alamat lama `/operations/manual`, `/operations/arsip`, `/masters/costs` | Otomatis dialihkan ke halaman pengganti, tidak error | [ ] |

---

## 2. Master Data

Login sebagai **Owner** atau **Admin**. Data tes di bawah dipakai sampai akhir dokumen.

### 2.1 Unit — `/masters/units`

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 2.1.1 | Tambah unit: No. unit **TEST-01**, plat **B 9999 TST**, merek bebas, tahun 2022, kapasitas 30 | Unit muncul di tabel, status Standby. Form **tidak** punya kolom biaya HPP (harga beli, cicilan, dll.) | [ ] |
| 2.1.2 | Tambah unit lagi dengan No. unit **TEST-01** | Ditolak (nomor unit sudah dipakai) | [ ] |
| 2.1.3 | Edit TEST-01, ubah merek, lalu simpan | Perubahan tersimpan | [ ] |

### 2.2 Driver + akun login — `/masters/drivers`

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 2.2.1 | Tambah driver: nama **Supir Test**, ID bebas, sistem gaji **Per ton**, gaji/ton **Rp 4.000**, mobil **kosongkan**. Akun login: username **supirtest**, password **supir12345** | Driver muncul; kolom Login = `supirtest`; kolom Mobil = — | [ ] |
| 2.2.2 | Tambah driver lain dengan username **budi** | Ditolak: "Username sudah dipakai akun lain" | [ ] |
| 2.2.3 | Tambah driver tanpa password | Ditolak: password wajib | [ ] |
| 2.2.4 | Buka ⚙️ → Users & Role | `supirtest` muncul sebagai role Supir / Operator; saat diedit, role terkunci | [ ] |

### 2.3 Assign driver ke unit — `/masters/units`

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 2.3.1 | Baris **TEST-01** → kolom Driver → tombol **Assign** → pilih **Supir Test** → Simpan | Driver TEST-01 = Supir Test; di Master Driver, mobil Supir Test = TEST-01 | [ ] |
| 2.3.2 | Baris **DT-01** → **Ganti** → pilih Supir Test (opsi menampilkan "sekarang di TEST-01") → Batal | Tidak ada perubahan (hanya cek label) | [ ] |
| 2.3.3 | Catatan aturan | 1 driver = 1 unit. Kalau driver di-assign ke unit lain, unit lamanya otomatis kosong | [ ] |

### 2.4 Customer + trip — `/masters/customers`

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 2.4.1 | Tambah customer: **PT Uji Coba**, lokasi muat/bongkar bebas, jarak 30 km, tarif **Rp 75.000/ton**, tempo **30 hari**. Trip: **Pit Uji → Jetty Uji**, jarak 30, tarif **kosong**, uang jalan **250.000** | Customer muncul; kolom Trip menampilkan "Pit Uji → Jetty Uji" | [ ] |
| 2.4.2 | Tambah customer tunai: **PT Tunai Test**, tarif 70.000, tempo **0**. Trip: **Rute Tunai**, uang jalan **100.000** | Tersimpan, tempo 0 (tunai) | [ ] |
| 2.4.3 | Coba simpan customer tanpa trip / dengan 2 trip bernama sama | Ditolak dengan pesan jelas | [ ] |
| 2.4.4 | Edit PT Uji Coba → tambah trip **Trip Coba** → simpan → edit lagi → hapus Trip Coba (❌) → simpan | Trip Coba hilang. (Trip yang **sudah pernah dipakai** upload/DO tidak dihapus, tapi otomatis dinonaktifkan) | [ ] |

> Tarif trip **kosong = ikut tarif customer**. Isi tarif trip hanya kalau rute itu harganya beda.

---

## 3. HPP Settings (tidak terhubung)

Login sebagai **Owner** → ⚙️ **HPP Settings** (`/settings/hpp`).

> HPP Settings saat ini **tidak dipakai** di Keuangan, Dashboard, DO maupun Master Unit — hanya disimpan untuk perhitungan HPP real nanti. Keuangan hanya menghitung biaya aktual DO (uang jalan, solar, biaya lain, gaji supir).

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 3.1 | Buka halaman | Ada kotak kuning "tidak terhubung ke Keuangan, Dashboard, DO maupun Master Unit" | [ ] |
| 3.2 | Login sebagai **Admin**, buka `/settings/hpp` | Ditolak / dialihkan (Admin tidak punya akses Keuangan secara default) | [ ] |

---

## 4. Upload Dokumen (Supir)

Login sebagai **supirtest / supir12345** (browser kedua).

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 4.1 | Setelah login | Langsung ke **Upload Dokumen**; kotak atas: **Supir Test · Mobil: TEST-01** | [ ] |
| 4.2 | Buka `/dashboard`, `/finance/kas`, `/operations/solar` lewat address bar | Dialihkan ke `/upload` | [ ] |
| 4.3 | Upload **#1**: pilih trip **Pit Uji → Jetty Uji** (dikelompokkan per customer), foto Surat Jalan, nyalakan **Isi solar** + foto nota solar, nyalakan **Ada biaya lain** + foto nota tol → Kirim | "Dokumen terkirim"; muncul di **Upload Terakhir** status *Menunggu verifikasi* | [ ] |
| 4.4 | Upload **#2**: trip **Pit Uji → Jetty Uji**, hanya foto Surat Jalan (solar **mati**) | Berhasil | [ ] |
| 4.5 | Upload **#3**: trip **Rute Tunai**, hanya foto Surat Jalan | Berhasil | [ ] |
| 4.6 | Coba kirim tanpa foto Surat Jalan, atau solar dinyalakan tapi foto solar kosong | Ditolak dengan pesan | [ ] |
| 4.7 | Upload **#4** apa saja (untuk dites reject di 5.4) | Berhasil | [ ] |

> Supir **tidak** mengetik angka apa pun — hanya pilih trip & foto. Unit dan nama supir diambil dari akun login.

---

## 5. Verifikasi Dokumen → DO dibuat (Admin)

Login sebagai **Admin** → Operasional → **Verifikasi Dokumen** (`/operations/verify`). Daftar kiri menampilkan nama trip, unit · supir, tanda "+ solar" / "+ biaya lain". Foto bisa dipindah lewat tab **Surat Jalan / Nota Solar / Biaya Lain**.

| # | Upload | Isi | Hasil yang diharapkan | OK |
|---|---|---|---|---|
| 5.1 | **#1** → jadi **DO A** | Tiket **TST-001**, Tonase **30**, KM **60**. Tarif & uang jalan sudah terisi otomatis dari trip (75.000 / 250.000). Solar: Liter **50**, Harga/Liter **6.800** → Total tampil **Rp 340.000**. Biaya lain **60.000**, keterangan "Tol" | "DO TRIP-YYYYMMDD-xxxx dibuat"; hilang dari antrian | [ ] |
| 5.2 | **#2** → **DO B** | Tiket **TST-002**, Tonase **28**, KM **60**, solar kosong | DO dibuat | [ ] |
| 5.3 | **#3** → **DO C** | Tiket **TST-003**, Tonase **20**, KM **40** (tarif otomatis 70.000, uang jalan 100.000) | DO dibuat | [ ] |
| 5.4 | **#4** | Klik **Reject**, alasan "Foto buram" | Hilang dari antrian; di HP supir status **Ditolak · Alasan: Foto buram** | [ ] |
| 5.5 | Coba verifikasi dengan tiket **TST-001** lagi | — | Ditolak: "sudah dipakai di TRIP-…" | [ ] |
| 5.6 | Coba isi liter solar tapi harga/liter kosong | — | Ditolak | [ ] |
| 5.7 | Di HP supir, lihat Upload Terakhir | — | #1–#3 status **Sudah jadi DO** + nomor DO & tonase | [ ] |

> **Solar diinput per liter:** Admin isi **liter** dan **harga / liter** dari nota; sistem menghitung **total = liter × harga/liter**. Harga/liter otomatis terisi dari **nota solar terakhir** yang diverifikasi (bisa diubah sesuai nota).

---

## 6. Data DO & edit

Buka Operasional → **Data DO** (`/operations/trips`).

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 6.1 | Lihat tabel | DO A, B, C tampil dengan Customer · Trip, tiket, tonase, rate, revenue; tidak ada tombol "Buat Trip" (DO hanya lahir dari verifikasi) | [ ] |
| 6.2 | Buka detail DO A | Ongkosan: Uang jalan 250.000, **Solar 50 L × Rp 6.800/L = 340.000**, Biaya Lain 60.000; foto Surat Jalan, Nota Solar, Nota Biaya Lain tampil | [ ] |
| 6.3 | Klik **Edit DO** pada DO A → ubah catatan, tonase tetap 30 → simpan | Tersimpan; Audit Trail mencatat "Ubah · DO" | [ ] |
| 6.4 | Edit DO B → isi Solar **20** L × **6.800** (Total tampil 136.000) → simpan → buka detail DO B | Ongkosan DO B sekarang ada Solar 20 L × Rp 6.800/L = 136.000 | [ ] |
| 6.5 | Edit DO B lagi → kosongkan liter & harga solar → simpan | Baris solar DO B hilang (kembali seperti awal) | [ ] |

---

## 7. Cek HPP & Profit

Login sebagai **Owner** → Keuangan → **Buku Harian** (`/finance/buku-harian`), hari ini.

Biaya per DO = **uang jalan + solar + biaya lain + gaji supir** (supir per ton = tonase × 4.000). Ban, maintenance, cicilan, depresiasi dan moving **tidak** ikut dihitung.

Hasil yang diharapkan (3 rit TEST-01 hari ini):

| | DO A | DO B | DO C |
|---|---:|---:|---:|
| Tonase | 30 t | 28 t | 20 t |
| **Revenue** | 30 × 75.000 = **2.250.000** | 28 × 75.000 = **2.100.000** | 20 × 70.000 = **1.400.000** |
| Supir (tonase × 4.000) | 120.000 | 112.000 | 80.000 |
| Uang jalan | 250.000 | 250.000 | 100.000 |
| Solar (nota) | 340.000 | — | — |
| Biaya lain (tol) | 60.000 | — | — |
| **Total HPP** | **770.000** | **362.000** | **180.000** |
| **Profit** | **1.480.000** | **1.738.000** | **1.220.000** |

Total TEST-01 hari ini: revenue **5.750.000**, HPP **1.312.000**, profit **4.438.000**.

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 7.1 | Buku Harian hari ini → cari baris TEST-01 | Angka per DO sama dengan tabel di atas. Kolom: Uang Jalan, Solar, Driver, Biaya Lain — **tidak ada** kolom Ban / Maint / Cicilan / Depresiasi / Moving | [ ] |
| 7.2 | Kolom Uang Jalan dan Biaya Lain terisi | 250.000 / 250.000 / 100.000 dan tol 60.000 | [ ] |
| 7.3 | Keuangan → **Profitabilitas Unit** → bulan ini → klik TEST-01 | Rincian komponen: uang jalan, solar, supir, biaya lain (tanpa ban / depresiasi / moving) | [ ] |
| 7.4 | Ubah angka apa saja di HPP Settings (mis. Depresiasi), lalu buka lagi Buku Harian | Angka **tidak berubah** (HPP Settings tidak terhubung). Kembalikan nilainya. | [ ] |

> Rumus lengkap ada di [`docs/HPP-SETTINGS.md`](HPP-SETTINGS.md).

---

## 8. Dashboard

Login sebagai **Owner** → `/dashboard`.

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 8.1 | Tabel **Performa Masing-Masing Unit** → baris TEST-01 | Rit **3**, Tonase **78**, KM **160**, Ton/km **0,49**, Solar **50 L**, Revenue **5.750.000**, HPP **1.312.000**, HPP/Ton **± 16.821**, Profit **4.438.000** | [ ] |
| 8.2 | Kartu **Produksi** | Total ritase naik **+3** dari angka awal (bagian 0.4) | [ ] |
| 8.3 | Kartu **Finansial** → Cash out | Naik **+1.000.000** dari angka awal (uang jalan 600.000 + solar 340.000 + tol 60.000) | [ ] |
| 8.4 | Rincian cash out di bawah kartu | Uang jalan / solar-biaya / breakdown / jurnal terpisah | [ ] |
| 8.5 | Profit/ton, Profit/unit, HPP/ton tampil | Angka masuk akal (profit ÷ tonase, dst.) | [ ] |
| 8.6 | Filter tombol **Kemarin**, **7 hari**, **Bulan ini**, **Bulan lalu** | Judul periode berubah; angka berubah; tombol aktif menyala | [ ] |
| 8.7 | Pilih **Bulan** (misalnya bulan ini) | Judul "September 2026 (s/d dd Sep)" | [ ] |
| 8.8 | Isi rentang **Dari–Sampai** (misalnya 25 s/d 28), lalu klik Lihat | Judul "25 Sep – 28 Sep 2026"; muncul kolom **Hari jalan** dan angka "/unit/hari" | [ ] |
| 8.9 | Tombol ← dan → | Periode bergeser; → tidak bisa melewati hari ini | [ ] |
| 8.10 | Grafik Revenue vs HPP vs Profit | 6 bulan, bulan ini paling kanan | [ ] |
| 8.11 | Kartu Total Armada | Jumlah unit dan status Running/Standby/Breakdown/Maintenance sesuai Master Unit | [ ] |

> Cash out = uang jalan **semua DO bertanggal hari ini** + solar + biaya lain + breakdown + jurnal kas keluar. Untuk data TEST: 250.000 + 250.000 + 100.000 + 340.000 + 60.000 = **1.000.000**. Breakdown (bagian 10) dan jurnal (bagian 12) nanti menambah angka ini lagi.

---

## 9. Konsumsi Solar

Login sebagai **Owner** → Operasional → **Konsumsi Solar** (`/operations/solar`).

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 9.1 | Periode hari ini, baris TEST-01 | Liter **50**, Rp **340.000**, Rp/L **6.800**, KM **160**, L/km **0,31**, km/L **3,2**, solar/ton **± 4.359** | [ ] |
| 9.2 | Status unit | BOROS / NORMAL / HEMAT dibanding rata-rata armada; "Data kurang" jika liter atau KM kosong | [ ] |
| 9.3 | Ubah ambang % (misalnya 5%) | Status bisa berubah | [ ] |
| 9.4 | Filter unit TEST-01 | Hanya TEST-01 | [ ] |
| 9.5 | Rincian harian | Ada baris TEST-01 hari ini | [ ] |
| 9.6 | Export CSV | File terbuka rapi di Excel | [ ] |

---

## 10. Breakdown

Login sebagai **Admin** → **Breakdown** (`/breakdown`).

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 10.1 | Catat breakdown TEST-01: tanggal hari ini, masalah "Ban pecah (TES)", mulai **1 jam lalu**, selesai **kosong**, biaya **1.500.000** | Tersimpan sebagai **open** | [ ] |
| 10.2 | Buka Dashboard (Owner) | Breakdown **+1**; TEST-01 status 🔴 Breakdown di Master Unit | [ ] |
| 10.3 | Dashboard → rincian cash out | Breakdown **+1.500.000** | [ ] |
| 10.4 | Edit breakdown: isi **Selesai** = 10 menit lalu | Downtime ± 50 menit terisi otomatis; TEST-01 kembali Running | [ ] |
| 10.5 | Catat breakdown dengan **selesai di masa depan** (misalnya besok) | Status tetap Breakdown sampai jam selesai lewat | [ ] |
| 10.6 | Ringkasan bulan | Total downtime, biaya, availability % berubah | [ ] |
| 10.7 | Hapus breakdown 10.5 | Terhapus; status unit kembali normal | [ ] |
| 10.8 | Profitabilitas TEST-01 bulan ini | Biaya breakdown 1.500.000 masuk HPP unit | [ ] |

---

## 11. Penagihan, Piutang & Pembayaran

Login sebagai **Finance** → Keuangan → **Penagihan & Piutang** (`/finance/piutang`).

### 11.1 Buat invoice

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 11.1.1 | Bagian "Belum ditagih" → PT Uji Coba | DO A dan B tampil (58 ton, Rp 4.350.000) | [ ] |
| 11.1.2 | Buat invoice untuk DO A + B, tanggal hari ini, tempo **30** | Invoice `INV-…` dibuat: total tonase **58**, total **4.350.000**, jatuh tempo **hari ini + 30** | [ ] |
| 11.1.3 | Cek status DO A dan B | **Sudah Ditagih** | [ ] |
| 11.1.4 | Edit DO A (Admin): tonase **30 → 31** → simpan → buka invoice | Bisa diedit (ada info kuning "sudah masuk invoice"); total invoice ikut jadi **59 t / Rp 4.425.000**. **Kembalikan ke 30** (total kembali 4.350.000) | [ ] |
| 11.1.4b | Edit DO A → pilihan Trip | Hanya trip milik **PT Uji Coba** yang muncul (customer tidak bisa diganti setelah ditagih) | [ ] |
| 11.1.5 | Buat invoice PT Tunai Test (DO C) | Jatuh tempo = tanggal invoice (tempo 0) | [ ] |

### 11.2 Pembayaran bertahap

Buka invoice PT Uji Coba (klik **Bayar** di daftar invoice).

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 11.2.1 | Halaman invoice | Ada tombol **← Kembali** di atas, nomor invoice, status, dan sisa | [ ] |
| 11.2.2 | Catat pembayaran 1: Transfer, kas masuk **2.000.000**, ref "TRF-001" | Status **Dibayar sebagian**, sisa **2.350.000** | [ ] |
| 11.2.3 | Catat pembayaran 2: centang **PPh 23 dipotong**, PPh **87.000** (2% × 4.350.000), kas masuk **2.263.000** | Status **Lunas**, sisa **0** | [ ] |
| 11.2.4 | Cek status DO A dan B | **Lunas** | [ ] |
| 11.2.5 | Coba bayar lebih dari sisa di invoice lain | Ditolak atau diberi peringatan | [ ] |
| 11.2.6 | Tombol **Cetak** invoice | Tampilan cetak rapi, tanpa menu; kop **TAMBANG TRANSPORT ABADI**; kolom **No. Tiket** dan **Tonase (t)** | [ ] |
| 11.2.7 | Setelah lunas, edit DO A (Admin): tonase **30 → 20** | **Ditolak**: total invoice jadi lebih kecil dari yang sudah dibayar | [ ] |

### 11.3 Batal invoice, ubah jatuh tempo & periode

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 11.3.1 | Invoice PT Tunai Test → tombol **Edit Invoice** → jatuh tempo +7 hari, periode **tanggal 1 s/d akhir bulan ini** → Simpan | Tersimpan; jatuh tempo & periode di invoice (dan cetakan) berubah; aging ikut berubah | [ ] |
| 11.3.1b | Edit Invoice → periode akhir sebelum periode awal | Ditolak | [ ] |
| 11.3.2 | Invoice PT Tunai Test → **Batalkan** | Status **Dibatalkan**; DO C kembali **Verified** dan muncul lagi di "Belum ditagih" | [ ] |
| 11.3.3 | Coba batalkan invoice PT Uji Coba (sudah ada pembayaran) | **Ditolak** | [ ] |
| 11.3.4 | Hapus pembayaran 2 → cek status | Kembali **Dibayar sebagian**, DO kembali **Sudah Ditagih**. Setelah itu catat ulang pembayaran 2. | [ ] |

### 11.4 Daftar piutang dan riwayat pembayaran

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 11.4.1 | Ringkasan aging (belum jatuh tempo, 1–30, 31–60, 61–90, >90) | Invoice terbuka masuk kelompok yang benar | [ ] |
| 11.4.2 | "Pembayaran Terakhir" di halaman piutang | Dua pembayaran PT Uji Coba tampil | [ ] |
| 11.4.3 | Klik **Lihat semua riwayat →** (`/finance/pembayaran`) | Filter tanggal / customer / metode berfungsi; ada total dan rekap per customer & metode | [ ] |
| 11.4.4 | Klik nomor invoice dari riwayat → tombol Kembali | Kembali ke **Riwayat Pembayaran** (bukan ke Piutang) | [ ] |
| 11.4.5 | Export CSV riwayat | File terbuka di Excel | [ ] |

---

## 12. Kas & Jurnal

Login sebagai **Finance** → Keuangan → **Kas Keseluruhan** (`/finance/kas`).

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 12.1 | Kas masuk bulan ini | Termasuk pembayaran 2.000.000 + 2.263.000 = **4.263.000** (PPh 23 87.000 **tidak** masuk kas) | [ ] |
| 12.2 | Kas keluar | Termasuk uang jalan, solar, tol, dan breakdown TEST | [ ] |
| 12.3 | Klik **Input Jurnal** | Form muncul sebagai **popup**; tabel kas tetap terlihat penuh di belakang | [ ] |
| 12.4 | Jurnal **Kas keluar**, kategori **Driver**, "Bayar gaji supir TES", **500.000** | Muncul keterangan "mengurangi kas saja"; Kas keluar +500.000; **HPP TIDAK berubah** (gaji sudah dihitung per DO) | [ ] |
| 12.4b | Jurnal Kas keluar, kategori **Maintenance**, **100.000**, unit TEST-01 | Kas keluar +100.000 **dan** HPP TEST-01 bulan ini +100.000 | [ ] |
| 12.5 | Tambah jurnal **Kas masuk** 500.000 | Kas masuk +500.000 | [ ] |
| 12.6 | Hapus ketiga jurnal tes | Angka kembali seperti semula | [ ] |
| 12.7 | Ringkasan piutang di halaman Kas | Sesuai dengan halaman Piutang | [ ] |

---

## 13. Laporan

Login sebagai **Owner** → **Laporan** (`/reports`).

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 13.1 | Filter hari ini, unit TEST-01 | KPI ritase 3, tonase 78, revenue 5.750.000 | [ ] |
| 13.2 | Tab Per DO/Trip, Rekap per Unit, Rekap per Customer, Rekap Harian | Semua tampil, angkanya konsisten | [ ] |
| 13.3 | Export Excel (CSV) tiap tab | File terbuka rapi di Excel (kolom terpisah, angka benar) | [ ] |
| 13.4 | Cetak / PDF | Tanpa navbar/filter, semua tab tercetak | [ ] |
| 13.5 | Salin URL laporan, buka di tab baru | Filter sama (URL bisa dibagikan) | [ ] |

---

## 14. Settings: Audit Trail, Users & Role

### 14.1 Audit Trail — ⚙️ → Audit Trail (`/audit`), sebagai Owner

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 14.1.1 | Daftar entri | Bahasa manusia, misalnya "Tambah · DO · TRIP-… · TEST-01 · Supir Supir Test · Trip Pit Uji → Jetty Uji (PT Uji Coba) · Tonase 30 ton" | [ ] |
| 14.1.2 | Klik entri **Ubah** DO A (dari langkah 6.3) | Kalimat "Admin Ops mengubah DO … pada …"; tabel Sebelum → Sesudah menampilkan kolom yang berubah (mis. Catatan DO) | [ ] |
| 14.1.3 | Cari entri **Tambah · Upload Dokumen Supir** dan **Ubah · Upload Dokumen Supir** (reject) | Label "Upload Supir Test 2026-…"; alasan ditolak "Foto buram" terlihat | [ ] |
| 14.1.4 | Cari entri **Tambah · Biaya Operasional** solar DO A | Volume 50 liter, Harga / liter Rp 6.800, Nominal Rp 340.000 | [ ] |
| 14.1.3 | Entri pembayaran, invoice, breakdown, jurnal, master data | Semua tercatat dengan nama yang jelas (bukan ID acak) | [ ] |
| 14.1.4 | Filter Data / Aksi / User / tanggal | Berfungsi | [ ] |
| 14.1.5 | "Data teknis (untuk developer)" | Menampilkan data mentah | [ ] |

### 14.2 Users — ⚙️ → Users & Role (`/users`), sebagai Owner

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 14.2.1 | Tambah user **manager@toyib.local**, role **Manager**, password `password123` | User muncul, aktif. Pilihan role **tidak** ada "Operator / Supir" (akun supir dibuat dari Master Driver) | [ ] |
| 14.2.2 | Reset password user Manager | Login dengan password baru berhasil, yang lama gagal | [ ] |
| 14.2.3 | Nonaktifkan user Manager saat ia sedang login di browser lain | Sesi Manager berakhir (± 1 menit); login lagi ditolak | [ ] |
| 14.2.4 | Aktifkan kembali | Bisa login lagi | [ ] |
| 14.2.5 | Coba nonaktifkan akun sendiri (Owner) | **Ditolak** | [ ] |

### 14.3 Hak akses default per role

Login dengan tiap akun, lalu buka alamat berikut lewat address bar. ✅ = bisa dibuka, ⛔ = dialihkan / ditolak.

| Halaman | Owner | Manager | Admin | Finance | Operator |
|---|:-:|:-:|:-:|:-:|:-:|
| `/dashboard` | ✅ | ✅ | ✅ | ✅ | ⛔ |
| `/upload` | ✅ | ⛔ | ✅ | ⛔ | ✅ |
| `/operations/trips` (lihat) | ✅ | ✅ | ✅ | ✅ | ⛔ |
| Edit DO | ✅ | ⛔ | ✅ | ⛔ | ⛔ |
| `/operations/verify` | ✅ | ✅ | ✅ | ⛔ | ⛔ |
| `/operations/solar` | ✅ | ✅ | ✅ | ✅ | ⛔ |
| `/masters/units` (lihat) | ✅ | ✅ | ✅ | ✅ | ⛔ |
| Tambah / edit master | ✅ | ⛔ | ✅ | ⛔ | ⛔ |
| `/breakdown` (lihat) | ✅ | ✅ | ✅ | ⛔ | ⛔ |
| Input breakdown | ✅ | ⛔ | ✅ | ⛔ | ⛔ |
| `/finance/*` (lihat) | ✅ | ✅ | ⛔ | ✅ | ⛔ |
| Buat invoice / catat bayar | ✅ | ⛔ | ⛔ | ✅ | ⛔ |
| Jurnal kas & ubah HPP Settings | ✅ | ⛔ | ⛔ | ✅ | ⛔ |
| `/reports` | ✅ | ✅ | ✅ | ✅ | ⛔ |
| `/audit` | ✅ | ✅ | ✅ | ⛔ | ⛔ |
| `/users` | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |

| # | Cek | OK |
|---|---|---|
| 14.3.1 | Semua sel tabel di atas sesuai untuk **Owner** | [ ] |
| 14.3.2 | … untuk **Manager** | [ ] |
| 14.3.3 | … untuk **Admin** | [ ] |
| 14.3.4 | … untuk **Finance** | [ ] |
| 14.3.5 | … untuk **Operator** | [ ] |
| 14.3.6 | Menu di navbar hanya menampilkan yang boleh dibuka | [ ] |
| 14.3.7 | Tombol tambah/edit/hapus tersembunyi untuk role yang hanya boleh melihat | [ ] |

### 14.4 Editor role

| # | Langkah | Hasil yang diharapkan | OK |
|---|---|---|---|
| 14.4.1 | Di `/users` → tabel hak akses, kolom **Admin** → centang **Lihat Keuangan & HPP** → Simpan | Muncul tanda "diubah" | [ ] |
| 14.4.2 | Login sebagai Admin (atau tunggu ± 1 menit lalu refresh) | Menu **Keuangan** muncul; `/finance/kas` bisa dibuka tapi **tidak** bisa tambah jurnal atau invoice | [ ] |
| 14.4.3 | Centang **Penagihan & Pembayaran** untuk Admin | "Lihat Keuangan" ikut tercentang otomatis | [ ] |
| 14.4.4 | Hilangkan centang "Lihat Keuangan" | Izin yang bergantung padanya ikut hilang | [ ] |
| 14.4.5 | Klik **Default** di kolom Admin | Kembali ke bawaan (tanpa Keuangan) | [ ] |
| 14.4.6 | Kolom **Owner** | Semua tercentang dan tidak bisa diubah | [ ] |
| 14.4.7 | Audit Trail | Perubahan role tercatat ("Hak Akses Role · Admin") | [ ] |

---

## Setelah selesai

- [ ] Hapus / nonaktifkan data tes (TEST-01, Supir Test, PT Uji Coba, PT Tunai Test, user Manager) jika tes dilakukan di database produksi. Unit/driver yang sudah punya trip mungkin tidak bisa dihapus; ubah saja namanya jadi "(TES) …" atau nonaktifkan.
- [ ] Kembalikan hak akses role ke **Default** jika tadi diubah.

---

## 15. Catatan Bug

| No | Bagian (misalnya 6.2.1) | Langkah | Yang terjadi | Yang seharusnya | Screenshot | Prioritas (Tinggi / Sedang / Rendah) |
|---|---|---|---|---|---|---|
| 1 | | | | | | |
| 2 | | | | | | |
| 3 | | | | | | |

**Prioritas:**
- **Tinggi** = angka uang salah, data hilang, orang bisa membuka halaman yang seharusnya dilarang.
- **Sedang** = fitur tidak jalan tapi ada cara lain.
- **Rendah** = tampilan / typo.
