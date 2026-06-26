const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = Number(process.env.PORT || 3000);
const jwtSecret = process.env.JWT_SECRET || 'change-this-secret';
const useSsl = process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});

const allowedLayers = new Set(['bangunan', 'hotel', 'rs', 'sekolah']);

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    full_name: row.full_name,
    role: row.role,
    created_at: row.created_at
  };
}

function signUser(row) {
  return jwt.sign(publicUser(row), jwtSecret, { expiresIn: '8h' });
}

function getBearerToken(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

function authRequired(req, res, next) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ message: 'Token login tidak ditemukan.' });
  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token login tidak valid atau sudah kedaluwarsa.' });
  }
}

function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Akses hanya untuk admin.' });
    next();
  });
}

function validateLayer(req, res, next) {
  const { layer } = req.params;
  if (!allowedLayers.has(layer)) return res.status(400).json({ message: 'Layer tidak valid.' });
  next();
}

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result;
}

app.get('/api/health', async (req, res) => {
  const db = await query('SELECT NOW() AS now');
  res.json({ ok: true, app: 'SIGNETUTS WebGIS API', database_time: db.rows[0].now });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username dan password wajib diisi.' });

  const result = await query('SELECT * FROM users WHERE username = $1 LIMIT 1', [username]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ message: 'Username atau password salah.' });

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ message: 'Username atau password salah.' });

  res.json({ token: signUser(user), user: publicUser(user) });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/stats', async (req, res) => {
  const result = await query(`
    SELECT l.layer_key, l.layer_name, l.color, l.outline_color, COUNT(f.id)::int AS total
    FROM webgis_layers l
    LEFT JOIN webgis_features f ON f.layer_key = l.layer_key
    GROUP BY l.layer_key, l.layer_name, l.color, l.outline_color
    ORDER BY l.id
  `);
  res.json({ layers: result.rows });
});

app.get('/api/layers', async (req, res) => {
  const result = await query(`
    SELECT l.layer_key, l.layer_name, l.color, l.outline_color, l.is_active,
           COUNT(f.id)::int AS feature_count
    FROM webgis_layers l
    LEFT JOIN webgis_features f ON f.layer_key = l.layer_key
    GROUP BY l.id
    ORDER BY l.id
  `);
  res.json({ data: result.rows });
});

app.put('/api/layers/:layer', adminRequired, validateLayer, async (req, res) => {
  const { layer } = req.params;
  const { layer_name, color, outline_color, is_active } = req.body;
  const result = await query(
    `UPDATE webgis_layers
     SET layer_name = COALESCE($2, layer_name),
         color = COALESCE($3, color),
         outline_color = COALESCE($4, outline_color),
         is_active = COALESCE($5, is_active),
         updated_at = NOW()
     WHERE layer_key = $1
     RETURNING *`,
    [layer, layer_name || null, color || null, outline_color || null, is_active]
  );
  res.json({ data: result.rows[0] });
});

app.get('/api/features/:layer', validateLayer, async (req, res) => {
  const { layer } = req.params;
  const search = (req.query.search || '').toString().trim();

  const params = [layer];
  let where = 'WHERE layer_key = $1';
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where += ` AND (LOWER(COALESCE(name,'')) LIKE $2 OR LOWER(properties::text) LIKE $2)`;
  }

  const result = await query(
    `SELECT json_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(json_agg(
        json_build_object(
          'type', 'Feature',
          'id', id,
          'geometry', ST_AsGeoJSON(geom)::json,
          'properties', properties || jsonb_build_object(
            'id', id,
            'layer_key', layer_key,
            'name', name,
            'phone', phone,
            'website', website,
            'address', address
          )
        ) ORDER BY id
      ), '[]'::json)
    ) AS geojson
     FROM webgis_features
     ${where}`,
    params
  );

  res.json(result.rows[0].geojson);
});

app.get('/api/admin/features/:layer', adminRequired, validateLayer, async (req, res) => {
  const { layer } = req.params;
  const result = await query(
    `SELECT id, layer_key, name, phone, website, address, properties, ST_AsGeoJSON(geom)::json AS geometry, created_at, updated_at
     FROM webgis_features
     WHERE layer_key = $1
     ORDER BY id
     LIMIT 300`,
    [layer]
  );
  res.json({ data: result.rows });
});

app.post('/api/admin/features/:layer', adminRequired, validateLayer, async (req, res) => {
  const { layer } = req.params;
  const { name, phone, website, address, properties = {}, geometry } = req.body;
  if (!geometry) return res.status(400).json({ message: 'Geometry GeoJSON wajib diisi.' });

  let geom = geometry;
  if (geom.type === 'Polygon') geom = { type: 'MultiPolygon', coordinates: [geom.coordinates] };
  if (geom.type !== 'MultiPolygon') return res.status(400).json({ message: 'Geometry harus Polygon atau MultiPolygon.' });

  const result = await query(
    `INSERT INTO webgis_features (layer_key, name, phone, website, address, properties, geom)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, ST_SetSRID(ST_GeomFromGeoJSON($7), 4326))
     RETURNING id`,
    [layer, name || null, phone || null, website || null, address || null, JSON.stringify(properties), JSON.stringify(geom)]
  );
  res.status(201).json({ id: result.rows[0].id });
});

app.put('/api/admin/features/:layer/:id', adminRequired, validateLayer, async (req, res) => {
  const { layer, id } = req.params;
  const { name, phone, website, address, properties, geometry } = req.body;

  if (geometry) {
    let geom = geometry;
    if (geom.type === 'Polygon') geom = { type: 'MultiPolygon', coordinates: [geom.coordinates] };
    if (geom.type !== 'MultiPolygon') return res.status(400).json({ message: 'Geometry harus Polygon atau MultiPolygon.' });

    await query(
      `UPDATE webgis_features
       SET name = $3, phone = $4, website = $5, address = $6, properties = $7::jsonb,
           geom = ST_SetSRID(ST_GeomFromGeoJSON($8), 4326), updated_at = NOW()
       WHERE layer_key = $1 AND id = $2`,
      [layer, id, name || null, phone || null, website || null, address || null, JSON.stringify(properties || {}), JSON.stringify(geom)]
    );
  } else {
    await query(
      `UPDATE webgis_features
       SET name = $3, phone = $4, website = $5, address = $6, properties = $7::jsonb, updated_at = NOW()
       WHERE layer_key = $1 AND id = $2`,
      [layer, id, name || null, phone || null, website || null, address || null, JSON.stringify(properties || {})]
    );
  }

  res.json({ ok: true });
});

app.delete('/api/admin/features/:layer/:id', adminRequired, validateLayer, async (req, res) => {
  const { layer, id } = req.params;
  await query('DELETE FROM webgis_features WHERE layer_key = $1 AND id = $2', [layer, id]);
  res.json({ ok: true });
});

app.get('/api/admin/users', adminRequired, async (req, res) => {
  const result = await query('SELECT id, username, full_name, role, created_at FROM users ORDER BY created_at DESC');
  res.json({ data: result.rows });
});

app.post('/api/admin/users', adminRequired, async (req, res) => {
  const { username, password, full_name, role } = req.body;
  if (!username || !password || !full_name || !role) {
    return res.status(400).json({ message: 'Username, password, nama lengkap, dan role wajib diisi.' });
  }
  if (!['admin', 'guest'].includes(role)) return res.status(400).json({ message: 'Role tidak valid.' });

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const result = await query(
      `INSERT INTO users (username, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, full_name, role, created_at`,
      [username, passwordHash, full_name, role]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Username sudah digunakan.' });
    throw err;
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Endpoint tidak ditemukan.' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Terjadi kesalahan server.', detail: err.message });
});

app.listen(port, () => {
  console.log(`SIGNETUTS WebGIS berjalan di http://localhost:${port}`);
});
