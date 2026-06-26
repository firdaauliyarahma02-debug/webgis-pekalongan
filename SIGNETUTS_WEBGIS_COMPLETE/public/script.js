/* SIGNETUTS WebGIS v2 — frontend + API PostgreSQL/PostGIS */
mapboxgl.accessToken = 'pk.eyJ1IjoiZmlyZGFhdWxpeWFyYWhtYSIsImEiOiJjbW5wdnI2eWQwMHZ4MzBwc2E5aGNkbm1oIn0.jLkgH9Y1ywcPyrg19wPi9w';

const API_BASE = location.port === '5500' ? 'http://localhost:3000' : '';
const TOKEN_KEY = 'signetuts_token';
const USER_KEY = 'signetuts_user';

let layerConfig = {
  bangunan: { label: 'Bangunan Umum', color: '#d6a15d', outline: '#8a6230' },
  hotel: { label: 'Hotel', color: '#6aa6a1', outline: '#4f6f52' },
  rs: { label: 'Rumah Sakit', color: '#d97891', outline: '#9f4a60' },
  sekolah: { label: 'Sekolah', color: '#9fbea5', outline: '#4f6f52' }
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

const $ = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));

let loadedData = {};
let bounds = new mapboxgl.LngLatBounds();
let hasBounds = false;
let userMarker = null;
let routingProfile = 'driving';
let startCoord = null;
let endCoord = null;
let startMarker = null;
let endMarker = null;
let currentAdminSection = 'dashboard';
let currentAdminLayer = 'sekolah';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [109.67, -6.89],
  zoom: 14
});
map.addControl(new mapboxgl.NavigationControl(), 'top-left');
map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-right');

function apiUrl(path) { return API_BASE + path; }
function token() { return localStorage.getItem(TOKEN_KEY); }
function currentUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
}
function isAdmin() { return currentUser()?.role === 'admin'; }
function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (token()) h.Authorization = 'Bearer ' + token();
  return h;
}
async function api(path, options = {}) {
  const res = await fetch(apiUrl(path), {
    ...options,
    headers: { ...(options.headers || {}), ...(options.body ? authHeaders() : (token() ? { Authorization: 'Bearer ' + token() } : {})) }
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.message || data.detail || 'Request gagal');
  return data;
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

async function loadLayerMeta() {
  try {
    const data = await api('/api/layers');
    data.data.forEach(row => {
      layerConfig[row.layer_key] = {
        label: row.layer_name,
        color: row.color,
        outline: row.outline_color,
        isActive: row.is_active,
        count: row.feature_count
      };
    });
  } catch (err) {
    console.warn('Gagal mengambil metadata layer dari API. Pakai konfigurasi lokal.', err);
  }
}

async function fetchLayerGeojson(key) {
  try {
    return await api('/api/features/' + key);
  } catch (err) {
    console.warn('API layer gagal, fallback GeoJSON lokal:', key, err.message);
    const res = await fetch(fallbackFiles[key]);
    if (!res.ok) throw new Error('Gagal memuat data ' + key);
    return await res.json();
  }
}

async function loadStats() {
  try {
    const stats = await api('/api/stats');
    const byKey = Object.fromEntries(stats.layers.map(l => [l.layer_key, l.total]));
    $('metricBangunan').textContent = byKey.bangunan ?? '-';
    $('metricHotel').textContent = byKey.hotel ?? '-';
    $('metricRS').textContent = byKey.rs ?? '-';
    $('metricSekolah').textContent = byKey.sekolah ?? '-';
  } catch {
    $('metricBangunan').textContent = '-';
    $('metricHotel').textContent = '-';
    $('metricRS').textContent = '-';
    $('metricSekolah').textContent = '-';
  }
}

function popupHtml(props) {
  const title = esc(getFeatureLabel(props));
  const keys = Object.keys(props || {}).filter(k => props[k] !== null && props[k] !== undefined && String(props[k]).trim() !== '');
  const rows = keys.slice(0, 18).map(k => `<tr><td>${esc(k)}</td><td>${esc(props[k])}</td></tr>`).join('');
  return `<div class="popup-title">${title}</div><table class="popup-table">${rows}</table>`;
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

    map.on('click', key + '-fill', e => {
      e.originalEvent.stopPropagation();
      const props = e.features[0].properties || {};
      new mapboxgl.Popup().setLngLat(e.lngLat).setHTML(popupHtml(props)).addTo(map);
    });
    map.on('mouseenter', key + '-fill', () => { if (!isQgisActive()) map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', key + '-fill', () => map.getCanvas().style.cursor = '');
  }

  if (hasBounds) map.fitBounds(bounds, { padding: { top: 90, right: 390, bottom: 80, left: 330 }, maxZoom: 17, duration: 700 });
  renderLayerControls();
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
function clearRoute() {
  startCoord = null; endCoord = null;
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
      if (map.getSource('route')) map.getSource('route').setData(routeData);
      else {
        map.addSource('route', { type: 'geojson', data: routeData });
        map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#d97891', 'line-width': 5 } });
      }
      const b = new mapboxgl.LngLatBounds();
      routeData.geometry.coordinates.forEach(c => b.extend(c));
      map.fitBounds(b, { padding: 90, duration: 750 });
    }
    $('routeInfo').innerHTML = `<b>Jarak:</b> ${(data.routes[0].distance / 1000).toFixed(2)} km<br><b>Estimasi:</b> ${Math.round(data.routes[0].duration / 60)} menit`;
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

/* Auth & Admin */
function showLogin() { $('loginOverlay').classList.remove('hidden'); setTimeout(() => $('loginUsername').focus(), 80); }
function hideLogin() { $('loginOverlay').classList.add('hidden'); $('loginError').textContent = ''; }
async function doLogin() {
  const username = $('loginUsername').value.trim();
  const password = $('loginPassword').value;
  if (!username || !password) return $('loginError').textContent = 'Username dan password wajib diisi.';
  const btn = $('btnLoginSubmit');
  btn.disabled = true; btn.textContent = 'Memproses...';
  try {
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    hideLogin();
    updateHeaderAuth();
    openAdminPanel();
    showNotif('Login berhasil.', 'success');
  } catch (err) {
    $('loginError').textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Masuk';
  }
}
function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  updateHeaderAuth();
  closeAdminPanel();
}
function updateHeaderAuth() {
  qsa('.auth-dynamic').forEach(el => el.remove());
  const actions = qs('.topbar__actions');
  const user = currentUser();
  if (user) {
    const badge = document.createElement('div');
    badge.id = 'userBadge'; badge.className = 'auth-dynamic';
    badge.innerHTML = `${esc(user.full_name)} <span class="role-pill ${user.role === 'admin' ? 'role-admin' : 'role-guest'}">${esc(user.role)}</span>`;
    actions.prepend(badge);
    if (user.role === 'admin') {
      const adminBtn = document.createElement('button');
      adminBtn.className = 'btn auth-dynamic'; adminBtn.textContent = 'Admin Panel';
      adminBtn.addEventListener('click', openAdminPanel);
      actions.appendChild(adminBtn);
    }
    const out = document.createElement('button');
    out.className = 'btn ghost auth-dynamic'; out.textContent = 'Keluar';
    out.addEventListener('click', logout);
    actions.appendChild(out);
  } else {
    const login = document.createElement('button');
    login.className = 'btn ghost auth-dynamic'; login.textContent = 'Login Admin';
    login.addEventListener('click', showLogin);
    actions.appendChild(login);
  }
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
async function renderAdminDashboard() {
  const el = $('admin-dashboard');
  el.innerHTML = '<div class="notice">Memuat dashboard...</div>';
  try {
    const stats = await api('/api/stats');
    const cards = stats.layers.map(l => `<div class="admin-card"><b>${l.total}</b><span>${esc(l.layer_name)}</span></div>`).join('');
    el.innerHTML = `<h2>Dashboard</h2><div class="admin-grid">${cards}</div><div class="notice">Data peta sekarang diambil dari PostgreSQL/PostGIS melalui API backend. Akun admin dapat mengelola data geospasial dan pengguna.</div>`;
  } catch (err) {
    el.innerHTML = `<div class="notice">Gagal memuat dashboard: ${esc(err.message)}</div>`;
  }
}
async function renderAdminFeatures() {
  const el = $('admin-features');
  el.innerHTML = `<h2>Data Geospasial</h2>
    <div class="admin-toolbar">
      <div><label>Layer</label><select id="adminLayerSelect">${Object.keys(layerConfig).map(k => `<option value="${k}" ${k === currentAdminLayer ? 'selected' : ''}>${esc(layerConfig[k].label)}</option>`).join('')}</select></div>
      <button id="btnRefreshFeatures" class="primary-btn">Refresh</button>
    </div>
    <div class="form-card">
      <h3>Tambah Data Manual</h3>
      <div class="notice">Untuk pengisian cepat saat demo, data baru memakai geometry GeoJSON Polygon/MultiPolygon. Cara termudah: ambil contoh geometry dari tabel di bawah, lalu ubah atributnya.</div>
      <div class="form-grid">
        <div><label>Nama</label><input id="newFeatureName" class="input"></div>
        <div><label>Telepon</label><input id="newFeaturePhone" class="input"></div>
        <div><label>Website</label><input id="newFeatureWebsite" class="input"></div>
        <div><label>Alamat</label><input id="newFeatureAddress" class="input"></div>
      </div>
      <label>Properties JSON</label><textarea id="newFeatureProps">{}</textarea>
      <label>Geometry GeoJSON</label><textarea id="newFeatureGeom" placeholder='{"type":"MultiPolygon","coordinates":[...]}'></textarea>
      <button id="btnAddFeature" class="primary-btn">Tambah Data</button>
    </div>
    <div id="featureTableBox"><div class="notice">Memuat data...</div></div>`;
  $('adminLayerSelect').addEventListener('change', e => { currentAdminLayer = e.target.value; renderAdminFeatures(); });
  $('btnRefreshFeatures').addEventListener('click', () => loadAdminFeatureTable());
  $('btnAddFeature').addEventListener('click', addAdminFeature);
  loadAdminFeatureTable();
}
async function loadAdminFeatureTable() {
  const box = $('featureTableBox');
  box.innerHTML = '<div class="notice">Memuat data...</div>';
  try {
    const data = await api('/api/admin/features/' + currentAdminLayer);
    const rows = data.data.map(row => `<tr>
      <td>${row.id}</td><td>${esc(row.name)}</td><td>${esc(row.phone || '-')}</td><td>${esc(row.address || '-')}</td>
      <td class="action-cell"><button class="small-btn" data-edit-feature="${row.id}">Edit</button> <button class="small-btn" data-copy-geom="${row.id}">Copy Geometry</button> <button class="small-btn" data-delete-feature="${row.id}">Hapus</button></td>
    </tr>`).join('') || '<tr><td colspan="5">Belum ada data.</td></tr>';
    box.innerHTML = `<div class="table-wrap"><table><thead><tr><th>ID</th><th>Nama</th><th>Telepon</th><th>Alamat</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    window.__adminFeatureRows = data.data;
    qsa('[data-edit-feature]').forEach(btn => btn.addEventListener('click', () => editAdminFeature(Number(btn.dataset.editFeature))));
    qsa('[data-delete-feature]').forEach(btn => btn.addEventListener('click', () => deleteAdminFeature(Number(btn.dataset.deleteFeature))));
    qsa('[data-copy-geom]').forEach(btn => btn.addEventListener('click', () => copyFeatureGeometry(Number(btn.dataset.copyGeom))));
  } catch (err) {
    box.innerHTML = `<div class="notice">Gagal memuat data: ${esc(err.message)}</div>`;
  }
}
function getAdminRow(id) { return (window.__adminFeatureRows || []).find(r => Number(r.id) === Number(id)); }
async function addAdminFeature() {
  try {
    const body = {
      name: $('newFeatureName').value.trim(),
      phone: $('newFeaturePhone').value.trim(),
      website: $('newFeatureWebsite').value.trim(),
      address: $('newFeatureAddress').value.trim(),
      properties: JSON.parse($('newFeatureProps').value || '{}'),
      geometry: JSON.parse($('newFeatureGeom').value)
    };
    await api('/api/admin/features/' + currentAdminLayer, { method: 'POST', body: JSON.stringify(body) });
    showNotif('Data berhasil ditambahkan.', 'success');
    await reloadMapData();
    renderAdminFeatures();
  } catch (err) { showNotif(err.message); }
}
async function editAdminFeature(id) {
  const row = getAdminRow(id);
  if (!row) return;
  const name = prompt('Nama', row.name || '') ?? row.name;
  const phone = prompt('Telepon', row.phone || '') ?? row.phone;
  const website = prompt('Website', row.website || '') ?? row.website;
  const address = prompt('Alamat', row.address || '') ?? row.address;
  let props;
  try { props = JSON.parse(prompt('Properties JSON', JSON.stringify(row.properties || {}, null, 2)) || '{}'); }
  catch { return showNotif('Properties JSON tidak valid.'); }
  try {
    await api(`/api/admin/features/${currentAdminLayer}/${id}`, { method: 'PUT', body: JSON.stringify({ name, phone, website, address, properties: props }) });
    showNotif('Data diperbarui.', 'success');
    await reloadMapData();
    loadAdminFeatureTable();
  } catch (err) { showNotif(err.message); }
}
async function deleteAdminFeature(id) {
  if (!confirm('Hapus data ID ' + id + '?')) return;
  try {
    await api(`/api/admin/features/${currentAdminLayer}/${id}`, { method: 'DELETE', body: '{}' });
    showNotif('Data dihapus.', 'success');
    await reloadMapData();
    loadAdminFeatureTable();
  } catch (err) { showNotif(err.message); }
}
function copyFeatureGeometry(id) {
  const row = getAdminRow(id);
  if (!row) return;
  navigator.clipboard?.writeText(JSON.stringify(row.geometry, null, 2));
  $('newFeatureGeom').value = JSON.stringify(row.geometry, null, 2);
  showNotif('Geometry disalin ke form tambah data.', 'success');
}
async function reloadMapData() {
  for (const key of Object.keys(layerConfig)) {
    loadedData[key] = await fetchLayerGeojson(key);
    if (map.getSource(key)) map.getSource(key).setData(loadedData[key]);
  }
  loadStats();
}
async function renderAdminLayers() {
  const el = $('admin-layers');
  el.innerHTML = '<div class="notice">Memuat layer...</div>';
  try {
    const data = await api('/api/layers');
    const rows = data.data.map(l => `<tr>
      <td>${esc(l.layer_key)}</td><td><input class="input" id="lname-${l.layer_key}" value="${esc(l.layer_name)}"></td>
      <td><input class="input" id="lcolor-${l.layer_key}" value="${esc(l.color)}"></td>
      <td><input class="input" id="loutline-${l.layer_key}" value="${esc(l.outline_color)}"></td>
      <td>${l.feature_count}</td><td><button class="small-btn" data-save-layer="${l.layer_key}">Simpan</button></td>
    </tr>`).join('');
    el.innerHTML = `<h2>Layer</h2><div class="table-wrap"><table><thead><tr><th>Key</th><th>Nama</th><th>Warna</th><th>Outline</th><th>Jumlah</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    qsa('[data-save-layer]').forEach(btn => btn.addEventListener('click', () => saveAdminLayer(btn.dataset.saveLayer)));
  } catch (err) { el.innerHTML = `<div class="notice">Gagal memuat layer: ${esc(err.message)}</div>`; }
}
async function saveAdminLayer(key) {
  try {
    await api('/api/layers/' + key, { method: 'PUT', body: JSON.stringify({ layer_name: $('lname-' + key).value, color: $('lcolor-' + key).value, outline_color: $('loutline-' + key).value }) });
    showNotif('Layer disimpan.', 'success');
    await loadLayerMeta();
    Object.keys(layerConfig).forEach(k => {
      if (map.getLayer(k + '-fill')) map.setPaintProperty(k + '-fill', 'fill-color', layerConfig[k].color);
      if (map.getLayer(k + '-outline')) map.setPaintProperty(k + '-outline', 'line-color', layerConfig[k].outline);
    });
    renderLayerControls();
  } catch (err) { showNotif(err.message); }
}
async function renderAdminUsers() {
  const el = $('admin-users');
  el.innerHTML = '<div class="notice">Memuat pengguna...</div>';
  try {
    const data = await api('/api/admin/users');
    const rows = data.data.map(u => `<tr><td>${esc(u.full_name)}</td><td>${esc(u.username)}</td><td><span class="role-pill ${u.role === 'admin' ? 'role-admin' : 'role-guest'}">${esc(u.role)}</span></td><td>${new Date(u.created_at).toLocaleString('id-ID')}</td></tr>`).join('');
    el.innerHTML = `<h2>Pengguna</h2>
      <div class="form-card"><h3>Tambah Pengguna</h3><div class="form-grid">
        <div><label>Nama Lengkap</label><input id="uFullName" class="input"></div>
        <div><label>Username</label><input id="uUsername" class="input"></div>
        <div><label>Password</label><input id="uPassword" class="input" type="password"></div>
        <div><label>Role</label><select id="uRole"><option value="guest">guest</option><option value="admin">admin</option></select></div>
      </div><button id="btnAddUser" class="primary-btn">Tambah Pengguna</button></div>
      <div class="table-wrap"><table><thead><tr><th>Nama</th><th>Username</th><th>Role</th><th>Dibuat</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    $('btnAddUser').addEventListener('click', addAdminUser);
  } catch (err) { el.innerHTML = `<div class="notice">Gagal memuat pengguna: ${esc(err.message)}</div>`; }
}
async function addAdminUser() {
  try {
    await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ username: $('uUsername').value.trim(), password: $('uPassword').value, full_name: $('uFullName').value.trim(), role: $('uRole').value }) });
    showNotif('Pengguna ditambahkan.', 'success');
    renderAdminUsers();
  } catch (err) { showNotif(err.message); }
}
function renderAdminTesting() {
  $('admin-testing').innerHTML = `<h2>Rancangan Pengujian</h2>
    <div class="test-list">
      <div class="test-item"><b>Functionality</b><p>Uji login admin, tampil layer, pencarian fitur, popup atribut, rute, tambah/edit/hapus data, dan endpoint API.</p></div>
      <div class="test-item"><b>Usability</b><p>Uji kemudahan penggunaan oleh minimal 5 responden menggunakan skala Likert 1–5 untuk navigasi, tampilan, keterbacaan, dan kemudahan pencarian.</p></div>
      <div class="test-item"><b>Performance</b><p>Uji waktu muat halaman, waktu tampil layer, dan respons pencarian. Target halaman utama dimuat kurang dari 5 detik pada koneksi normal.</p></div>
      <div class="test-item"><b>Compatibility</b><p>Uji tampilan pada Chrome/Edge dan resolusi desktop/mobile. Pastikan peta, panel, dan login tetap dapat digunakan.</p></div>
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
  qsa('[data-profile]').forEach(btn => btn.addEventListener('click', () => { qsa('[data-profile]').forEach(b => b.classList.remove('active')); btn.classList.add('active'); routingProfile = btn.dataset.profile; if (startCoord && endCoord) drawRoute(); }));
  $('btnRoute').addEventListener('click', drawRoute);
  $('btnClearRoute').addEventListener('click', clearRoute);
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
}

map.on('click', e => { if (!isQgisActive()) handleRoutePoint([e.lngLat.lng, e.lngLat.lat]); });
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
loadStats();
