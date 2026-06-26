-- db.sql
-- Skema basis data WebGIS Fasilitas Umum Pekalongan.
-- Jalankan di database PostgreSQL yang sudah memiliki extension PostGIS.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(80) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'guest')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webgis_layers (
    id SERIAL PRIMARY KEY,
    layer_key VARCHAR(40) UNIQUE NOT NULL,
    layer_name VARCHAR(120) NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#2563eb',
    outline_color VARCHAR(20) NOT NULL DEFAULT '#111827',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webgis_features (
    id BIGSERIAL PRIMARY KEY,
    layer_key VARCHAR(40) NOT NULL REFERENCES webgis_layers(layer_key) ON UPDATE CASCADE ON DELETE CASCADE,
    name TEXT,
    phone TEXT,
    website TEXT,
    address TEXT,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    geom geometry(MultiPolygon, 4326) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webgis_features_layer ON webgis_features(layer_key);
CREATE INDEX IF NOT EXISTS idx_webgis_features_name ON webgis_features USING gin (to_tsvector('simple', COALESCE(name,'')));
CREATE INDEX IF NOT EXISTS idx_webgis_features_props ON webgis_features USING gin (properties);
CREATE INDEX IF NOT EXISTS idx_webgis_features_geom ON webgis_features USING gist (geom);

INSERT INTO webgis_layers (layer_key, layer_name, color, outline_color) VALUES
('bangunan', 'Bangunan Umum', '#f59e0b', '#78350f'),
('hotel', 'Hotel', '#2563eb', '#1e3a8a'),
('rs', 'Rumah Sakit', '#ef4444', '#7f1d1d'),
('sekolah', 'Sekolah', '#a855f7', '#581c87')
ON CONFLICT (layer_key) DO UPDATE SET
    layer_name = EXCLUDED.layer_name,
    color = EXCLUDED.color,
    outline_color = EXCLUDED.outline_color,
    updated_at = NOW();
