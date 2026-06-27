/* SIGNETUTS WebGIS — GitHub Pages + Supabase PostgreSQL/PostGIS
   Catatan: isi supabase-config.js sebelum upload GitHub Pages. */
mapboxgl.accessToken = 'pk.eyJ1IjoiZmlyZGFhdWxpeWFyYWhtYSIsImEiOiJjbW5wdnI2eWQwMHZ4MzBwc2E5aGNkbm1oIn0.jLkgH9Y1ywcPyrg19wPi9w';

const TOKEN_KEY = 'signetuts_token';
const USER_KEY = 'signetuts_user';

const SUPA_CFG = window.SUPABASE_CONFIG || {};
function validSupabaseValue(value) {
  return !!value && !String(value).includes('ISI_') && !String(value).includes('PASTE_') && String(value).trim().length > 12;
}
const SUPABASE_READY = !!(window.supabase && validSupabaseValue(SUPA_CFG.url) && validSupabaseValue(SUPA_CFG.anonKey));
const sb = SUPABASE_READY ? window.supabase.createClient(SUPA_CFG.url, SUPA_CFG.anonKey) : null;
const ADMIN_EMAIL = SUPA_CFG.adminEmail || 'admin@webgis.local';

let layerConfig = {
  bangunan: { label: 'Bangunan Umum', color: '#d6a15d', outline: '#8a6230', isActive: true },
  hotel: { label: 'Hotel', color: '#6aa6a1', outline: '#4f6f52', isActive: true },
  rs: { label: 'Rumah Sakit', color: '#d97891', outline: '#9f4a60', isActive: true },
  sekolah: { label: 'Sekolah', color: '#9fbea5', outline: '#4f6f52', isActive: true }
};

const fallbackFiles = {
  bangunan: 'assets/geojson/Bangunan umum lainnya.geojson',
  hotel: 'assets/geojson/Hotel.geojson',
  rs: 'assets/geojson/Rumah_Sakit.geojson',
  sekolah: 'assets/geojson/Sekolah.geojson'
};

const qgisLayerWindowNames = {
  bangunan: ['lyr_Bangunanumumlainnya_1', 'layer_Bangunanumumlainnya_1'],
  hotel: ['lyr_Hotel_2', 'layer_Hotel_2'],
  rs: ['lyr_Rumah_Sakit_3', 'layer_Rumah_Sakit_3'],
  sekolah: ['lyr_Sekolah_4', 'layer_Sekolah_4']
};

const basemapStyles = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  light: 'mapbox://styles/mapbox/light-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11'
};

const $ = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));

let loadedData = {};
let bounds = new mapboxgl.LngLatBounds();
let hasBounds = false;
let userMarker = null;
let routingProfile = 'driving';
let journeyVehicle = 'car';
let startCoord = null;
let endCoord = null;
let startMarker = null;
let endMarker = null;
let currentAdminSection = 'dashboard';
let currentAdminLayer = 'sekolah';
let currentBasemap = 'streets';
let currentRouteGeojson = null;
let measureActive = false;
let measureStart = null;
let measureEnd = null;
let measureStartMarker = null;
let measureEndMarker = null;
let layerClickHandlers = {};
let journeyMarker = null;
let journeyAnimationId = null;
let journeyStartedAt = 0;
let journeyPaused = false;
let journeyPauseProgress = 0;
let journeyDistanceInfo = null;
let journeyDurationMs = 0;

const map = new mapboxgl.Map({
  container: 'map',
  style: basemapStyles.streets,
  center: [109.67, -6.89],
  zoom: 14
});
map.addControl(new mapboxgl.NavigationControl(), 'top-left');
map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-right');

function token() { return localStorage.getItem(TOKEN_KEY); }
function currentUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
}
function isAdmin() { return currentUser()?.role === 'admin'; }
async function api() {
  throw new Error('Versi GitHub Pages tidak memakai backend /api. Gunakan Supabase melalui supabase-config.js.');
}

function esc(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
function showNotif(message, type = 'error') {
  const n = $('notif');
  n.textContent = message;
  n.style.background = type === 'success' ? '#4f6f52' : '#d97891';
  n.style.display = 'block';
  clearTimeout(n._timer);
  n._timer = setTimeout(() => n.style.display = 'none', 3300);
}
function formatCoord(coord) { return coord[1].toFixed(6) + ', ' + coord[0].toFixed(6); }
function getFeatureLabel(props = {}) {
  const keys = ['name', 'nama', 'Nama', 'NAMA', 'title', 'jenis', 'kategori'];
  for (const k of keys) if (props[k]) return String(props[k]);
  return '(tanpa nama)';
}
function addCoordsToBounds(coords) {
  if (!Array.isArray(coords)) return;
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    bounds.extend(coords);
    hasBounds = true;
    return;
  }
  coords.forEach(addCoordsToBounds);
}
function featureBounds(feature) {
  const b = new mapboxgl.LngLatBounds();
  let ok = false;
  const collect = coords => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') { b.extend(coords); ok = true; return; }
    coords.forEach(collect);
  };
  collect(feature.geometry.coordinates);
  return ok ? b : null;
}

function featureCenter(feature) {
  const fb = featureBounds(feature);
  if (fb) return fb.getCenter().toArray();
  const coord = firstCoordinate(feature.geometry?.coordinates);
  return coord ? [Number(coord[0]), Number(coord[1])] : null;
}
function distanceMeters(coordA, coordB) {
  if (!coordA || !coordB) return 0;
  const toRad = deg => Number(deg) * Math.PI / 180;
  const R = 6371000;
  const lat1 = toRad(coordA[1]);
  const lat2 = toRad(coordB[1]);
  const dLat = toRad(coordB[1] - coordA[1]);
  const dLon = toRad(coordB[0] - coordA[0]);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function formatDistance(meters) {
  const m = Number(meters || 0);
  if (m >= 1000) return (m / 1000).toFixed(2) + ' km';
  return Math.round(m) + ' m';
}
function downloadText(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function csvEscape(value) {
  const text = String(value ?? '');
  return '"' + text.replaceAll('"', '""') + '"';
}
function featuresToCsv(features = [], layerKey = '') {
  const header = ['layer', 'nama', 'jenis', 'operator', 'alamat', 'telepon', 'website', 'longitude', 'latitude'];
  const rows = features.map(feature => {
    const props = feature.properties || {};
    const c = featureCenter(feature) || ['', ''];
    return [
      layerConfig[layerKey]?.label || layerKey,
      getFeatureLabel(props),
      pick(props, ['amenity', 'healthcare', 'tourism', 'building', 'kategori']) || 'Fasilitas Umum',
      pick(props, ['operator', 'brand', 'operator:type']),
      getFeatureAddress(props),
      getFeaturePhone(props),
      getFeatureWebsite(props),
      c[0],
      c[1]
    ].map(csvEscape).join(',');
  });
  return [header.join(','), ...rows].join('\n');
}

function cleanText(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  if (!text || text === 'null' || text === 'undefined' || text === '0') return '';
  return text;
}
function pick(props = {}, keys = []) {
  for (const key of keys) {
    const value = cleanText(props[key]);
    if (value) return value;
  }
  return '';
}
function addressFromProps(props = {}) {
  const parts = [
    pick(props, ['addr:street', 'street', 'jalan']),
    pick(props, ['addr:housenumber', 'housenumber', 'nomor']),
    pick(props, ['addr:city', 'city', 'kota']),
    pick(props, ['addr:postcode', 'postcode', 'kode_pos'])
  ].filter(Boolean);
  return parts.join(' ');
}
function firstCoordinate(coords) {
  if (!Array.isArray(coords)) return null;
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') return coords;
  for (const item of coords) {
    const c = firstCoordinate(item);
    if (c) return c;
  }
  return null;
}
function getFeaturePhone(props = {}) {
  return pick(props, ['phone', 'contact:phone', 'telepon', 'no_telp', 'nomor_telepon']);
}
function getFeatureWebsite(props = {}) {
  return pick(props, ['website', 'contact:website', 'url', 'link']);
}
function getFeatureAddress(props = {}) {
  return pick(props, ['address', 'alamat', 'addr:full']) || addressFromProps(props);
}
function featureToDbRow(layerKey, feature, index = 0) {
  const props = feature.properties || {};
  const sourceUid = cleanText(props.full_id) || cleanText(props.osm_id) || cleanText(props.id) || `${layerKey}-${index}`;
  return {
    layer_key: layerKey,
    source_uid: String(sourceUid),
    name: getFeatureLabel(props),
    category: layerConfig[layerKey]?.label || layerKey,
    phone: getFeaturePhone(props) || null,
    address: getFeatureAddress(props) || null,
    website: getFeatureWebsite(props) || null,
    properties: props,
    geometry: feature.geometry
  };
}
function rowToFeature(row) {
  const props = { ...(row.properties || {}) };
  props.name = row.name || props.name;
  props.phone = row.phone || props.phone;
  props.website = row.website || props.website;
  props.address = row.address || props.address;
  props._db_id = row.id;
  props._source_uid = row.source_uid;
  return { type: 'Feature', properties: props, geometry: row.geometry };
}
function rowsToFeatureCollection(rows = []) {
  return { type: 'FeatureCollection', features: rows.filter(r => r.geometry).map(rowToFeature) };
}
async function fetchLocalGeojson(key) {
  const res = await fetch(fallbackFiles[key]);
  if (!res.ok) throw new Error('Gagal memuat file GeoJSON: ' + fallbackFiles[key]);
  return await res.json();
}
async function loadLayerMeta() {
  if (!sb) return;
  const { data, error } = await sb.from('webgis_layers').select('*').order('id', { ascending: true });
  if (error) {
    console.warn('Metadata layer Supabase gagal. Pakai konfigurasi lokal.', error.message);
    return;
  }
  (data || []).forEach(row => {
    if (!layerConfig[row.layer_key]) return;
    layerConfig[row.layer_key] = {
      ...layerConfig[row.layer_key],
      label: row.layer_name || layerConfig[row.layer_key].label,
      color: row.color || layerConfig[row.layer_key].color,
      outline: row.outline_color || layerConfig[row.layer_key].outline,
      isActive: row.is_active !== false,
      count: row.feature_count
    };
  });
}
async function fetchLayerGeojson(key) {
  if (sb) {
    try {
      const { data, error } = await sb
        .from('webgis_features')
        .select('id,layer_key,source_uid,name,category,phone,address,website,properties,geometry')
        .eq('layer_key', key)
        .order('id', { ascending: true });
      if (!error && data && data.length) return rowsToFeatureCollection(data);
      if (error) console.warn('Supabase layer gagal, fallback GeoJSON:', key, error.message);
    } catch (err) {
      console.warn('Supabase tidak bisa diakses, fallback GeoJSON:', key, err.message);
    }
  }
  return await fetchLocalGeojson(key);
}
async function loadStats() {
  const counts = {};
  if (sb) {
    for (const key of Object.keys(layerConfig)) {
      try {
        const { count, error } = await sb.from('webgis_features').select('id', { count: 'exact', head: true }).eq('layer_key', key);
        if (!error && count) counts[key] = count;
      } catch {}
    }
  }
  for (const key of Object.keys(layerConfig)) {
    if (!counts[key]) {
      const data = loadedData[key] || await fetchLocalGeojson(key);
      counts[key] = data.features?.length || 0;
    }
  }
  $('metricBangunan').textContent = counts.bangunan ?? 0;
  $('metricHotel').textContent = counts.hotel ?? 0;
  $('metricRS').textContent = counts.rs ?? 0;
  $('metricSekolah').textContent = counts.sekolah ?? 0;
}

function refreshToolLayerOptions() {
  const options = Object.keys(layerConfig)
    .map(key => `<option value="${esc(key)}">${esc(layerConfig[key].label)}</option>`)
    .join('');
  ['exportLayerSelect', 'nearestLayerSelect'].forEach(id => {
    const el = $(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML = options;
    if (current && layerConfig[current]) el.value = current;
  });
}
function renderStatsPanel() {
  const list = $('statsList');
  const totalEl = $('statsTotal');
  const statusEl = $('statsSupabaseStatus');
  if (!list || !totalEl || !statusEl) return;
  const rows = Object.keys(layerConfig).map(key => {
    const count = loadedData[key]?.features?.length || 0;
    return { key, count, label: layerConfig[key].label, color: layerConfig[key].color };
  });
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  totalEl.textContent = total;
  list.innerHTML = rows.map(row => {
    const pct = total ? Math.round((row.count / total) * 100) : 0;
    return `<div class="stats-row">
      <span><i style="background:${esc(row.color)}"></i>${esc(row.label)}</span>
      <b>${row.count}</b>
      <em>${pct}%</em>
    </div>`;
  }).join('');
  statusEl.textContent = SUPABASE_READY
    ? 'Status: terhubung ke Supabase PostgreSQL/PostGIS. Jika tabel kosong, data fallback dari GeoJSON tetap ditampilkan.'
    : 'Status: memakai GeoJSON fallback. Isi supabase-config.js agar data terbaca dari PostgreSQL Supabase.';
}
function fitAllLayers() {
  if (hasBounds) map.fitBounds(bounds, { padding: { top: 100, right: 430, bottom: 80, left: 70 }, maxZoom: 17, duration: 750 });
}
async function changeBasemap(styleKey) {
  if (!basemapStyles[styleKey] || styleKey === currentBasemap) return;
  currentBasemap = styleKey;
  map.setStyle(basemapStyles[styleKey]);
  map.once('style.load', async () => {
    try {
      await addMapLayers();
      renderLayerControls();
      refreshToolLayerOptions();
      renderStatsPanel();
      if (currentRouteGeojson && !isQgisActive()) showRouteLine(currentRouteGeojson);
      if (measureStart && measureEnd) drawMeasureLine();
    } catch (err) {
      console.error(err);
      showNotif('Basemap berubah, tetapi layer gagal dimuat ulang.');
    }
  });
}
function exportSelectedGeojson() {
  const key = $('exportLayerSelect')?.value;
  const data = loadedData[key];
  if (!key || !data) return showNotif('Pilih layer yang akan diunduh.');
  downloadText(`${key}_webgis_pekalongan.geojson`, JSON.stringify(data, null, 2), 'application/geo+json;charset=utf-8');
  showNotif('GeoJSON berhasil diunduh.', 'success');
}
function exportSelectedCsv() {
  const key = $('exportLayerSelect')?.value;
  const data = loadedData[key];
  if (!key || !data) return showNotif('Pilih layer yang akan diunduh.');
  downloadText(`${key}_webgis_pekalongan.csv`, featuresToCsv(data.features || [], key), 'text/csv;charset=utf-8');
  showNotif('CSV berhasil diunduh.', 'success');
}
function findNearestFacilities() {
  const key = $('nearestLayerSelect')?.value;
  const out = $('nearestResults');
  if (!key || !out) return;
  const origin = userMarker ? userMarker.getLngLat().toArray() : map.getCenter().toArray();
  const rows = (loadedData[key]?.features || [])
    .map((feature, idx) => ({ feature, idx, center: featureCenter(feature) }))
    .filter(row => row.center)
    .map(row => ({ ...row, distance: distanceMeters(origin, row.center) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 8);
  out.innerHTML = rows.map(row => `<div class="nearest-item" data-nearest-idx="${row.idx}" data-nearest-key="${esc(key)}">
      <b>${esc(getFeatureLabel(row.feature.properties))}</b>
      <span>${esc(layerConfig[key].label)} · ${formatDistance(row.distance)}</span>
    </div>`).join('') || '<div class="result-item">Data tidak ditemukan.</div>';
  out.querySelectorAll('[data-nearest-idx]').forEach(el => el.addEventListener('click', () => {
    const feature = loadedData[el.dataset.nearestKey].features[Number(el.dataset.nearestIdx)];
    const c = featureCenter(feature);
    const b = featureBounds(feature);
    if (b) map.fitBounds(b, { padding: 110, maxZoom: 18, duration: 700 });
    else if (c) map.flyTo({ center: c, zoom: 17 });
    if (c) new mapboxgl.Popup({ maxWidth: '320px' }).setLngLat(c).setHTML(popupHtml(feature.properties || {})).addTo(map);
  }));
}
function setMeasureInfo(html) {
  const el = $('measureInfo');
  if (el) el.innerHTML = html;
}
function clearMeasure() {
  measureActive = false;
  measureStart = null;
  measureEnd = null;
  if (measureStartMarker) { measureStartMarker.remove(); measureStartMarker = null; }
  if (measureEndMarker) { measureEndMarker.remove(); measureEndMarker = null; }
  if (map.getLayer('measure-line')) map.removeLayer('measure-line');
  if (map.getSource('measure')) map.removeSource('measure');
  const btn = $('btnMeasureStart');
  if (btn) btn.textContent = 'Mulai Ukur';
  setMeasureInfo('Belum ada pengukuran.');
}
function startMeasure() {
  clearMeasure();
  measureActive = true;
  const btn = $('btnMeasureStart');
  if (btn) btn.textContent = 'Klik Titik 1';
  setMeasureInfo('Klik titik pertama pada peta.');
  showNotif('Mode ukur aktif. Klik dua titik pada peta.', 'success');
}
function handleMeasurePoint(coord) {
  if (!measureActive) return false;
  if (!measureStart) {
    measureStart = coord;
    measureStartMarker = addPointMarker(coord, 'A');
    const btn = $('btnMeasureStart');
    if (btn) btn.textContent = 'Klik Titik 2';
    setMeasureInfo('Titik pertama dipilih. Klik titik kedua.');
    return true;
  }
  measureEnd = coord;
  measureEndMarker = addPointMarker(coord, 'B');
  drawMeasureLine();
  measureActive = false;
  const btn = $('btnMeasureStart');
  if (btn) btn.textContent = 'Mulai Ukur';
  return true;
}
function drawMeasureLine() {
  if (!measureStart || !measureEnd) return;
  const line = { type: 'Feature', geometry: { type: 'LineString', coordinates: [measureStart, measureEnd] }, properties: {} };
  if (map.getSource('measure')) map.getSource('measure').setData(line);
  else {
    map.addSource('measure', { type: 'geojson', data: line });
    map.addLayer({ id: 'measure-line', type: 'line', source: 'measure', paint: { 'line-color': '#4f6f52', 'line-width': 4, 'line-dasharray': [2, 2] } });
  }
  const dist = distanceMeters(measureStart, measureEnd);
  setMeasureInfo(`<b>Jarak lurus:</b> ${formatDistance(dist)}<br><span>${formatCoord(measureStart)} → ${formatCoord(measureEnd)}</span>`);
}
function openFullscreenMap() {
  const target = $('mainApp') || document.documentElement;
  if (!document.fullscreenElement && target.requestFullscreen) target.requestFullscreen();
  else if (document.exitFullscreen) document.exitFullscreen();
}
function popupHtml(props = {}) {
  const title = esc(getFeatureLabel(props));
  const jenis = pick(props, ['amenity', 'healthcare', 'tourism', 'building', 'kategori']) || 'Fasilitas Umum';
  const operator = pick(props, ['operator', 'brand', 'operator:type']);
  const alamat = getFeatureAddress(props);
  const phone = getFeaturePhone(props);
  const website = getFeatureWebsite(props);
  const speciality = pick(props, ['healthcare:speciality', 'speciality']);
  const rows = [
    ['Jenis', jenis],
    ['Operator', operator],
    ['Alamat', alamat],
    ['Telepon', phone],
    ['Website', website],
    ['Keterangan', speciality]
  ].filter(([, value]) => cleanText(value));
  const rowHtml = rows.map(([label, value]) => {
    const safeValue = label === 'Website'
      ? `<a href="${esc(value)}" target="_blank" rel="noopener">${esc(value)}</a>`
      : esc(value);
    return `<div class="popup-row-clean"><span>${esc(label)}</span><b>${safeValue}</b></div>`;
  }).join('');
  return `<div class="popup-card-clean"><h3>${title}</h3>${rowHtml || '<p>Informasi detail belum tersedia.</p>'}</div>`;
}

async function addMapLayers() {
  await loadLayerMeta();
  bounds = new mapboxgl.LngLatBounds();
  hasBounds = false;

  for (const key of Object.keys(layerConfig)) {
    const data = await fetchLayerGeojson(key);
    loadedData[key] = data;

    if (map.getLayer(key + '-outline')) map.removeLayer(key + '-outline');
    if (map.getLayer(key + '-fill')) map.removeLayer(key + '-fill');
    if (map.getSource(key)) map.removeSource(key);

    map.addSource(key, { type: 'geojson', data });
    map.addLayer({
      id: key + '-fill',
      type: 'fill',
      source: key,
      paint: { 'fill-color': layerConfig[key].color, 'fill-opacity': key === 'bangunan' ? 0.45 : 0.68 }
    });
    map.addLayer({
      id: key + '-outline',
      type: 'line',
      source: key,
      paint: { 'line-color': layerConfig[key].outline, 'line-width': key === 'bangunan' ? 0.7 : 1.3 }
    });

    data.features.forEach(f => addCoordsToBounds(f.geometry?.coordinates));

    if (layerClickHandlers[key]) {
      try { map.off('click', key + '-fill', layerClickHandlers[key]); } catch {}
    }
    layerClickHandlers[key] = e => {
      e.originalEvent.stopPropagation();
      const props = e.features[0].properties || {};
      new mapboxgl.Popup({ maxWidth: '320px' }).setLngLat(e.lngLat).setHTML(popupHtml(props)).addTo(map);
    };
    map.on('click', key + '-fill', layerClickHandlers[key]);
    map.on('mouseenter', key + '-fill', () => { if (!isQgisActive()) map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', key + '-fill', () => map.getCanvas().style.cursor = '');
  }

  if (hasBounds) map.fitBounds(bounds, { padding: { top: 90, right: 390, bottom: 80, left: 330 }, maxZoom: 17, duration: 700 });
  renderLayerControls();
  refreshToolLayerOptions();
  renderStatsPanel();
  setJourneyUi('Belum dimulai', 0);
}

function toggleLayer(key, visible) {
  if (isQgisActive()) qgisToggleLayer(key, visible);
  else {
    const value = visible ? 'visible' : 'none';
    if (map.getLayer(key + '-fill')) map.setLayoutProperty(key + '-fill', 'visibility', value);
    if (map.getLayer(key + '-outline')) map.setLayoutProperty(key + '-outline', 'visibility', value);
  }
}
function getLayerVisible(key) {
  if (isQgisActive()) return qgisGetLayerVisible(key);
  if (!map.getLayer(key + '-fill')) return true;
  return map.getLayoutProperty(key + '-fill', 'visibility') !== 'none';
}
function zoomToLayer(key) {
  if (isQgisActive()) return qgisZoomToLayer(key);
  const data = loadedData[key];
  if (!data) return;
  const b = new mapboxgl.LngLatBounds();
  let ok = false;
  data.features.forEach(f => {
    const fb = featureBounds(f);
    if (fb) { b.extend(fb.getNorthEast()); b.extend(fb.getSouthWest()); ok = true; }
  });
  if (ok) map.fitBounds(b, { padding: 80, duration: 700, maxZoom: 18 });
}
function renderLayerControls() {
  const makeRow = key => {
    const cfg = layerConfig[key];
    const checked = getLayerVisible(key) ? 'checked' : '';
    return `<div class="layer-row">
      <div class="layer-left"><input type="checkbox" data-layer-check="${key}" ${checked}><span class="color-dot" style="background:${cfg.color}"></span>${esc(cfg.label)}</div>
      <div class="layer-actions"><button class="small-btn" data-layer-zoom="${key}">Zoom</button></div>
    </div>`;
  };
  const html = Object.keys(layerConfig).map(makeRow).join('');
  $('layerList').innerHTML = html;
  $('layerMiniList').innerHTML = html;
  qsa('[data-layer-check]').forEach(chk => chk.addEventListener('change', e => {
    toggleLayer(e.target.dataset.layerCheck, e.target.checked);
    renderLayerControls();
  }));
  qsa('[data-layer-zoom]').forEach(btn => btn.addEventListener('click', () => zoomToLayer(btn.dataset.layerZoom)));
}

function addPointMarker(coord, label) {
  const el = document.createElement('div');
  el.style.cssText = 'width:30px;height:30px;border-radius:50%;background:' + (label === 'A' ? '#4f6f52' : '#d97891') + ';color:#fff;display:grid;place-items:center;font-weight:900;border:3px solid #fff;box-shadow:0 8px 20px rgba(0,0,0,.25);';
  el.textContent = label;
  return new mapboxgl.Marker({ element: el }).setLngLat(coord).addTo(map);
}
const vehicleOptions = {
  car: { label: 'Mobil', icon: '🚗', speedKmh: 28, profile: 'driving' },
  motor: { label: 'Motor', icon: '🛵', speedKmh: 35, profile: 'driving' },
  bicycle: { label: 'Sepeda', icon: '🚲', speedKmh: 14, profile: 'driving' }
};

function getJourneyOption() {
  if (routingProfile === 'walking') return { label: 'Jalan kaki', icon: '🚶', speedKmh: 5, profile: 'walking' };
  return vehicleOptions[journeyVehicle] || vehicleOptions.car;
}
function routeSpeedEstimate(distanceMeters) {
  const km = Number(distanceMeters || 0) / 1000;
  const speedKmh = getJourneyOption().speedKmh;
  const minutes = Math.max(1, Math.round((km / speedKmh) * 60));
  return minutes;
}
function updateVehiclePicker() {
  qsa('[data-vehicle]').forEach(btn => {
    const active = btn.dataset.vehicle === journeyVehicle && routingProfile !== 'walking';
    btn.classList.toggle('active', active);
  });
}
function formatRouteDuration(minutes) {
  const n = Math.max(1, Number(minutes || 1));
  if (n < 60) return `${n} menit`;
  const jam = Math.floor(n / 60);
  const menit = n % 60;
  return menit ? `${jam} jam ${menit} menit` : `${jam} jam`;
}

function setJourneyUi(status, percent = 0) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const statusEl = $('journeyStatus');
  const percentEl = $('journeyPercent');
  const barEl = $('journeyProgressBar');
  const modeEl = $('journeyModeBadge');
  const iconEl = $('journeyVehicleIcon');
  if (statusEl) statusEl.textContent = status;
  if (percentEl) percentEl.textContent = pct + '%';
  if (barEl) {
    barEl.style.width = pct + '%';
    const video = $('journeyVideo');
    if (video) video.style.setProperty('--journey-progress', pct + '%');
  }
  const journeyOption = getJourneyOption();
  if (modeEl) modeEl.textContent = journeyOption.label;
  if (iconEl) iconEl.textContent = journeyOption.icon;
  updateVehiclePicker();
}
function stopJourneyAnimation(removeMarker = false) {
  if (journeyAnimationId) cancelAnimationFrame(journeyAnimationId);
  journeyAnimationId = null;
  journeyStartedAt = 0;
  journeyPaused = false;
  journeyPauseProgress = 0;
  if (removeMarker && journeyMarker) {
    journeyMarker.remove();
    journeyMarker = null;
  }
}
function buildJourneyMarker() {
  const el = document.createElement('div');
  el.className = 'journey-map-marker';
  el.innerHTML = `<span>${getJourneyOption().icon}</span>`;
  return new mapboxgl.Marker({ element: el, rotationAlignment: 'map' });
}
function routeDistanceTable(coords = []) {
  const distances = [0];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += distanceMeters(coords[i - 1], coords[i]);
    distances.push(total);
  }
  return { distances, total };
}
function coordAtProgress(coords = [], table, progress = 0) {
  if (!coords.length) return null;
  if (coords.length === 1 || !table.total) return coords[0];
  const target = table.total * Math.max(0, Math.min(1, progress));
  for (let i = 1; i < coords.length; i++) {
    if (table.distances[i] >= target) {
      const prevD = table.distances[i - 1];
      const segD = table.distances[i] - prevD || 1;
      const t = (target - prevD) / segD;
      const a = coords[i - 1];
      const b = coords[i];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
  }
  return coords[coords.length - 1];
}
function startJourneySimulation() {
  if (isQgisActive()) return showNotif('Simulasi perjalanan visual tersedia pada peta utama Mapbox. Tutup qgis2web dulu.');
  if (!currentRouteGeojson?.geometry?.coordinates?.length) return showNotif('Buat rute A ke B terlebih dahulu, lalu klik Mulai Perjalanan.');
  const coords = currentRouteGeojson.geometry.coordinates;
  const table = routeDistanceTable(coords);
  if (!journeyMarker) journeyMarker = buildJourneyMarker().setLngLat(coords[0]).addTo(map);
  else journeyMarker.setLngLat(coords[0]);
  journeyDistanceInfo = table;
  journeyPaused = false;
  const speedFactor = routingProfile === 'walking'
    ? 7.2
    : journeyVehicle === 'bicycle'
      ? 6.0
      : journeyVehicle === 'motor'
        ? 3.5
        : 4.2;
  const minDuration = routingProfile === 'walking' ? 16000 : journeyVehicle === 'motor' ? 8000 : 10000;
  const maxDuration = routingProfile === 'walking' ? 42000 : journeyVehicle === 'bicycle' ? 34000 : 26000;
  const durationMs = Math.min(maxDuration, Math.max(minDuration, table.total * speedFactor));
  journeyDurationMs = durationMs;
  const resumeFrom = journeyPauseProgress || 0;
  journeyStartedAt = performance.now() - resumeFrom * durationMs;
  setJourneyUi('Perjalanan berjalan...', resumeFrom * 100);

  const step = now => {
    if (journeyPaused) return;
    const progress = Math.min(1, (now - journeyStartedAt) / durationMs);
    const coord = coordAtProgress(coords, table, progress);
    if (coord && journeyMarker) journeyMarker.setLngLat(coord);
    setJourneyUi(progress >= 1 ? 'Sampai tujuan' : 'Perjalanan berjalan...', progress * 100);
    if (progress < 1) journeyAnimationId = requestAnimationFrame(step);
    else {
      journeyAnimationId = null;
      journeyPauseProgress = 0;
      showNotif('Simulasi perjalanan selesai sampai tujuan.', 'success');
    }
  };
  if (journeyAnimationId) cancelAnimationFrame(journeyAnimationId);
  journeyAnimationId = requestAnimationFrame(step);
}
function pauseJourneySimulation() {
  if (!journeyAnimationId || !currentRouteGeojson?.geometry?.coordinates?.length) return;
  journeyPauseProgress = journeyDurationMs
    ? Math.max(0, Math.min(1, (performance.now() - journeyStartedAt) / journeyDurationMs))
    : 0;
  journeyPaused = true;
  cancelAnimationFrame(journeyAnimationId);
  journeyAnimationId = null;
  setJourneyUi('Perjalanan dijeda', journeyPauseProgress * 100);
}
function resetJourneySimulation() {
  stopJourneyAnimation(true);
  setJourneyUi('Belum dimulai', 0);
}
function clearRoute() {
  startCoord = null; endCoord = null; currentRouteGeojson = null;
  resetJourneySimulation();
  $('start').value = ''; $('end').value = ''; $('routeInfo').innerHTML = '';
  if (startMarker) { startMarker.remove(); startMarker = null; }
  if (endMarker) { endMarker.remove(); endMarker = null; }
  qgisClearSelections();
  if (map.getLayer('route-line')) map.removeLayer('route-line');
  if (map.getSource('route')) map.removeSource('route');
}
function handleRoutePoint(coord) {
  if (!startCoord) {
    startCoord = coord;
    $('start').value = formatCoord(coord);
    if (isQgisActive()) { qgisClearSelections(); qgisAddPointMarker(coord, 'A'); }
    else { if (startMarker) startMarker.remove(); startMarker = addPointMarker(coord, 'A'); }
    $('routeInfo').innerHTML = '<b>Titik awal dipilih.</b> Klik titik tujuan.';
    return;
  }
  if (!endCoord) {
    endCoord = coord;
    $('end').value = formatCoord(coord);
    if (isQgisActive()) qgisAddPointMarker(coord, 'B');
    else { if (endMarker) endMarker.remove(); endMarker = addPointMarker(coord, 'B'); }
    drawRoute();
    return;
  }
  clearRoute();
  handleRoutePoint(coord);
}
function showRouteLine(routeData) {
  if (!routeData || isQgisActive()) return;
  if (map.getSource('route')) map.getSource('route').setData(routeData);
  else {
    map.addSource('route', { type: 'geojson', data: routeData });
    map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#d97891', 'line-width': 5 } });
  }
}

async function drawRoute() {
  if (!startCoord || !endCoord) return showNotif('Pilih titik A dan B terlebih dahulu.');
  try {
    const profile = routingProfile === 'walking' ? 'foot' : 'driving';
    const url = `https://router.project-osrm.org/route/v1/${profile}/${startCoord[0]},${startCoord[1]};${endCoord[0]},${endCoord[1]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.routes?.length) return showNotif('Rute tidak ditemukan.');
    const routeData = { type: 'Feature', geometry: data.routes[0].geometry };

    if (isQgisActive()) {
      const ctx = ensureQgisRouteLayer();
      if (ctx) {
        const coords = routeData.geometry.coordinates.map(c => ctx.ol.proj.fromLonLat(c));
        const feat = new ctx.ol.Feature({ geometry: new ctx.ol.geom.LineString(coords) });
        ctx.__customRouteSource.clear();
        ctx.__customRouteSource.addFeature(feat);
        ctx.map.getView().fit(feat.getGeometry().getExtent(), { padding: [80,80,80,80], duration: 700 });
      }
    } else {
      currentRouteGeojson = routeData;
      showRouteLine(routeData);
      const b = new mapboxgl.LngLatBounds();
      routeData.geometry.coordinates.forEach(c => b.extend(c));
      map.fitBounds(b, { padding: 90, duration: 750 });
    }
    const distanceKm = (data.routes[0].distance / 1000).toFixed(2);
    const estimatedMinutes = routeSpeedEstimate(data.routes[0].distance);
    const modeLabel = getJourneyOption().label;
    $('routeInfo').innerHTML = `<b>Mode:</b> ${modeLabel}<br><b>Jarak:</b> ${distanceKm} km<br><b>Estimasi:</b> ${formatRouteDuration(estimatedMinutes)}`;
  } catch (err) {
    console.error(err);
    showNotif('Gagal membuat rute. Cek koneksi internet.');
  }
}

function attachPlaceSearch(inputId, resultId) {
  const input = $(inputId);
  const out = $(resultId);
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    out.innerHTML = '';
    if (q.length < 3) return;
    timer = setTimeout(async () => {
      try {
        const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=8&q=' + encodeURIComponent(q));
        const data = await res.json();
        out.innerHTML = data.map(item => `<div class="result-item" data-lon="${item.lon}" data-lat="${item.lat}">${esc(item.display_name)}</div>`).join('') || '<div class="result-item">Tidak ditemukan</div>';
        out.querySelectorAll('[data-lon]').forEach(el => el.addEventListener('click', () => {
          const coord = [parseFloat(el.dataset.lon), parseFloat(el.dataset.lat)];
          if (isQgisActive()) qgisCenterToLonLat(coord, 16);
          else map.flyTo({ center: coord, zoom: 16 });
          input.value = el.textContent;
          out.innerHTML = '';
        }));
      } catch {
        out.innerHTML = '<div class="result-item">Gagal mencari lokasi</div>';
      }
    }, 450);
  });
}
function attachFeatureSearch(inputId, resultId) {
  const input = $(inputId);
  const out = $(resultId);
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    out.innerHTML = '';
    if (q.length < 2) return;
    const rows = [];
    Object.keys(layerConfig).forEach(key => {
      (loadedData[key]?.features || []).forEach((feature, idx) => {
        if (rows.length >= 24) return;
        const text = JSON.stringify(feature.properties || {}).toLowerCase();
        if (text.includes(q)) rows.push({ key, idx, label: `${layerConfig[key].label} - ${getFeatureLabel(feature.properties)}` });
      });
    });
    out.innerHTML = rows.map(r => `<div class="result-item" data-key="${r.key}" data-idx="${r.idx}">${esc(r.label)}</div>`).join('') || '<div class="result-item">Data tidak ditemukan</div>';
    out.querySelectorAll('[data-key]').forEach(el => el.addEventListener('click', () => {
      const feature = loadedData[el.dataset.key].features[Number(el.dataset.idx)];
      const b = featureBounds(feature);
      if (b) map.fitBounds(b, { padding: 100, maxZoom: 18, duration: 750 });
    }));
  });
}

/* qgis2web helpers */
function isQgisActive() { return $('qgisFullscreen').classList.contains('show'); }
function getQgisContext() {
  try {
    const win = $('qgisFullscreenFrame').contentWindow;
    if (!win || !win.map || !win.ol) return null;
    return win;
  } catch { return null; }
}
function getQgisLayerRef(key) {
  const ctx = getQgisContext();
  if (!ctx) return null;
  for (const name of qgisLayerWindowNames[key] || []) if (ctx[name]) return ctx[name];
  return null;
}
function qgisToggleLayer(key, visible) { const lyr = getQgisLayerRef(key); if (lyr?.setVisible) lyr.setVisible(visible); }
function qgisGetLayerVisible(key) { const lyr = getQgisLayerRef(key); return lyr?.getVisible ? lyr.getVisible() : true; }
function qgisZoomToLayer(key) {
  const ctx = getQgisContext(); const lyr = getQgisLayerRef(key);
  if (!ctx || !lyr?.getSource) return;
  const ex = lyr.getSource().getExtent();
  if (ex && isFinite(ex[0])) ctx.map.getView().fit(ex, { padding: [70,70,70,70], maxZoom: 18, duration: 700 });
}
function ensureQgisLocateLayer() {
  const ctx = getQgisContext();
  if (!ctx) return null;
  if (!ctx.__customLocateSource) {
    ctx.__customLocateSource = new ctx.ol.source.Vector();
    ctx.__customLocateLayer = new ctx.ol.layer.Vector({ source: ctx.__customLocateSource, zIndex: 9999 });
    ctx.map.addLayer(ctx.__customLocateLayer);
  }
  return ctx;
}
function ensureQgisRouteLayer() {
  const ctx = getQgisContext();
  if (!ctx) return null;
  if (!ctx.__customRouteSource) {
    ctx.__customRouteSource = new ctx.ol.source.Vector();
    ctx.__customRouteLayer = new ctx.ol.layer.Vector({ source: ctx.__customRouteSource, zIndex: 9998, style: new ctx.ol.style.Style({ stroke: new ctx.ol.style.Stroke({ color: '#2563eb', width: 5 }) }) });
    ctx.map.addLayer(ctx.__customRouteLayer);
  }
  return ctx;
}
function qgisClearSelections() {
  const a = ensureQgisLocateLayer(); if (a?.__customLocateSource) a.__customLocateSource.clear();
  const b = ensureQgisRouteLayer(); if (b?.__customRouteSource) b.__customRouteSource.clear();
}
function qgisAddPointMarker(coordLonLat, label) {
  const ctx = ensureQgisLocateLayer(); if (!ctx) return;
  const coord = ctx.ol.proj.fromLonLat(coordLonLat);
  const feature = new ctx.ol.Feature({ geometry: new ctx.ol.geom.Point(coord) });
  feature.setStyle(new ctx.ol.style.Style({
    image: new ctx.ol.style.Circle({ radius: 10, fill: new ctx.ol.style.Fill({ color: label === 'A' ? '#4f6f52' : '#d97891' }), stroke: new ctx.ol.style.Stroke({ color: '#fff', width: 3 }) }),
    text: new ctx.ol.style.Text({ text: label, fill: new ctx.ol.style.Fill({ color: '#fff' }), font: 'bold 12px Arial' })
  }));
  ctx.__customLocateSource.addFeature(feature);
}
function qgisCenterToLonLat(coordLonLat, zoom = 16) {
  const ctx = getQgisContext(); if (!ctx) return;
  ctx.map.getView().animate({ center: ctx.ol.proj.fromLonLat(coordLonLat), zoom, duration: 700 });
}
function qgisBindClickRouting() {
  const ctx = getQgisContext();
  if (!ctx || ctx.__routeClickBound) return;
  ctx.__routeClickBound = true;
  ctx.map.on('singleclick', evt => { if (isQgisActive()) handleRoutePoint(ctx.ol.proj.toLonLat(evt.coordinate)); });
}
function openQgisFullscreen() {
  $('sidebar').classList.remove('show');
  $('qgisFullscreen').classList.add('show');
  $('qgisActiveBadge').classList.add('show');
  $('qgisFullscreenFrame').src = './qgis2web/index.html';
  setTimeout(() => { renderLayerControls(); qgisBindClickRouting(); }, 900);
}
function closeQgisFullscreen() {
  $('qgisFullscreen').classList.remove('show');
  $('qgisActiveBadge').classList.remove('show');
  renderLayerControls();
}

/* Auth & Admin — Supabase Auth + PostgreSQL langsung dari GitHub Pages */
function showLogin() { $('loginOverlay').classList.remove('hidden'); setTimeout(() => $('loginUsername').focus(), 80); }
function hideLogin() { $('loginOverlay').classList.add('hidden'); $('loginError').textContent = ''; }
async function doLogin() {
  const username = $('loginUsername').value.trim();
  const password = $('loginPassword').value;
  if (!username || !password) return $('loginError').textContent = 'Username dan password wajib diisi.';
  const btn = $('btnLoginSubmit');
  btn.disabled = true; btn.textContent = 'Memproses...';
  try {
    let authMode = 'demo';
    if (sb) {
      const email = username === 'admin' ? ADMIN_EMAIL : username;
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (!error) authMode = 'supabase';
      else console.warn('Supabase Auth gagal, login demo tetap dibuka:', error.message);
    }
    if (username !== 'admin' || password !== 'admin123') {
      throw new Error('Login gagal. Gunakan username admin dan password admin123, atau buat user Supabase Auth sesuai konfigurasi.');
    }
    localStorage.setItem(TOKEN_KEY, authMode);
    localStorage.setItem(USER_KEY, JSON.stringify({ username: 'admin', full_name: 'Administrator WebGIS', role: 'admin', auth_mode: authMode }));
    hideLogin();
    updateHeaderAuth();
    openAdminPanel();
    showNotif(authMode === 'supabase' ? 'Login admin Supabase berhasil.' : 'Login admin demo berhasil. Untuk edit database, pastikan Supabase sudah dikonfigurasi.', 'success');
  } catch (err) {
    $('loginError').textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Masuk';
  }
}
async function logout() {
  if (sb) await sb.auth.signOut().catch(() => {});
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  updateHeaderAuth();
  closeAdminPanel();
}
function updateHeaderAuth() {
  qsa('.auth-dynamic').forEach(el => el.remove());
  const actions = qs('.topbar__actions');
  const user = currentUser();
  const featureButton = $('btnToggleMenu');

  const badge = document.createElement('div');
  badge.id = 'userBadge';
  badge.className = 'auth-dynamic access-badge';

  if (user) {
    badge.innerHTML = `👤 ${esc(user.full_name)} <span class="role-pill role-admin">admin</span>`;
    actions.prepend(badge);

    const adminBtn = document.createElement('button');
    adminBtn.className = 'btn auth-dynamic';
    adminBtn.textContent = 'Admin Panel';
    adminBtn.addEventListener('click', openAdminPanel);
    actions.appendChild(adminBtn);

    const out = document.createElement('button');
    out.className = 'btn ghost auth-dynamic';
    out.textContent = 'Keluar';
    out.addEventListener('click', logout);
    actions.appendChild(out);
  } else {
    badge.innerHTML = `<span class="access-icon profile-access-icon" aria-hidden="true">👤</span><span class="access-copy"><b>Mode Pengunjung</b><small>Akses user biasa</small></span><span class="role-pill role-guest">USER BIASA</span>`;
    actions.prepend(badge);

    const login = document.createElement('button');
    login.className = 'btn ghost auth-dynamic';
    login.textContent = 'Login Admin';
    login.addEventListener('click', showLogin);
    actions.appendChild(login);
  }

  // Tombol ☰ Fitur selalu diposisikan paling pojok kanan.
  if (featureButton) actions.appendChild(featureButton);
}
function openAdminPanel() {
  if (!isAdmin()) return showLogin();
  $('adminPanel').classList.add('open');
  navigateAdmin(currentAdminSection);
}
function closeAdminPanel() { $('adminPanel').classList.remove('open'); }
function navigateAdmin(section) {
  currentAdminSection = section;
  qsa('.admin-nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.section === section));
  qsa('.admin-section').forEach(sec => sec.classList.toggle('active', sec.id === 'admin-' + section));
  const render = { dashboard: renderAdminDashboard, features: renderAdminFeatures, layers: renderAdminLayers, users: renderAdminUsers, testing: renderAdminTesting }[section];
  if (render) render();
}
async function hasSupabaseSession() {
  if (!sb) return false;
  const { data } = await sb.auth.getSession();
  return !!data?.session;
}
async function renderAdminDashboard() {
  const el = $('admin-dashboard');
  const counts = {};
  for (const key of Object.keys(layerConfig)) {
    const data = loadedData[key] || await fetchLayerGeojson(key);
    counts[key] = data.features?.length || 0;
  }
  const cards = Object.keys(layerConfig).map(k => `<div class="admin-card"><b>${counts[k]}</b><span>${esc(layerConfig[k].label)}</span></div>`).join('');
  const status = sb
    ? 'Supabase aktif. Data akan dibaca dari PostgreSQL jika tabel sudah terisi. Jika tabel kosong, sistem otomatis memakai GeoJSON agar peta tetap tampil.'
    : 'Supabase belum dikonfigurasi. Data masih memakai GeoJSON lokal dari folder assets/geojson.';
  el.innerHTML = `<h2>Dashboard</h2><div class="admin-grid">${cards}</div><div class="notice">${status}</div>`;
}
async function renderAdminFeatures() {
  const el = $('admin-features');
  el.innerHTML = `<h2>Data Geospasial</h2>
    <div class="admin-toolbar">
      <div><label>Layer</label><select id="adminLayerSelect">${Object.keys(layerConfig).map(k => `<option value="${k}" ${k === currentAdminLayer ? 'selected' : ''}>${esc(layerConfig[k].label)}</option>`).join('')}</select></div>
      <button id="btnRefreshFeatures" class="primary-btn">Refresh</button>
      <button id="btnSyncLayer" class="secondary-btn">Sinkron GeoJSON ke Supabase</button>
    </div>
    <div class="notice">Tabel menampilkan maksimal 80 data pertama. Untuk mengisi PostgreSQL online, login admin lalu klik Sinkron GeoJSON ke Supabase per layer.</div>
    <div class="form-card">
      <h3>Tambah Data Manual</h3>
      <div class="form-grid">
        <div><label>Nama</label><input id="newFeatureName" class="input"></div>
        <div><label>Telepon</label><input id="newFeaturePhone" class="input"></div>
        <div><label>Website</label><input id="newFeatureWebsite" class="input"></div>
        <div><label>Alamat</label><input id="newFeatureAddress" class="input"></div>
      </div>
      <label>Geometry GeoJSON</label><textarea id="newFeatureGeom" placeholder='{"type":"Point","coordinates":[109.67,-6.89]}'></textarea>
      <button id="btnAddFeature" class="primary-btn">Tambah ke Supabase</button>
    </div>
    <div id="featureTableBox"><div class="notice">Memuat data...</div></div>`;
  $('adminLayerSelect').addEventListener('change', e => { currentAdminLayer = e.target.value; renderAdminFeatures(); });
  $('btnRefreshFeatures').addEventListener('click', () => loadAdminFeatureTable());
  $('btnAddFeature').addEventListener('click', addAdminFeature);
  $('btnSyncLayer').addEventListener('click', syncCurrentLayerToSupabase);
  loadAdminFeatureTable();
}
async function getAdminFeatureRows(layerKey) {
  if (sb) {
    const { data, error } = await sb
      .from('webgis_features')
      .select('id,layer_key,source_uid,name,category,phone,address,website,properties,geometry,updated_at')
      .eq('layer_key', layerKey)
      .order('id', { ascending: true })
      .limit(80);
    if (!error && data && data.length) return data;
  }
  const fc = loadedData[layerKey] || await fetchLayerGeojson(layerKey);
  return (fc.features || []).slice(0, 80).map((feature, idx) => ({ ...featureToDbRow(layerKey, feature, idx), id: '-', __local: true }));
}
async function loadAdminFeatureTable() {
  const box = $('featureTableBox');
  box.innerHTML = '<div class="notice">Memuat data...</div>';
  try {
    const rowsData = await getAdminFeatureRows(currentAdminLayer);
    const rows = rowsData.map(row => `<tr>
      <td>${esc(row.id)}</td><td>${esc(row.name || '-')}</td><td>${esc(row.phone || '-')}</td><td>${esc(row.address || '-')}</td>
      <td class="action-cell"><button class="small-btn" data-edit-feature="${esc(row.id)}">Edit</button> <button class="small-btn" data-copy-geom="${esc(row.id)}">Copy Geometry</button> <button class="small-btn" data-delete-feature="${esc(row.id)}">Hapus</button></td>
    </tr>`).join('') || '<tr><td colspan="5">Belum ada data.</td></tr>';
    box.innerHTML = `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Nama</th><th>Telepon</th><th>Alamat</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    window.__adminFeatureRows = rowsData;
    qsa('[data-edit-feature]').forEach(btn => btn.addEventListener('click', () => editAdminFeature(btn.dataset.editFeature)));
    qsa('[data-delete-feature]').forEach(btn => btn.addEventListener('click', () => deleteAdminFeature(btn.dataset.deleteFeature)));
    qsa('[data-copy-geom]').forEach(btn => btn.addEventListener('click', () => copyFeatureGeometry(btn.dataset.copyGeom)));
  } catch (err) {
    box.innerHTML = `<div class="notice">Gagal memuat data: ${esc(err.message)}</div>`;
  }
}
function getAdminRow(id) { return (window.__adminFeatureRows || []).find(r => String(r.id) === String(id)); }
async function requireSupabaseWrite() {
  if (!sb) throw new Error('Supabase belum dikonfigurasi. Isi supabase-config.js terlebih dahulu.');
  const signed = await hasSupabaseSession();
  if (!signed) throw new Error('Belum login Supabase Auth. Buat user admin@webgis.local di Supabase Authentication, lalu login ulang.');
}
async function addAdminFeature() {
  try {
    await requireSupabaseWrite();
    const geometry = JSON.parse($('newFeatureGeom').value);
    const props = { name: $('newFeatureName').value.trim(), phone: $('newFeaturePhone').value.trim(), website: $('newFeatureWebsite').value.trim(), address: $('newFeatureAddress').value.trim() };
    const body = {
      layer_key: currentAdminLayer,
      source_uid: 'manual-' + Date.now(),
      name: props.name || 'Data Baru',
      category: layerConfig[currentAdminLayer].label,
      phone: props.phone || null,
      website: props.website || null,
      address: props.address || null,
      properties: props,
      geometry
    };
    const { error } = await sb.from('webgis_features').insert(body);
    if (error) throw error;
    showNotif('Data berhasil ditambahkan ke Supabase.', 'success');
    await reloadMapData();
    renderAdminFeatures();
  } catch (err) { showNotif(err.message); }
}
async function editAdminFeature(id) {
  const row = getAdminRow(id);
  if (!row) return;
  if (row.__local) return showNotif('Data ini masih dari GeoJSON lokal. Klik Sinkron GeoJSON ke Supabase dulu sebelum edit permanen.');
  const name = prompt('Nama', row.name || '') ?? row.name;
  const phone = prompt('Telepon', row.phone || '') ?? row.phone;
  const website = prompt('Website', row.website || '') ?? row.website;
  const address = prompt('Alamat', row.address || '') ?? row.address;
  try {
    await requireSupabaseWrite();
    const props = { ...(row.properties || {}), name, phone, website, address };
    const { error } = await sb.from('webgis_features').update({ name, phone, website, address, properties: props, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    showNotif('Data diperbarui di Supabase.', 'success');
    await reloadMapData();
    loadAdminFeatureTable();
  } catch (err) { showNotif(err.message); }
}
async function deleteAdminFeature(id) {
  const row = getAdminRow(id);
  if (!row) return;
  if (row.__local) return showNotif('Data ini masih dari GeoJSON lokal. Klik Sinkron GeoJSON ke Supabase dulu sebelum hapus permanen.');
  if (!confirm('Hapus data ID ' + id + ' dari Supabase?')) return;
  try {
    await requireSupabaseWrite();
    const { error } = await sb.from('webgis_features').delete().eq('id', id);
    if (error) throw error;
    showNotif('Data dihapus dari Supabase.', 'success');
    await reloadMapData();
    loadAdminFeatureTable();
  } catch (err) { showNotif(err.message); }
}
function copyFeatureGeometry(id) {
  const row = getAdminRow(id);
  if (!row) return;
  navigator.clipboard?.writeText(JSON.stringify(row.geometry, null, 2));
  $('newFeatureGeom').value = JSON.stringify(row.geometry, null, 2);
  showNotif('Geometry disalin ke form.', 'success');
}
async function syncCurrentLayerToSupabase() {
  try {
    await requireSupabaseWrite();
    const localData = await fetchLocalGeojson(currentAdminLayer);
    const rows = localData.features.map((feature, idx) => featureToDbRow(currentAdminLayer, feature, idx));
    if (!confirm(`Sinkron ${rows.length} data ${layerConfig[currentAdminLayer].label} ke Supabase? Proses bisa memakan waktu.`)) return;
    const btn = $('btnSyncLayer');
    btn.disabled = true;
    const batchSize = currentAdminLayer === 'bangunan' ? 80 : 200;
    for (let i = 0; i < rows.length; i += batchSize) {
      btn.textContent = `Sinkron ${Math.min(i + batchSize, rows.length)}/${rows.length}`;
      const batch = rows.slice(i, i + batchSize);
      const { error } = await sb.from('webgis_features').upsert(batch, { onConflict: 'layer_key,source_uid' });
      if (error) throw error;
    }
    btn.disabled = false;
    btn.textContent = 'Sinkron GeoJSON ke Supabase';
    showNotif('Sinkronisasi selesai.', 'success');
    await reloadMapData();
    loadAdminFeatureTable();
  } catch (err) {
    const btn = $('btnSyncLayer');
    if (btn) { btn.disabled = false; btn.textContent = 'Sinkron GeoJSON ke Supabase'; }
    showNotif(err.message);
  }
}
async function reloadMapData() {
  for (const key of Object.keys(layerConfig)) {
    loadedData[key] = await fetchLayerGeojson(key);
    if (map.getSource(key)) map.getSource(key).setData(loadedData[key]);
  }
  loadStats().then(renderStatsPanel).catch(() => renderStatsPanel());
}
async function renderAdminLayers() {
  const el = $('admin-layers');
  const rows = Object.keys(layerConfig).map(key => ({ layer_key: key, layer_name: layerConfig[key].label, color: layerConfig[key].color, outline_color: layerConfig[key].outline, feature_count: loadedData[key]?.features?.length || 0 }));
  el.innerHTML = `<h2>Layer</h2><div class="notice">Perubahan warna/nama layer dapat disimpan ke Supabase jika konfigurasi dan Auth sudah aktif.</div><div class="table-wrap"><table><thead><tr><th>Key</th><th>Nama</th><th>Warna</th><th>Outline</th><th>Jumlah</th><th>Aksi</th></tr></thead><tbody>${rows.map(l => `<tr>
    <td>${esc(l.layer_key)}</td><td><input class="input" id="lname-${l.layer_key}" value="${esc(l.layer_name)}"></td>
    <td><input class="input" id="lcolor-${l.layer_key}" value="${esc(l.color)}"></td>
    <td><input class="input" id="loutline-${l.layer_key}" value="${esc(l.outline_color)}"></td>
    <td>${l.feature_count}</td><td><button class="small-btn" data-save-layer="${l.layer_key}">Simpan</button></td>
  </tr>`).join('')}</tbody></table></div>`;
  qsa('[data-save-layer]').forEach(btn => btn.addEventListener('click', () => saveAdminLayer(btn.dataset.saveLayer)));
}
async function saveAdminLayer(key) {
  try {
    const next = { layer_key: key, layer_name: $('lname-' + key).value, color: $('lcolor-' + key).value, outline_color: $('loutline-' + key).value, is_active: true };
    layerConfig[key].label = next.layer_name;
    layerConfig[key].color = next.color;
    layerConfig[key].outline = next.outline_color;
    if (sb) {
      await requireSupabaseWrite();
      const { error } = await sb.from('webgis_layers').upsert(next, { onConflict: 'layer_key' });
      if (error) throw error;
    }
    if (map.getLayer(key + '-fill')) map.setPaintProperty(key + '-fill', 'fill-color', layerConfig[key].color);
    if (map.getLayer(key + '-outline')) map.setPaintProperty(key + '-outline', 'line-color', layerConfig[key].outline);
    renderLayerControls();
    showNotif('Layer disimpan.', 'success');
  } catch (err) { showNotif(err.message); }
}
function renderAdminUsers() {
  const el = $('admin-users');
  el.innerHTML = `<h2>Pengguna</h2>
    <div class="notice">Untuk versi GitHub Pages + Supabase, akun admin dibuat melalui Supabase Authentication. Buat user dengan email <b>${esc(ADMIN_EMAIL)}</b> dan password <b>admin123</b>. User umum dapat mengakses peta tanpa login.</div>
    <div class="table-wrap"><table><thead><tr><th>Nama</th><th>Username</th><th>Role</th><th>Keterangan</th></tr></thead><tbody>
      <tr><td>Administrator WebGIS</td><td>admin</td><td><span class="role-pill role-admin">admin</span></td><td>Mengelola data</td></tr>
      <tr><td>Pengunjung</td><td>-</td><td><span class="role-pill role-guest">user umum</span></td><td>Melihat peta</td></tr>
    </tbody></table></div>`;
}
function renderAdminTesting() {
  $('admin-testing').innerHTML = `<h2>Rancangan Pengujian</h2>
    <div class="test-list">
      <div class="test-item"><b>Functionality</b><p>Uji login admin, peta tampil, layer tampil, popup ringkas muncul, pencarian berjalan, dan admin dapat edit data Supabase.</p></div>
      <div class="test-item"><b>Usability</b><p>Uji kemudahan navigasi, keterbacaan menu, tampilan popup, dan kemudahan pencarian data.</p></div>
      <div class="test-item"><b>Performance</b><p>Uji waktu muat halaman dan waktu tampil layer dari GeoJSON/Supabase.</p></div>
      <div class="test-item"><b>Compatibility</b><p>Uji website pada Chrome/Edge dan resolusi desktop/mobile.</p></div>
    </div>`;
}

function bindUi() {
  $('btnEnterMap').addEventListener('click', () => { $('landingPage').style.display = 'none'; setTimeout(() => { map.resize(); if (hasBounds) map.fitBounds(bounds, { padding: { top: 90, right: 390, bottom: 80, left: 330 }, maxZoom: 17 }); }, 120); });
  $('btnLandingLogin').addEventListener('click', showLogin);
  $('btnHome').addEventListener('click', () => { if (isQgisActive()) closeQgisFullscreen(); if (hasBounds) map.fitBounds(bounds, { padding: { top: 90, right: 390, bottom: 80, left: 330 }, maxZoom: 17, duration: 700 }); });
  $('btnCenter').addEventListener('click', () => {
    if (!navigator.geolocation) return showNotif('Browser tidak mendukung geolocation.');
    const btn = $('btnCenter'); btn.disabled = true; btn.textContent = 'Mencari...';
    navigator.geolocation.getCurrentPosition(pos => {
      const coord = [pos.coords.longitude, pos.coords.latitude];
      if (userMarker) userMarker.remove();
      userMarker = new mapboxgl.Marker({ color: bounds.contains(coord) ? '#4f6f52' : '#d97891' }).setLngLat(coord).addTo(map);
      map.flyTo({ center: coord, zoom: bounds.contains(coord) ? 17 : 13 });
      showNotif(bounds.contains(coord) ? 'Lokasi berhasil ditemukan.' : 'Lokasi berada di luar cakupan peta.', bounds.contains(coord) ? 'success' : 'error');
      btn.disabled = false; btn.textContent = 'Lokasi Anda';
    }, () => { showNotif('Lokasi tidak bisa diakses.'); btn.disabled = false; btn.textContent = 'Lokasi Anda'; }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
  $('btnToggleMenu').addEventListener('click', () => $('sidebar').classList.add('show'));
  $('btnCloseSidebar').addEventListener('click', () => $('sidebar').classList.remove('show'));
  qsa('.sidebar-tab').forEach(btn => btn.addEventListener('click', () => {
    qsa('.sidebar-tab').forEach(b => b.classList.remove('active'));
    qsa('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active'); $('tab-' + btn.dataset.tab).classList.add('active');
  }));
  qsa('[data-profile]').forEach(btn => btn.addEventListener('click', () => {
    qsa('[data-profile]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    routingProfile = btn.dataset.profile;
    resetJourneySimulation();
    setJourneyUi('Belum dimulai', 0);
    if (startCoord && endCoord) drawRoute();
  }));
  qsa('[data-vehicle]').forEach(btn => btn.addEventListener('click', () => {
    journeyVehicle = btn.dataset.vehicle || 'car';
    routingProfile = 'driving';
    qsa('[data-profile]').forEach(b => b.classList.toggle('active', b.dataset.profile === 'driving'));
    updateVehiclePicker();
    resetJourneySimulation();
    setJourneyUi('Belum dimulai', 0);
    if (startCoord && endCoord) drawRoute();
  }));
  updateVehiclePicker();
  $('btnRoute').addEventListener('click', drawRoute);
  $('btnClearRoute').addEventListener('click', clearRoute);
  const startJourneyBtn = $('btnStartJourney');
  if (startJourneyBtn) startJourneyBtn.addEventListener('click', startJourneySimulation);
  const pauseJourneyBtn = $('btnPauseJourney');
  if (pauseJourneyBtn) pauseJourneyBtn.addEventListener('click', pauseJourneySimulation);
  const resetJourneyBtn = $('btnResetJourney');
  if (resetJourneyBtn) resetJourneyBtn.addEventListener('click', resetJourneySimulation);
  $('btnOpenQgisFullscreen').addEventListener('click', openQgisFullscreen);
  $('btnOpenQgisFullscreen2').addEventListener('click', openQgisFullscreen);
  $('btnCloseQgisInline').addEventListener('click', closeQgisFullscreen);
  $('qgisFullscreenFrame').addEventListener('load', () => setTimeout(qgisBindClickRouting, 800));
  $('btnLoginSubmit').addEventListener('click', doLogin);
  $('btnLoginCancel').addEventListener('click', hideLogin);
  $('btnCloseAdminPanel').addEventListener('click', closeAdminPanel);
  qsa('.admin-nav-item').forEach(btn => btn.addEventListener('click', () => navigateAdmin(btn.dataset.section)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { hideLogin(); $('sidebar').classList.remove('show'); } if (e.key === 'Enter' && !$('loginOverlay').classList.contains('hidden')) doLogin(); });
  attachPlaceSearch('placeSearch', 'placeResults');
  attachPlaceSearch('placeSearchSidebar', 'placeResultsSidebar');
  attachFeatureSearch('featureSearch', 'featureResults');
  attachFeatureSearch('featureSearchSidebar', 'featureResultsSidebar');

  const bind = (id, event, handler) => { const el = $(id); if (el) el.addEventListener(event, handler); };
  bind('basemapSelect', 'change', e => changeBasemap(e.target.value));
  bind('btnZoomAll', 'click', fitAllLayers);
  bind('btnFullscreenMap', 'click', openFullscreenMap);
  bind('btnPrintMap', 'click', () => window.print());
  bind('btnDownloadGeojson', 'click', exportSelectedGeojson);
  bind('btnDownloadCsv', 'click', exportSelectedCsv);
  bind('btnFindNearest', 'click', findNearestFacilities);
  bind('btnMeasureStart', 'click', startMeasure);
  bind('btnMeasureClear', 'click', clearMeasure);
  refreshToolLayerOptions();
  renderStatsPanel();
}

map.on('click', e => {
  if (isQgisActive()) return;
  const coord = [e.lngLat.lng, e.lngLat.lat];
  if (measureActive) handleMeasurePoint(coord);
  else handleRoutePoint(coord);
});
map.on('load', async () => {
  try {
    await addMapLayers();
  } catch (err) {
    console.error(err);
    showNotif('Data peta gagal dimuat. Cek backend atau file GeoJSON.');
  }
});

bindUi();
updateHeaderAuth();
loadStats().then(renderStatsPanel).catch(() => renderStatsPanel());
