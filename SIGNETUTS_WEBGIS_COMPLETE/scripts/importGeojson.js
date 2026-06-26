const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const useSsl = process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});

const files = [
  { layer: 'bangunan', file: '../public/assets/geojson/Bangunan umum lainnya.geojson' },
  { layer: 'hotel', file: '../public/assets/geojson/Hotel.geojson' },
  { layer: 'rs', file: '../public/assets/geojson/Rumah_Sakit.geojson' },
  { layer: 'sekolah', file: '../public/assets/geojson/Sekolah.geojson' }
];

function valueOf(props, keys) {
  for (const key of keys) {
    if (props[key] !== undefined && props[key] !== null && String(props[key]).trim() !== '') {
      return String(props[key]).trim();
    }
  }
  return null;
}

function addressOf(props) {
  const parts = [
    valueOf(props, ['addr:street', 'addr_stree', 'addr_street']),
    valueOf(props, ['addr:housenumber', 'addr_house']),
    valueOf(props, ['addr:city', 'addr_city']),
    valueOf(props, ['addr:postcode', 'addr_postcode'])
  ].filter(Boolean);
  return parts.join(', ') || null;
}

async function importOne(client, layer, filePath) {
  const abs = path.resolve(__dirname, filePath);
  if (!fs.existsSync(abs)) throw new Error(`File tidak ditemukan: ${abs}`);

  const geojson = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const features = geojson.features || [];

  await client.query('DELETE FROM webgis_features WHERE layer_key = $1', [layer]);

  let inserted = 0;
  for (const ft of features) {
    const props = ft.properties || {};
    const name = valueOf(props, ['name', 'nama', 'Nama', 'NAMA']) || `${layer}-${inserted + 1}`;
    const phone = valueOf(props, ['phone', 'contact:phone', 'telepon']);
    const website = valueOf(props, ['website', 'url']);
    const address = addressOf(props);

    // Seluruh data contoh berupa MultiPolygon. Bila nanti ada Polygon, ubah menjadi MultiPolygon.
    let geom = ft.geometry;
    if (!geom) continue;
    if (geom.type === 'Polygon') {
      geom = { type: 'MultiPolygon', coordinates: [geom.coordinates] };
    }
    if (geom.type !== 'MultiPolygon') {
      console.warn(`Lewati geometri bukan polygon pada layer ${layer}:`, geom.type);
      continue;
    }

    await client.query(
      `INSERT INTO webgis_features (layer_key, name, phone, website, address, properties, geom)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, ST_SetSRID(ST_GeomFromGeoJSON($7), 4326))`,
      [layer, name, phone, website, address, JSON.stringify(props), JSON.stringify(geom)]
    );
    inserted += 1;
  }

  console.log(`${layer}: ${inserted} fitur berhasil diimpor.`);
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of files) {
      await importOne(client, item.layer, item.file);
    }
    await client.query('COMMIT');
    console.log('Import selesai.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
