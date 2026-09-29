# Penjelasan Keuangan, HPP Settings, dan Piutang

> **Status saat ini:** **HPP Settings tidak terhubung ke mana pun.** Keuangan (Buku Harian, Profitabilitas, Kas, Dashboard) hanya menghitung **biaya aktual per DO** dan **kas yang benar-benar masuk / keluar**. Ban, maintenance, cicilan, depresiasi dan moving dari HPP Settings **tidak** ikut dihitung, dan form Master Unit tidak lagi punya kolom biaya HPP. HPP Settings disimpan untuk perhitungan HPP real nanti (mis. evaluasi tahunan).

Rumus keuangan ada di `src/lib/finance/do-hpp.ts` dan `src/lib/finance/get-financial-hpp.ts`.

---

## 1. Dua cara melihat uang: Laba-rugi vs Kas

| | **Laba-rugi** (Buku Harian, Profitabilitas, Dashboard) | **Kas** (Kas Keseluruhan) |
|---|---|---|
| Pertanyaan | "DO ini untung berapa?" | "Uang di rekening/brankas nambah atau berkurang berapa?" |
| Pendapatan diakui | Saat DO dibuat / **Verified** (tonase × tarif) | Saat customer **benar-benar bayar** (dicatat di Penagihan & Piutang) |
| Biaya | Biaya aktual DO + breakdown + jurnal kas keluar | Uang yang benar-benar keluar |

Contohnya, DO di bulan Oktober dengan tempo 30 hari. Labanya tampil di **Oktober**, tapi uangnya baru masuk Kas di **November**. Selisih di antara keduanya adalah **Piutang**.

---

## 2. Cara biaya satu DO dihitung

```
Biaya DO = Uang jalan + Solar (liter × harga/liter) + Biaya lain + Gaji supir
Laba DO  = Tonase × Tarif − Biaya DO
```

- **Uang jalan**: dari trip customer (bisa diubah saat verifikasi / Edit DO).
- **Solar**: liter × harga/liter dari nota yang diverifikasi. Harga/liter otomatis terisi dari **nota solar terakhir** (bisa diubah).
- **Biaya lain**: tol, parkir, dll. dari foto biaya lain.
- **Gaji supir** (Master Driver):

| Sistem | Rumus per DO |
|---|---|
| **PER_TON** | Tonase × Tarif supir/ton |
| **DAILY** | Gaji harian × porsi harian |
| **MONTHLY** | Gaji bulanan ÷ 25 hari kerja × porsi harian |

**Porsi harian** = 1 ÷ jumlah DO supir tersebut di tanggal yang sama. Kalau supir jalan 2 rit dalam sehari, gaji harian dibagi 2, tidak dibebankan penuh ke masing-masing rit.

Biaya lain yang juga masuk laba-rugi bulan itu (tidak per DO):
- **Solar / biaya lain tanpa DO**
- **Breakdown**: biaya perbaikan dari Breakdown History
- **Jurnal kas keluar** manual (servis, beli ban, bayar cicilan, sewa, dll.)

### Contoh angka

DO: tonase 30 t × tarif Rp 75.000 = **pendapatan Rp 2.250.000**. Uang jalan Rp 250.000, solar 50 L × Rp 6.800 = Rp 340.000, tol Rp 60.000, supir PER_TON Rp 4.000/ton.

| Komponen | Rp |
|---|---:|
| Uang jalan | 250.000 |
| Solar (50 × 6.800) | 340.000 |
| Tol | 60.000 |
| Supir (30 × 4.000) | 120.000 |
| **Total biaya** | **770.000** |
| **Laba kotor** | **1.480.000** (65,8%) |

```
HPP/ton    = Total biaya ÷ Tonase = 770.000 ÷ 30 = Rp 25.667/ton
Profit/ton = Laba ÷ Tonase        = 1.480.000 ÷ 30 = Rp 49.333/ton
```

Biaya truk (ban, servis, cicilan) masuk laba-rugi **saat dibayar**, lewat jurnal kas keluar di halaman Kas.

---

## 3. Apa yang masuk Kas

| Kas **masuk** | Kas **keluar** |
|---|---|
| Pembayaran invoice (nominal yang diterima, **setelah** dipotong PPh 23) | Uang jalan setiap DO (tanggal DO) |
| Jurnal kas masuk manual | Solar & biaya lain yang diverifikasi |
| | Biaya perbaikan breakdown |
| | Jurnal kas keluar manual |

Jurnal diinput lewat tombol **Input Jurnal** (popup) di halaman Kas. Jangan catat ulang uang jalan / solar / tol / breakdown di jurnal — itu sudah otomatis.

Jurnal kas keluar **kategori Driver** (bayar gaji supir) hanya mengurangi Kas, **tidak** masuk laba-rugi lagi, karena gaji supir sudah dihitung per DO. Kategori lain (servis, ban, cicilan, sewa, dll.) mengurangi Kas **dan** masuk laba-rugi.

---

## 4. HPP Settings (belum dipakai)

Halaman **⚙️ Settings → HPP Settings** tetap ada dan bisa diisi, tapi **tidak mempengaruhi angka apa pun** di aplikasi. Variabelnya disiapkan untuk perhitungan HPP real nanti:

| Variabel | Satuan | Rumus per hari (untuk nanti) |
|---|---|---|
| Harga Solar | Rp/liter | referensi |
| Harga Ban (set) ÷ Umur Ban | Rp ÷ hari operasi | biaya ban per hari |
| Hari Operasi / Bulan | hari | pembagi biaya bulanan |
| Budget Maintenance / bln | Rp/bulan | ÷ hari operasi |
| Cicilan Default / bln | Rp/bulan | ÷ hari operasi |
| Depresiasi Default / hari | Rp/hari | langsung |
| Moving Cost / periode | Rp/bulan | ÷ hari operasi |

**Depresiasi** (untuk evaluasi tahunan): `(Harga beli − Nilai residu) ÷ Umur ekonomis (hari truk jalan)`. Contoh (850 jt − 150 jt) ÷ 1.500 hari = Rp 466.667 / hari jalan. Umur ekonomis dihitung dari hari truk **jalan** (5 thn × ±300 = 1.500), bukan hari kalender.

> Jangan pakai Cicilan **dan** Depresiasi sekaligus untuk truk yang sama — keduanya mewakili biaya truk yang sama.

---

## 5. Alur pembayaran tempo (Penagihan & Piutang)

```
Upload supir → Verifikasi (DO dibuat, VERIFIED) → SUDAH DITAGIH → LUNAS
                     │                                  │             │
            pendapatan diakui                  invoice dibuat     kas masuk
            piutang "belum ditagih"      jatuh tempo = tgl invoice + tempo
```

1. **Master Customer → Tempo (hari)**: misalnya 30. Isi 0 untuk tunai.
2. DO **Verified**: pendapatan masuk laba-rugi dan tampil sebagai *Belum Ditagih* di Piutang. Kas belum berubah.
3. **Finance → Penagihan & Piutang**: centang DO per customer, lalu klik **Buat Invoice**. DO menjadi *Sudah Ditagih*.
4. **Edit Invoice** (tombol di halaman invoice): ubah **jatuh tempo** dan **periode** tagihan. Periode hanya keterangan di invoice; daftar DO & total tidak berubah.
5. Saat customer transfer, buka invoice lalu **Catat Pembayaran**. Isi nominal yang diterima dan PPh 23 jika dipotong.
   - Pembayaran sebagian (cicil) → status invoice *Sebagian*.
   - Pembayaran penuh → invoice *Lunas* dan DO ikut *Lunas*.
6. Nominal yang diterima masuk **Kas** pada **tanggal pembayaran**.

**Koreksi DO setelah ditagih.** DO bisa diedit di semua status (Verified, Sudah Ditagih, Lunas). Kalau DO sudah masuk invoice:
- total invoice (tonase & tagihan) dihitung ulang otomatis, status ikut menyesuaikan (mis. Lunas → Sebagian kalau tagihan naik);
- trip hanya bisa diganti ke rute **customer yang sama**;
- sistem menolak kalau total invoice jadi lebih kecil dari yang sudah dibayar — hapus / koreksi pembayarannya dulu.

**PPh 23 (2%).** Banyak customer korporat memotong 2% dari tagihan. Contoh: tagihan Rp 2.250.000, dipotong Rp 45.000, transfer Rp 2.205.000.
- Kas masuk Rp 2.205.000.
- Invoice tetap lunas karena potongan dianggap sudah dibayar.
- Minta **bukti potong** dari customer; itu kredit pajak Anda, bukan kerugian.

**Aging piutang** (di halaman Piutang) menunjukkan berapa yang belum jatuh tempo, telat 1–30, 31–60, 61–90, dan lebih dari 90 hari. Tagih yang merah dulu.

Contoh garis waktu (tempo 30 hari):

| Tanggal | Kejadian | Laba-rugi | Kas | Piutang |
|---|---|---:|---:|---:|
| 1 Okt | Upload supir diverifikasi → DO dibuat | +2.250.000 pendapatan, −770.000 biaya | −650.000 (uang jalan, solar, tol) | +2.250.000 |
| 5 Okt | Invoice dibuat, jatuh tempo 4 Nov | — | — | (pindah ke "invoice") |
| 3 Nov | Customer transfer + PPh 23 | — | **+2.205.000** | 0 |

Gaji supir (Rp 120.000) masuk laba-rugi saat DO dibuat; kasnya keluar saat gaji dibayar dan dicatat sebagai jurnal kas keluar kategori Driver.

---

## 6. Belum ditangani (sadar & terencana)

- **PPN 11%**: invoice belum menambahkan PPN atau membuat faktur pajak.
- **HPP real** dari HPP Settings (ban, maintenance, cicilan, depresiasi, moving) — belum dihubungkan.
- **Hutang gaji supir**: gaji dihitung di laba-rugi, tapi sistem belum melacak "gaji terhutang vs sudah dibayar" per supir.
