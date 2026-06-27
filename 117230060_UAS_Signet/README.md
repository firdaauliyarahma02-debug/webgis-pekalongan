# WebGIS Fasilitas Umum Pekalongan

Versi ini dibuat untuk **GitHub Pages + Supabase PostgreSQL/PostGIS**.
Tidak memakai Render, Koyeb, localhost, atau backend Node.js.

## Struktur

```text
webgis-pekalongan
├── index.html
├── style.css
├── script.js
├── supabase-config.js
├── supabase-setup.sql
├── assets
│   └── geojson
└── qgis2web
```

## Cara Pakai Online

1. Buka Supabase > SQL Editor.
2. Copy semua isi `supabase-setup.sql`, lalu klik Run.
3. Buka Supabase > Authentication > Users > Add user.
4. Buat user:
   - Email: `admin@webgis.local`
   - Password: `admin123`
   - Auto confirm: aktifkan jika tersedia.
5. Buka Supabase > Project Settings > API.
6. Copy `Project URL` dan `anon public key`.
7. Buka `supabase-config.js`, isi:

```js
window.SUPABASE_CONFIG = {
  url: "PROJECT_URL_SUPABASE",
  anonKey: "ANON_PUBLIC_KEY_SUPABASE",
  adminEmail: "admin@webgis.local"
};
```

8. Upload semua file ke GitHub repository.
9. Aktifkan GitHub Pages dari branch `main` dan folder `/root`.
10. Buka link GitHub Pages.

## Login Admin

```text
Username: admin
Password: admin123
```

## Mengisi Data PostgreSQL

Peta tetap tampil dari GeoJSON jika database masih kosong. Agar data tersimpan di PostgreSQL/PostGIS:

1. Login admin.
2. Buka menu `Data Geospasial`.
3. Pilih layer.
4. Klik `Sinkron GeoJSON ke Supabase`.
5. Ulangi untuk layer Hotel, Rumah Sakit, Sekolah, dan Bangunan Umum.

Catatan: layer Bangunan Umum berisi ribuan data, jadi proses sinkronisasi bisa lebih lama.

## Catatan Keamanan

File yang boleh dipasang di GitHub hanya `SUPABASE_URL` dan `SUPABASE_ANON_KEY`.
Jangan pernah memasang password database, connection string, atau service role key di GitHub.

## Fitur Tambahan Revisi

- Statistik data per layer dan total data.
- Ganti basemap: Streets, Light, Satellite Streets, dan Dark.
- Fasilitas terdekat berdasarkan titik tengah peta atau lokasi pengguna.
- Ukur jarak lurus antar dua titik.
- Download data per layer dalam format GeoJSON dan CSV.
- Fullscreen peta.
- Cetak peta untuk dokumentasi laporan.
- Zoom semua layer.

Fitur tambahan ini berjalan langsung di GitHub Pages dan tetap menggunakan Supabase PostgreSQL/PostGIS jika konfigurasi Supabase sudah diisi.


## Revisi fitur tambahan

- Mode akses pengunjung ditampilkan pada topbar sebagai tanda user biasa.
- Tombol ☰ Fitur diposisikan di pojok kanan atas.
- Analisis rute dilengkapi Simulasi Perjalanan, yaitu visualisasi seperti video dengan marker kendaraan/jalan kaki yang bergerak dari titik A ke titik B.
- Simulasi perjalanan mengikuti mode Driving atau Walking dan memakai rute yang sudah dihitung.


## Revisi UAS

Nama paket final: `117230060_UAS_Signet.zip`. Revisi ini menghapus background lingkaran putih pada marker kendaraan simulasi dan mengganti ikon mode pengunjung menjadi ikon profil.
