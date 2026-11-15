# MidPoint — PRD

Nov 14, 2026 · @chulo

## 1. Overview & Theme Fit

MidPoint adalah AI mediator yang menyelesaikan perselisihan angka antara dua pihak (harga, rate, split biaya) dengan cara: kedua pihak submit posisi secara independen dan buta (blind) terhadap posisi lawan, lalu sistem menampilkan titik tengah yang adil lengkap dengan alasan dari AI dan draft pesan siap kirim.

Ini menjawab tema "Zero-CAC IT product" secara struktural, bukan cuma insentif sosial: produk ini **tidak bisa menghasilkan apa pun** kalau cuma dipakai 1 orang. Pihak pertama wajib membagikan link ke pihak kedua supaya hasil bisa muncul — sharing bukan fitur tambahan, tapi syarat produk berfungsi.

## 2. Problem Statement & Positioning

**Masalah:** setiap kali dua orang beda pendapat soal satu angka (harga, rate, split biaya, pembagian kerja), pihak yang menyebut angka duluan ada di posisi lemah — ujungnya tawar-menawar lambat atau salah satu pihak diam-diam rugi.

**Target pengguna:** siapa pun yang sedang menyelesaikan satu keputusan angka antara dua pihak — freelancer-klien, split tagihan berdua, pembagian anggaran antar co-founder, dll. Engine-nya sengaja digeneralisasi (bukan niche ke 1 profesi) supaya tetap relevan buat kriteria "World Impact" (berlaku ke setiap orang).

**Positioning:** "AI mediator netral yang dipercaya kedua pihak, karena satu sisi tidak pernah bisa melihat/mengunci posisi sisi lain sebelum keduanya submit."

**Kenapa dua sisi, bukan satu sisi seperti Vetly:** Vetly menjawab "apakah tawaran ini adil buat SAYA" dari sudut pandang 1 orang. MidPoint menjawab "apa angka yang adil buat KITA BERDUA" — pergeseran dari "second opinion pribadi" ke "wasit bersama" inilah yang membuat produk secara mekanik butuh 2 pengguna buat menghasilkan apa pun.

## 3. User Flow

Satu URL dipakai berulang untuk A maupun B — isinya berubah sesuai siapa yang sudah submit.

&#91;embedded content: Create → link → B submits → reveal, 1 decision point\]

Selama B belum submit, A hanya melihat status "menunggu"; begitu B submit, kedua pihak langsung melihat hasil yang sama di URL yang sama.

**Detail langkah:**

1. A buka `/`, isi angka + alasan, klik submit → server bikin session, redirect ke `/r/[id]`
2. A menyalin link `/r/[id]` dan mengirimkannya ke B (di luar sistem — WhatsApp, dsb)
3. B buka `/r/[id]`, melihat status "menunggu B", isi form angka + alasan versi dia — angka A **tidak ditampilkan** ke B (blind reveal)
4. Setelah B submit, server hitung midpoint (deterministic) + panggil DeepSeek 2x (rationale, draft pesan)
5. `/r/[id]` untuk A maupun B berubah ke state "revealed": tampilkan kedua posisi awal, titik tengah, alasan, draft pesan siap kirim
6. **Role detection (perbaikan dari draft awal):** karena A dan B memakai URL yang sama, sistem butuh cara membedakan siapa yang sedang buka halaman. Solusinya: saat A submit di `/`, server generate `ownerToken` acak dan redirect A ke `/r/[id]?t=<ownerToken>` (link privat, cuma buat A). Link yang dibagikan ke B tetap `/r/[id]` polos tanpa token. Request dengan token valid = A (lihat WaitingPanel/ResultPanel), request tanpa token = B (lihat PositionForm sebelum submit, ResultPanel sesudahnya). Tanpa ini, kalau A buka linknya sendiri dari device/browser lain tanpa token, sistem bisa salah anggap dia B dan menimpa slot posisi B.

## 4. Pages & Components

Hanya 2 route, tidak ada auth, tidak ada halaman tambahan.

| Route | Komponen | Fungsi |
| --- | --- | --- |
| `/` | `CreateForm` | Input angka + alasan singkat, tombol "Buat Link" |
| `/r/[id]` — state waiting-for-B | `WaitingPanel` | Ditampilkan ke A sebelum B submit — tombol salin link + status |
| `/r/[id]` — state waiting-for-B (dibuka B) | `PositionForm` | Ditampilkan ke B — input angka + alasan versi dia |
| `/r/[id]` — state revealed | `ResultPanel` | 2 kolom: kiri = posisi A & B + titik tengah + alasan AI, kanan = draft pesan siap kirim (tombol salin) |

Aturan UI wajib (dari rubrik juri):

- Tidak ada login / registrasi / payment sama sekali
- 1 CTA jelas tiap state halaman, jangan multi-fungsi dalam satu layar
- Semua tombol yang didemokan ke juri harus benar-benar terhubung ke backend asli, bukan dummy

## 5. Data Model (Neon + Drizzle)

Satu tabel saja untuk MVP.

```ts
export const negotiations = pgTable('negotiations', {
  id: text('id').primaryKey(), // nanoid, dipakai di URL /r/[id]
  createdAt: timestamp('created_at').defaultNow(),

  offerA: integer('offer_a').notNull(),
  reasonA: text('reason_a').notNull(),

  offerB: integer('offer_b'),       // null sampai B submit
  reasonB: text('reason_b'),

  midpoint: integer('midpoint'),           // diisi setelah B submit
  rationale: text('rationale'),            // dari DeepSeek
  draftMessage: text('draft_message'),     // dari DeepSeek
});
```

**Tambahan field (menyertai role detection di bagian 3):** `negotiations` perlu kolom `ownerToken: text('owner_token').notNull()` — diisi random string saat row dibuat, dipakai untuk membedakan akses A vs B.

Status halaman diturunkan dari data, bukan kolom terpisah: `offerB === null` → waiting, `offerB !== null && midpoint === null` → sedang dihitung (biasanya sekejap), `midpoint !== null` → revealed.

## 6. Core Engine (Deterministic)

Logic murni, tidak bergantung LLM — ini bagian yang testable dan jadi nilai plus "test coverage" di rubrik juri.

```ts
function computeMidpoint(offerA: number, offerB: number) {
  const midpoint = Math.round((offerA + offerB) / 2);
  const gapPct = Math.abs(offerA - offerB) / Math.max(offerA, offerB);
  const confidence = gapPct < 0.15 ? 'close' : gapPct < 0.4 ? 'moderate' : 'wide';
  return { midpoint, gapPct, confidence };
}
```

Versi MVP pakai **simple average** dulu (bukan weighted by "kekuatan alasan") — ini keputusan sadar untuk menjaga waktu; weighting bisa jadi stretch goal kalau masih ada waktu Minggu malam.

**Smoke test minimal** (biar kriteria "test coverage" kecentang):

| Offer A | Offer B | Expected midpoint | Expected confidence |
| --- | --- | --- | --- |
| 2000 | 1200 | 1600 | wide |
| 500 | 450 | 475 | close |
| 100 | 100 | 100 | close |
| 1000 | 0 | 500 | wide |

## 7. LLM Integration (DeepSeek, Edges-Only)

Sama seperti pola Vetly — LLM tidak pernah menyentuh perhitungan angka, cuma dipakai di 2 titik:

**Titik 1 — Rationale** (dipanggil sekali setelah `computeMidpoint`) Prompt: beri konteks offerA + reasonA + offerB + reasonB + midpoint + confidence → minta penjelasan 2-3 kalimat kenapa titik ini masuk akal buat KEDUA pihak, nada netral, tidak memihak.

**Titik 2 — Draft Message** Prompt: dari rationale yang sama → buat 1 draft pesan singkat yang bisa langsung dikirim A ke B (atau sebaliknya) untuk menutup kesepakatan di angka midpoint.

Kedua panggilan jalan di server (Route Handler). API key DeepSeek disimpan di Vercel Environment Variables (bukan prefix `NEXT_PUBLIC_`), tidak pernah masuk ke client bundle.

**Fallback wajib:** kalau API DeepSeek gagal/timeout, tetap tampilkan midpoint dari engine deterministic + rationale template statis ("Titik tengah ini mencerminkan rata-rata kedua posisi") — supaya juri yang test langsung tidak melihat error.

## 8. Tech Stack & API Routes

**Stack:** Next.js (App Router) · Neon Postgres + Drizzle ORM · DeepSeek API · Deploy ke Vercel (akun pribadi, env var diatur di Vercel Dashboard, bukan lewat container HackOnVibe)

**API Routes:**

| Route | Method | Fungsi |
| --- | --- | --- |
| `/api/negotiations` | POST | Buat session baru dari input A → return `id` |
| `/api/negotiations/[id]` | GET | Ambil state saat ini (dipakai `/r/[id]` untuk render status) |
| `/api/negotiations/[id]/respond` | POST | Submit input B → trigger `computeMidpoint` + 2 panggilan DeepSeek → simpan hasil |

## 9. Judging Criteria Alignment

| Kriteria Juri | Bagaimana MidPoint Menjawabnya |
| --- | --- |
| Business Success (investor tertarik, bisa cuan) | Use case jelas (nego 2 pihak), model freemium/B2B kecil di Questionnaire |
| World Impact (berlaku ke SETIAP orang) | Engine generik "two-party numeric disagreement", bukan niche ke 1 profesi/negara |
| MVP works / no login-registrasi-payment | 2 halaman, 1 fungsi, langsung bisa dites tanpa akun |
| Hindari "banyak fitur" | Sengaja cuma 1 fungsi inti: resolve 1 angka lewat blind-reveal |
| Test coverage | Smoke test di core engine (lihat bagian 6) |
| Real backend, bukan stub | Neon Postgres asli, DeepSeek call asli — bukan data dummy |
| Sequence of GitHub commits | Commit per milestone kecil (lihat bagian 10), bukan 1 commit besar di akhir |
| Video: successful client path | Script video (bagian 11) nunjukin klik demi klik, tanpa cerita rencana/market overview |

## 10. Build Plan / Milestones (sisa waktu, mulai Sabtu malam)

| Blok Waktu | Target | Commit Checkpoint |
| --- | --- | --- |
| Sabtu malam (2-3 jam) | Scaffold Next.js + Drizzle schema + 2 route kosong, konfirmasi akses repo & env Vercel jalan | `chore: scaffold + schema` |
| Minggu pagi-siang (5-6 jam) | Core engine (`computeMidpoint`) + smoke test lolos semua + UI `CreateForm` & `WaitingPanel` jalan dengan data asli (belum LLM) | `feat: deterministic engine + create/waiting flow` |
| Minggu sore (3-4 jam) | `PositionForm` untuk B + integrasi DeepSeek 2 titik + fallback kalau API gagal | `feat: B flow + DeepSeek rationale/draft` |
| Minggu malam (2-3 jam) | `ResultPanel` 2 kolom + polish UI (referensi tampilan Vetly) + deploy final | `feat: result panel + polish` |
| Minggu malam-Senin dini hari (1-2 jam buffer) | Video demo + Questionnaire + submit | — |

Total realistis: \~13-18 jam kerja aktif dalam window \~1,5 hari yang tersisa.

## 11. Demo Video Script Outline (5 menit)

Juri eksplisit menilai negatif kalau video cerita rencana/market overview. Semua 5 menit ini HARUS nunjukin klik langsung ke produk.

| Menit | Yang Ditunjukkan |
| --- | --- |
| 0:00-0:30 | Buka `/`, isi contoh angka + alasan (1 skenario konkret, misal split biaya), klik "Buat Link" |
| 0:30-1:00 | Tunjukkan link yang dihasilkan, salin ke clipboard (momen "sharing wajib"-nya) |
| 1:00-1:30 | Buka link itu di tab/browser baru (simulasi jadi B), tunjukkan angka A TIDAK terlihat |
| 1:30-2:00 | Isi posisi B, submit |
| 2:00-3:30 | Tunjukkan hasil reveal: titik tengah, alasan dari AI, draft pesan — scroll pelan biar juri lihat semuanya |
| 3:30-4:15 | Balik ke tab A, refresh, tunjukkan A juga langsung lihat hasil yang sama |
| 4:15-5:00 | 1 kalimat penutup soal kenapa ini zero-CAC (produk tidak bisa jalan tanpa 2 orang) — JANGAN masuk ke rencana bisnis di sini, itu tempatnya di Questionnaire |

## 12. Questionnaire Draft Answers (≤300 karakter per jawaban)

Catatan: pertanyaan pasti ada di Discord kamu — ini draft jawaban generik berdasarkan 4 poin yang disebut di halaman HackOnVibe ("Product vision"), tinggal sesuaikan ke kalimat pertanyaan asli.

**Core functionality & user flow:** MidPoint menyelesaikan nego angka antara 2 pihak. A isi posisi, dapat link, kirim ke B. B isi posisi tanpa lihat angka A. Begitu lengkap, AI tampilkan titik tengah adil + alasan ke keduanya bersamaan.

**AI-powered features & integrations:** DeepSeek dipakai di 2 titik: menjelaskan kenapa titik tengah adil, dan membuat draft pesan siap kirim. Perhitungan titik tengahnya sendiri deterministic, bukan hasil LLM, supaya konsisten dan bisa diuji.

**Business model & monetization:** Freemium: hasil dasar gratis. Berbayar untuk breakdown detail, riwayat nego, dan export PDF — ditargetkan ke freelancer/agency kecil yang nego berulang kali per bulan.

**Go-to-market / first-user acquisition:** Distribusi bawaan dari produk: tiap sesi butuh 2 orang, jadi tiap pemakaian otomatis membawa 1 user baru. Awal, dorong lewat komunitas freelancer dan grup split-biaya.

## 13. Open Risks & Decisions Needed

- Resolved (konfirmasi juri, 15 Nov): key/secret disimpan di Vercel Environment Variables (bukan `NEXT_PUBLIC_`), submission wajib sertakan URL live produk, dan seluruh commit history wajib ada di repo yang HackOnVibe issue
- Repo & deploy: sambungkan repo yang di-issue ke Vercel project pribadi lewat GitHub integration Vercel — commit tetap push ke repo issued, deploy otomatis jalan dari situ, URL Vercel itu yang disertakan di submission
- **Algoritma midpoint**: versi MVP pakai simple average; weighted-by-reasoning-strength adalah stretch goal kalau waktu Minggu malam masih ada
- **Live gauge / progress bar** di halaman `WaitingPanel` (ide dari referensi Vetly): opsional, dikerjakan terakhir kalau waktu cukup
- **Nama produk**: "MidPoint" dipakai sebagai nama kerja final
