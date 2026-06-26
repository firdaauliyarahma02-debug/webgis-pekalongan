const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const useSsl = process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db.sql'), 'utf8');
  await pool.query(sql);

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const fullName = process.env.ADMIN_NAME || 'Administrator WebGIS';
  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO users (username, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (username) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       full_name = EXCLUDED.full_name,
       role = 'admin',
       updated_at = NOW()`,
    [username, passwordHash, fullName]
  );

  console.log('Database siap. Admin:', username, '/', password);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
