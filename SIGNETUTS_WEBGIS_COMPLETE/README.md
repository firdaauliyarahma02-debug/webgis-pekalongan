# WebGIS Fasilitas Umum Pekalongan

Project WebGIS Fasilitas Umum Pekalongan berbasis **Node.js + Express**, **PostgreSQL/PostGIS**, **Mapbox GL JS**, dan data GeoJSON. Source code ini siap diunggah ke GitHub dan dapat dideploy ke hosting Node.js seperti Render dengan database PostgreSQL online seperti Supabase atau Neon.

## Fitur Utama

- Landing page WebGIS
- Peta online interaktif
- Layer sekolah, hotel, rumah sakit, dan bangunan umum
- Popup informasi fasilitas
- Pencarian lokasi dan fitur database
- Analisis rute
- Login admin
- Dashboard admin
- Pengelolaan data geospasial
- Pengelolaan layer
- Pengelolaan pengguna
- Halaman pengujian sistem

## Struktur Project

```text
SIGNETUTS_WEBGIS_COMPLETE
├── public
│   ├── assets
│   ├── qgis2web
│   ├── index.html
│   ├── script.js
│   └── style.css
│
├── scripts
│   ├── importGeojson.js
│   ├── initDb.js
│   └── resetAdminPassword.js
│
├── server.js
├── db.sql
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
├── render.yaml
└── README.md
```

## Cara Upload ke GitHub

Buka terminal di folder project, lalu jalankan:

```bash
git init
git add .
git commit -m "Initial commit WebGIS Pekalongan"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA_REPOSITORY.git
git push -u origin main
```

Ganti `USERNAME` dan `NAMA_REPOSITORY` sesuai akun GitHub.

## Cara Menjalankan di Lokal

Install dependency:

```bash
npm install
```

Buat database PostgreSQL dengan nama:

```text
webgis_pekalongan
```

Aktifkan PostGIS:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Copy `.env.example` menjadi `.env`, lalu sesuaikan `DATABASE_URL`.

Contoh lokal:

```env
PORT=3000
NODE_ENV=development
DB_SSL=false
JWT_SECRET=webgis_pekalongan_secret_2026
DATABASE_URL=postgres://postgres:password_database@localhost:5432/webgis_pekalongan
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_NAME=Administrator WebGIS
```

Inisialisasi database:

```bash
npm run db:init
```

Import data GeoJSON:

```bash
npm run db:import
```

Jalankan server:

```bash
npm run dev
```

Buka website:

```text
http://localhost:3000
```

## Akun Admin Default

```text
Username: admin
Password: admin123
```

Jika login admin gagal:

```bash
npm run admin:reset
```

## Deployment Online dengan PostgreSQL

GitHub hanya digunakan untuk menyimpan source code. Untuk menjalankan PostgreSQL dan backend online, gunakan:

```text
GitHub        = source code
Render        = backend Node.js + website
Supabase/Neon = PostgreSQL/PostGIS online
```

Di Render, isi Environment Variable:

```env
NODE_ENV=production
DB_SSL=true
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
JWT_SECRET=isi_secret_bebas_panjang
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_NAME=Administrator WebGIS
```

Setelah deploy, jalankan perintah database dari terminal lokal yang sudah memakai `DATABASE_URL` database online, atau gunakan Render Shell jika tersedia:

```bash
npm run db:init
npm run db:import
```

## Catatan Penting

- Jangan upload file `.env` ke GitHub.
- File `.env.example` aman untuk GitHub karena hanya berisi contoh.
- GitHub Pages tidak menjalankan Node.js dan PostgreSQL. Untuk versi fullstack, buka link dari Render/Railway, bukan GitHub Pages.
