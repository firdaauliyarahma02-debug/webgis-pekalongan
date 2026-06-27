-- SETUP SUPABASE POSTGRESQL/POSTGIS UNTUK WEBGIS GITHUB PAGES
-- Jalankan semua script ini di Supabase > SQL Editor > Run.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS public.webgis_layers (
  id BIGSERIAL PRIMARY KEY,
  layer_key TEXT UNIQUE NOT NULL,
  layer_name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#9fbea5',
  outline_color TEXT NOT NULL DEFAULT '#4f6f52',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.webgis_layers (layer_key, layer_name, color, outline_color, is_active)
VALUES
  ('bangunan', 'Bangunan Umum', '#d6a15d', '#8a6230', TRUE),
  ('hotel', 'Hotel', '#6aa6a1', '#4f6f52', TRUE),
  ('rs', 'Rumah Sakit', '#d97891', '#9f4a60', TRUE),
  ('sekolah', 'Sekolah', '#9fbea5', '#4f6f52', TRUE)
ON CONFLICT (layer_key) DO UPDATE SET
  layer_name = EXCLUDED.layer_name,
  color = EXCLUDED.color,
  outline_color = EXCLUDED.outline_color,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.webgis_features (
  id BIGSERIAL PRIMARY KEY,
  layer_key TEXT NOT NULL REFERENCES public.webgis_layers(layer_key) ON DELETE CASCADE,
  source_uid TEXT NOT NULL,
  name TEXT,
  category TEXT,
  phone TEXT,
  address TEXT,
  website TEXT,
  properties JSONB NOT NULL DEFAULT '{}'::JSONB,
  geometry JSONB NOT NULL,
  geom GEOMETRY(Geometry, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT webgis_features_layer_source_unique UNIQUE(layer_key, source_uid)
);

CREATE INDEX IF NOT EXISTS webgis_features_layer_idx ON public.webgis_features(layer_key);
CREATE INDEX IF NOT EXISTS webgis_features_geom_idx ON public.webgis_features USING GIST(geom);

CREATE OR REPLACE FUNCTION public.webgis_set_geom_from_jsonb()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.geometry IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_GeomFromGeoJSON(NEW.geometry::TEXT), 4326);
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_webgis_set_geom ON public.webgis_features;
CREATE TRIGGER trg_webgis_set_geom
BEFORE INSERT OR UPDATE OF geometry ON public.webgis_features
FOR EACH ROW
EXECUTE FUNCTION public.webgis_set_geom_from_jsonb();

ALTER TABLE public.webgis_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webgis_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webgis_layers_public_read ON public.webgis_layers;
DROP POLICY IF EXISTS webgis_layers_admin_write ON public.webgis_layers;
DROP POLICY IF EXISTS webgis_features_public_read ON public.webgis_features;
DROP POLICY IF EXISTS webgis_features_admin_write ON public.webgis_features;

-- Pengunjung boleh membaca data peta.
CREATE POLICY webgis_layers_public_read
ON public.webgis_layers
FOR SELECT
TO anon, authenticated
USING (TRUE);

CREATE POLICY webgis_features_public_read
ON public.webgis_features
FOR SELECT
TO anon, authenticated
USING (TRUE);

-- Admin yang login melalui Supabase Auth boleh mengelola data.
CREATE POLICY webgis_layers_admin_write
ON public.webgis_layers
FOR ALL
TO authenticated
USING (TRUE)
WITH CHECK (TRUE);

CREATE POLICY webgis_features_admin_write
ON public.webgis_features
FOR ALL
TO authenticated
USING (TRUE)
WITH CHECK (TRUE);
