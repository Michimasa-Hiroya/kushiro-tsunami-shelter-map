// ===== 状態 =====
let map, userMarker, routeLayer = null;
let shelters = [];
let currentLat = null, currentLng = null;
let allShelterLayer = null;
let allSheltersVisible = true;
let radiusCircles = [];
let tsunamiHeightM   = 0;  // シナリオ: 津波高さ（m）
let tsunamiArrivalMin = 0; // シナリオ: 到達時間（分）
let floodLayer = null;     // 浸水シミュレーションレイヤー

// 車圏内半径テーブル（分 → メートル）
const CAR_RADIUS_M = { 0: 0, 10: 3500, 15: 4200, 20: 7000 };

// ===== 橋データ（津波5m以上で警告表示）=====
// 座標はOpenStreetMap/Nominatimより取得
const BRIDGE_DATA = [
  { name: '幣舞橋',              lat: 42.9811, lng: 144.3855 },
  { name: '久寿里橋',            lat: 42.9830, lng: 144.3905 },
  { name: '旭橋',                lat: 42.9867, lng: 144.3956 },
  { name: '貝塚大橋',            lat: 42.9988, lng: 144.4090 },
  { name: '鉄北大橋',            lat: 43.0015, lng: 144.3619 },
  { name: '鳥取橋',              lat: 43.0075, lng: 144.3660 },
  { name: '鶴見橋',              lat: 43.0151, lng: 144.3709 },
  { name: '新川橋',              lat: 42.9991, lng: 144.3601 },
  { name: '西港大橋',            lat: 42.9977, lng: 144.3583 },
  { name: '釧路大橋',            lat: 42.9998, lng: 144.3607 },
  { name: '雪裡橋',              lat: 43.003596, lng: 144.417536 },
];

// ===== 渋滞予想スポット（津波5m以上で警告表示）=====
const CONGESTION_DATA = [
  { name: '星が浦東通り交差点',          lat: 43.026024, lng: 144.327877 },
  { name: '大楽毛・まりも国道交差点',    lat: 43.012010, lng: 144.265588 },
  { name: 'まりも国道',                  lat: 43.029806, lng: 144.257892 },
  { name: '星が浦北通交差点',            lat: 43.019576, lng: 144.290164 },
  { name: '旭橋通り交差点',              lat: 42.987373, lng: 144.393228 },
  { name: '貝塚光和通り交差点',          lat: 43.001082, lng: 144.402098 },
  { name: '釧路西IC付近',               lat: 43.036395, lng: 144.326544 },
  { name: '鶴野・湿原道路交差点',        lat: 43.038269, lng: 144.314385 },
  { name: '釧路中央IC付近',             lat: 43.028108, lng: 144.402046 },
  { name: '釧路東IC付近',               lat: 43.007235, lng: 144.424788 },
];

let warningMarkers = [];

// ===== 津波浸水シミュレーションレイヤー =====
// 浸水表示対象市町村（釧路市・釧路町・白糠町）のバウンディングボックス
// 釧路市・釧路町・白糠町の沿岸部のみ浸水表示（厚岸・根室等を除外）
const FLOOD_AREAS = [
  { latMin: 42.78, latMax: 43.13, lngMin: 144.08, lngMax: 144.55 }, // 釧路市（沿岸部）
  { latMin: 42.90, latMax: 43.17, lngMin: 144.40, lngMax: 144.68 }, // 釧路町（厚岸境界まで）
  { latMin: 42.60, latMax: 43.03, lngMin: 143.85, lngMax: 144.28 }, // 白糠町
];

// タイル(z,x,y)が対象市町村エリアと重なるか（粗いフィルタ）
function tileInFloodArea(z, x, y) {
  const n = Math.pow(2, z);
  const lngMin = x / n * 360 - 180;
  const lngMax = (x + 1) / n * 360 - 180;
  const latMax = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
  const latMin = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 1) / n))) * 180 / Math.PI;
  return FLOOD_AREAS.some(a =>
    latMax >= a.latMin && latMin <= a.latMax &&
    lngMax >= a.lngMin && lngMin <= a.lngMax
  );
}

// ピクセル単位で対象エリア内かチェック
function latLngInFloodArea(lat, lng) {
  return FLOOD_AREAS.some(a =>
    lat >= a.latMin && lat <= a.latMax && lng >= a.lngMin && lng <= a.lngMax
  );
}

// ===== 河川沿い補正（250m以内:+2m、250〜500m:+1m）=====
// 緯度1度≈111km、経度1度≈81.2km（@43°N）
const RLAT = 111000, RLNG = 81200;
const RIVER_BUF_NEAR2 = 250 * 250; // 250m（距離²）
const RIVER_BUF_FAR2  = 500 * 500; // 500m（距離²）

// 釧路川・新釧路川・阿寒川の代表ポリライン（橋梁座標ベース）
const RIVERS = [
  // 釧路川（海口〜上流）
  [[42.974,144.383],[42.981,144.386],[42.983,144.391],
   [42.987,144.396],[42.999,144.409],[43.004,144.418],
   [43.015,144.432],[43.030,144.450]],
  // 新釧路川（海口〜上流）
  [[42.993,144.353],[42.998,144.358],[42.999,144.361],
   [43.002,144.363],[43.008,144.366],[43.015,144.371],
   [43.022,144.378]],
  // 阿寒川（概略）
  [[43.004,144.418],[43.012,144.423],[43.022,144.430],[43.040,144.440]],
];

// 点→線分の距離²（m²）
function distSeg2(lat, lng, la, loa, lb, lob) {
  const px = (lng - loa) * RLNG, py = (lat - la) * RLAT;
  const bx = (lob - loa) * RLNG, by = (lb  - la) * RLAT;
  const len2 = bx * bx + by * by;
  if (len2 === 0) return px * px + py * py;
  const t = Math.max(0, Math.min(1, (px*bx + py*by) / len2));
  const dx = px - t*bx, dy = py - t*by;
  return dx*dx + dy*dy;
}

// 河川からの距離に応じたブースト量を返す（0/1/2）
function riverBoost(lat, lng) {
  let minD2 = Infinity;
  for (const r of RIVERS)
    for (let i = 0; i < r.length - 1; i++) {
      const d2 = distSeg2(lat, lng, r[i][0], r[i][1], r[i+1][0], r[i+1][1]);
      if (d2 < minD2) minD2 = d2;
    }
  if (minD2 <= RIVER_BUF_NEAR2) return 2; // 250m以内: +2m
  if (minD2 <= RIVER_BUF_FAR2)  return 1; // 250〜500m: +1m
  return 0;
}

// ===== 建物密集地区補正（津波-2m）=====
// 中部南地区（釧路駅ライン〜柳町公園ライン）・中部北地区・愛国地区・美原・芦野地区
const URBAN_DENSE = [
  { latMin: 42.974, latMax: 42.993, lngMin: 144.360, lngMax: 144.415 }, // 中部南
  { latMin: 42.993, latMax: 43.013, lngMin: 144.358, lngMax: 144.418 }, // 中部北
  { latMin: 43.000, latMax: 43.022, lngMin: 144.375, lngMax: 144.415 }, // 愛国西・愛国東地区
  { latMin: 43.012, latMax: 43.036, lngMin: 144.400, lngMax: 144.455 }, // 美原・芦野地区
];

function inUrbanDense(lat, lng) {
  return URBAN_DENSE.some(a =>
    lat >= a.latMin && lat <= a.latMax && lng >= a.lngMin && lng <= a.lngMax
  );
}

// 国土地理院 DEM PNG タイルから標高を復元（単位: m）
function decodeDEMElev(r, g, b) {
  const v = r * 65536 + g * 256 + b;
  if (v === 8388608) return null; // データなし（海・未計測）
  return v < 8388608 ? v * 0.01 : (v - 16777216) * 0.01;
}

// 浸水深に応じたRGBA色（ハザードマップ準拠グラデーション）
// effectiveH = maxH - 2m（建物等による減衰を考慮：20m津波→約18m浸水）
function getFloodRGBA(elev, maxH) {
  const effectiveH = maxH - 2; // 実際の浸水深は津波高さより約2m浅い
  if (elev === null || elev < 0 || elev >= effectiveH) return null;
  const d = effectiveH - elev; // 浸水深（m）
  if (d < 0.5)  return [255, 250, 160, 100]; // 薄黄（膝下程度）
  if (d < 3)    return [255, 190, 140, 130]; // 薄橙（1階浸水）
  if (d < 5)    return [255, 140, 110, 148]; // サーモン（2階床上）
  if (d < 10)   return [255,  80,  80, 158]; // ピンク（2階天井）
  if (d < 20)   return [220,  30, 100, 168]; // 濃ピンク（10〜20m）
  return               [190,  20, 170, 178]; // マゼンタ（20m超）
}

// Leaflet GridLayer を拡張して DEM タイルを処理するカスタムレイヤー
const FloodLayer = L.GridLayer.extend({
  createTile(coords, done) {
    const MAX_NATIVE_ZOOM = 14; // GSI DEM PNG の最大提供ズーム
    const sz = this.getTileSize();
    const canvas = document.createElement('canvas');
    canvas.width  = sz.x;
    canvas.height = sz.y;

    const targetH = tsunamiHeightM;
    if (targetH === 0) { done(null, canvas); return canvas; }

    // 高ズーム時は親タイル（MAX_NATIVE_ZOOM）から該当領域を切り出す
    const z = coords.z;
    let demZ = z, demX = coords.x, demY = coords.y;
    let srcX = 0, srcY = 0, srcW = sz.x, srcH = sz.y;

    if (z > MAX_NATIVE_ZOOM) {
      const zDiff  = z - MAX_NATIVE_ZOOM;
      const scale  = Math.pow(2, zDiff);   // 例: z=16 → scale=4
      demZ = MAX_NATIVE_ZOOM;
      demX = Math.floor(coords.x / scale);
      demY = Math.floor(coords.y / scale);
      srcW = Math.round(sz.x / scale);      // 親タイル内の切り出し幅
      srcH = Math.round(sz.y / scale);      // 親タイル内の切り出し高さ
      srcX = (coords.x % scale) * srcW;    // 親タイル内の開始X
      srcY = (coords.y % scale) * srcH;    // 親タイル内の開始Y
    }

    // 対象市町村（釧路市・釧路町・白糠町）範囲外は描画しない
    if (!tileInFloodArea(demZ, demX, demY)) { done(null, canvas); return canvas; }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // 一時キャンバスに親タイルの該当部分を等倍で取得（補間なし）
      const tmp = document.createElement('canvas');
      tmp.width  = sz.x;
      tmp.height = sz.y;
      const tctx = tmp.getContext('2d');
      tctx.imageSmoothingEnabled = false; // ニアレストネイバー（標高値を保持）
      tctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, sz.x, sz.y);

      try {
        const id = tctx.getImageData(0, 0, sz.x, sz.y);
        const px = id.data;

        // ピクセルごとの緯度・経度を事前計算（メルカトル投影）
        // 定数を事前計算して内ループの演算コストを削減
        const nDem = Math.pow(2, demZ);
        const lngs = new Float32Array(sz.x);
        const lats = new Float32Array(sz.y);
        const lngBase = (demX + srcX / sz.x) / nDem * 360 - 180;
        const lngStep = (srcW / sz.x) / sz.x / nDem * 360;
        for (let cx = 0; cx < sz.x; cx++) {
          lngs[cx] = lngBase + cx * lngStep;
        }
        const mercYBase = (demY + srcY / sz.y) / nDem;
        const mercYStep = (srcH / sz.y) / sz.y / nDem;
        for (let cy = 0; cy < sz.y; cy++) {
          const mercY = mercYBase + cy * mercYStep;
          lats[cy] = Math.atan(Math.sinh(Math.PI * (1 - 2 * mercY))) * 180 / Math.PI;
        }

        // タイルレベルで河川・市街地の有無を事前判定（ピクセルループの高速化）
        const bufLat = 200 / RLAT, bufLng = 200 / RLNG;
        const tLatMin = lats[lats.length-1], tLatMax = lats[0];
        const tLngMin = lngs[0],             tLngMax = lngs[lngs.length-1];
        const buf500Lat = 500 / RLAT, buf500Lng = 500 / RLNG;
        const tileHasRiver  = RIVERS.some(r => r.some(([rl,rg]) =>
          rl >= tLatMin-buf500Lat && rl <= tLatMax+buf500Lat &&
          rg >= tLngMin-buf500Lng && rg <= tLngMax+buf500Lng));
        const tileHasUrban  = URBAN_DENSE.some(a =>
          tLatMax >= a.latMin && tLatMin <= a.latMax &&
          tLngMax >= a.lngMin && tLngMin <= a.lngMax);

        for (let cy = 0; cy < sz.y; cy++) {
          const lat = lats[cy];
          for (let cx = 0; cx < sz.x; cx++) {
            const lng = lngs[cx];
            // latLngInFloodArea をインライン化（ピクセル単位呼び出しのオーバーヘッド削減）
            if (!((lat>=42.78&&lat<=43.13&&lng>=144.08&&lng<=144.55)||
                  (lat>=42.90&&lat<=43.17&&lng>=144.40&&lng<=144.68)||
                  (lat>=42.60&&lat<=43.03&&lng>=143.85&&lng<=144.28))) {
              px[(cy*sz.x+cx)*4+3] = 0; continue;
            }
            const i = (cy * sz.x + cx) * 4;
            const boost  = (tileHasRiver && nearRiver(lat, lng))    ?  1 : 0;
            const reduce = (tileHasUrban && inUrbanDense(lat, lng)) ?  2 : 0;
            const col = getFloodRGBA(decodeDEMElev(px[i], px[i+1], px[i+2]), targetH + boost - reduce);
            if (col) { px[i]=col[0]; px[i+1]=col[1]; px[i+2]=col[2]; px[i+3]=col[3]; }
            else      { px[i+3] = 0; }
          }
        }
        canvas.getContext('2d').putImageData(id, 0, 0);
      } catch { /* CORS エラー等：透明のまま */ }
      done(null, canvas);
    };
    img.onerror = () => done(null, canvas);
    img.src = `https://cyberjapandata.gsi.go.jp/xyz/dem_png/${demZ}/${demX}/${demY}.png`;
    return canvas;
  }
});

// ===== 橋・渋滞警告マーカー =====
function showWarningMarkers() {
  warningMarkers.forEach(m => m.remove());
  warningMarkers = [];
  if (tsunamiHeightM < 5) return;

  const bridgeIcon = L.divIcon({
    html: '<div style="font-size:20px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))">⚠️</div>',
    iconSize: [22, 22], iconAnchor: [11, 11], className: ''
  });
  const congIcon = L.divIcon({
    html: '<div style="font-size:16px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))">⚠️</div>',
    iconSize: [18, 18], iconAnchor: [9, 9], className: ''
  });

  BRIDGE_DATA.forEach(b => {
    warningMarkers.push(
      L.marker([b.lat, b.lng], { icon: bridgeIcon })
        .bindPopup(
          `<b>🌉 ${b.name}</b><br>` +
          `<span style="color:#f59e0b;font-weight:bold">⚠ 橋が封鎖される可能性があります</span><br>` +
          `<span style="color:#f87171;font-weight:bold">⚠ 接続道路も渋滞・通行止めが予想されます</span><br>` +
          `<small>大津波警報発令時は橋および接続道路が封鎖・渋滞となる可能性があります。別ルートを事前に確認してください。</small>`
        )
        .addTo(map)
    );
  });

  CONGESTION_DATA.forEach(c => {
    warningMarkers.push(
      L.marker([c.lat, c.lng], { icon: congIcon })
        .bindPopup(
          `<b>🚗 ${c.name}</b><br>` +
          `<span style="color:#f87171;font-weight:bold">⚠ 渋滞が予想されます（渋滞予想）</span><br>` +
          `<small>津波避難時に車両が集中し、渋滞が発生する可能性があります。時間に余裕をもって行動してください。</small>`
        )
        .addTo(map)
    );
  });
}

function updateFloodLayer() {
  if (floodLayer) { floodLayer.remove(); floodLayer = null; }
  if (tsunamiHeightM === 0) return;
  floodLayer = new FloodLayer({ pane: 'floodPane', maxZoom: 18 }).addTo(map);
}

// ===== シナリオ選択 =====
function setTsunamiHeight(h) {
  tsunamiHeightM = h;
  document.querySelectorAll('#height-btns .scenario-btn').forEach(b => {
    b.classList.toggle('active', +b.dataset.val === h);
  });
  updateFloodLayer();
  showWarningMarkers();
  if (currentLat !== null) findShelters(currentLat, currentLng);
}

function setArrivalTime(t) {
  tsunamiArrivalMin = t;
  document.querySelectorAll('#time-btns .scenario-btn').forEach(b => {
    b.classList.toggle('active', +b.dataset.val === t);
  });
  if (currentLat !== null) {
    showRadiusCircles(currentLat, currentLng);
    findShelters(currentLat, currentLng);
  }
}

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', () => {
  map = L.map('map').setView([42.984, 144.382], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18
  }).addTo(map);

  // 浸水レイヤー用ペイン（タイル z-200 の直上、他要素より下）
  map.createPane('floodPane');
  map.getPane('floodPane').style.zIndex = 250;
  map.getPane('floodPane').style.pointerEvents = 'none';

  // 圏内サークル用ペイン（overlayPane z-400 より低くしてマーカークリックを妨げない）
  map.createPane('radiusPane');
  map.getPane('radiusPane').style.zIndex = 350;

  shelters = SHELTERS_DATA.features.map(f => ({
    name:                f.properties.name,
    address:             f.properties.address,
    lat:                 f.geometry.coordinates[1],
    lng:                 f.geometry.coordinates[0],
    elevation_m:         f.properties.elevation_m,
    distance_from_sea_m: f.properties.distance_from_sea_m,
    capacity:            f.properties.capacity,
  }));

  document.getElementById('address-input')
    .addEventListener('keydown', e => { if (e.key === 'Enter') searchAddress(); });

  showAllSheltersOnMap();
  addMapLegend();
});

// ===== GPS 取得 =====
function getGPSLocation() {
  if (!navigator.geolocation) {
    alert('このブラウザはGPSに対応していません。住所を入力してください。');
    return;
  }
  showLoading(true);
  navigator.geolocation.getCurrentPosition(
    pos => setUserLocation(pos.coords.latitude, pos.coords.longitude),
    ()  => { showLoading(false); alert('位置情報の取得に失敗しました。\n\nスマートフォンの場合は「設定 → プライバシー → 位置情報サービス」をオンにしてください。\nブラウザの位置情報アクセスを許可してから再度お試しください。'); },
    { timeout: 10000, maximumAge: 0 }
  );
}

// ===== 住所の JS 正規化（GSI/Nominatim 検索前の前処理）=====
function normalizeAddress(input) {
  let s = input.trim();
  s = s.replace(/[０-９]/g,  c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  s = s.replace(/[Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  s = s.replace(/[－―‐ー─]/g, '-');
  s = s.replace(/　/g, ' ');
  s = s.replace(/(\d+)番(?!地|号)/g, '$1番地');
  s = s.replace(/(\d+丁目)(\d+)-(\d+)/g, '$1$2番地$3号');
  s = s.replace(/(?<![丁番号地\d])(\d+)-(\d+)-(\d+)(?!\d)/g, '$1丁目$2番地$3号');
  s = s.replace(/(?<![丁番号地\d])(\d+)-(\d+)(?!\d)/g, '$1丁目$2番地');
  s = s.replace(/(\d+番地)(\d+)(?!\d|号)/g, '$1$2号');
  return s.replace(/\s+/g, ' ').trim();
}

// ===== 市町村ごとの検索設定 =====
const TOWN_PREFIXES = {
  '釧路市': '北海道釧路市',
  '釧路町': '北海道釧路郡釧路町',
  '白糠町': '北海道白糠郡白糠町',
  '音別町': '北海道釧路市音別町',
};
const TOWN_BOUNDS = {
  '釧路市': { latMin: 42.78, latMax: 43.15, lngMin: 143.90, lngMax: 144.55 },
  '釧路町': { latMin: 42.88, latMax: 43.20, lngMin: 144.38, lngMax: 144.75 },
  '白糠町': { latMin: 42.55, latMax: 43.10, lngMin: 143.78, lngMax: 144.30 },
  '音別町': { latMin: 42.85, latMax: 43.08, lngMin: 143.82, lngMax: 144.18 },
};

// ===== 国土地理院 住所検索API（番地・号レベルまで対応）=====
async function tryGSI(query, bounds) {
  try {
    const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(query)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const data = await fetch(url, { signal: ctrl.signal }).then(r => r.json());
    clearTimeout(timer);
    if (!Array.isArray(data) || !data.length) return null;
    const hit = data.find(d => {
      if (!d.properties?.title) return false;
      const [lng, lat] = d.geometry.coordinates;
      return lat >= bounds.latMin && lat <= bounds.latMax &&
             lng >= bounds.lngMin && lng <= bounds.lngMax;
    });
    if (!hit) return null;
    const [lng, lat] = hit.geometry.coordinates;
    return { lat, lon: lng };
  } catch { return null; }
}

// ===== Nominatim 検索（フォールバック用）=====
async function tryNominatim(query, bounds) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=jp`;
    const data = await fetch(url, { headers: { 'Accept-Language': 'ja' } }).then(r => r.json());
    if (!data.length) return null;
    const candidates = data.filter(d => d.class !== 'boundary' && d.type !== 'administrative');
    return candidates.find(d => {
      const la = +d.lat, lo = +d.lon;
      return la >= bounds.latMin && la <= bounds.latMax &&
             lo >= bounds.lngMin && lo <= bounds.lngMax;
    }) || null;
  } catch { return null; }
}

// ===== 住所検索（GSI優先 → Nominatimフォールバック）=====
async function searchAddress() {
  const town = document.getElementById('town-select').value;
  const raw = document.getElementById('address-input').value.trim();
  if (!raw) return;
  showLoading(true);

  try {
    const prefix = TOWN_PREFIXES[town];
    const bounds = TOWN_BOUNDS[town];
    // 入力から選択済み市町村名を除去してから付与（二重付与防止）
    const addr = normalizeAddress(raw)
      .replace(new RegExp('^(北海道)?' + town.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '')
      .trim();
    const q1 = prefix + addr;
    const q2 = prefix + ' ' + addr;

    const hit =
      await tryGSI(q1, bounds)       ||
      await tryGSI(q2, bounds)       ||
      await tryNominatim(q1, bounds) ||
      await tryNominatim(q2, bounds);

    if (!hit) {
      showLoading(false);
      alert(`「${raw}」が見つかりませんでした。\n例: 大楽毛3丁目5番地2号`);
      return;
    }

    setUserLocation(+hit.lat, +hit.lon);
  } catch {
    showLoading(false);
    alert('住所検索に失敗しました。もう一度お試しください。');
  }
}

// ===== 現在地セット =====
async function setUserLocation(lat, lng) {
  currentLat = lat;
  currentLng = lng;
  map.setView([lat, lng], 14);

  if (userMarker) userMarker.remove();
  userMarker = L.marker([lat, lng], {
    icon: L.divIcon({
      html: '<div style="background:#cc0000;width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 6px rgba(0,0,0,.5)"></div>',
      iconSize: [18, 18], className: ''
    })
  }).addTo(map).bindPopup('<b>現在地</b>').openPopup();

  // ゾーンバナー非表示
  document.getElementById('zone-warning').style.display = 'none';

  // まず地図にスクロール
  document.getElementById('map').scrollIntoView({ behavior: 'smooth' });

  showRadiusCircles(lat, lng);

  await findShelters(lat, lng);
  showLoading(false);
}

// ===== ユーティリティ =====

// ハーバーサイン距離（メートル）
function distM(lat1, lng1, lat2, lng2) {
  const R = 6371000, p = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * p / 2) ** 2 +
    Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin((lng2 - lng1) * p / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ===== OSRM ルート取得 =====
async function getRoute(profile, fromLat, fromLng, toLat, toLng) {
  const base = profile === 'foot'
    ? 'https://routing.openstreetmap.de/routed-foot/route/v1/foot'
    : 'https://router.project-osrm.org/route/v1/driving';
  const url = `${base}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const resp  = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!resp.ok) throw new Error();
    const data = await resp.json();
    if (data.code === 'Ok' && data.routes.length) {
      // foot プロファイルはジョギング速度（5.4km/h）に補正
      const sec = profile === 'foot' ? data.routes[0].duration * 0.92 : data.routes[0].duration;
      return {
        duration_min: Math.ceil(sec / 60),
        distance_m:   Math.round(data.routes[0].distance),
        geometry:     data.routes[0].geometry,
        is_estimated: false
      };
    }
  } catch { /* fallthrough */ }

  // OSRM 失敗時：直線距離から概算（ジョギング 90m/分、車 350m/分）
  const d = distM(fromLat, fromLng, toLat, toLng);
  return {
    duration_min: Math.ceil(d / (profile === 'foot' ? 90 : 350)),
    distance_m:   Math.round(d),
    geometry:     null,
    is_estimated: true
  };
}

// ===== 避難場所検索 =====
async function findShelters(lat, lng) {
  // 釧路市 + 釧路町・白糠町の全避難所を候補に
  const candidates = [...shelters];
  if (typeof EXTRA_SHELTERS !== 'undefined') {
    for (const s of EXTRA_SHELTERS) {
      // elevation_m がデータに含まれていればそれを優先、なければ null
      candidates.push({ elevation_m: null, distance_from_sea_m: null, ...s });
    }
  }
  // 距離順にソートして近い順に最大3件取得
  const top3 = candidates
    .map(s => ({ ...s, _d: distM(lat, lng, s.lat, s.lng) }))
    .sort((a, b) => a._d - b._d)
    .slice(0, 3);

  if (!top3.length) return;

  // 各避難所のルートを並行取得
  const results = await Promise.all(
    top3.map(async s => {
      const route = await getRoute('foot', lat, lng, s.lat, s.lng);
      return { ...s, route };
    })
  );

  updateMapMarkers(results);
  renderResults(results, lat, lng);
}

// ===== 地図マーカー更新 =====
function updateMapMarkers(results) {
  (window._shelterMarkers || []).forEach(m => m.remove());
  window._shelterMarkers = results
    .filter((s, i, arr) => arr.findIndex(x => x.name === s.name) === i)
    .map(s => {
      const color = (s.elevation_m !== null && s.elevation_m >= 10) ? '#00aa44' : '#cc7700';
      const elevLabel = s.elevation_m !== null ? `🔺${s.elevation_m}m` : '🔺標高不明';
      const popupElev = s.elevation_m !== null
        ? `標高: ${s.elevation_m}m<br>海岸から: ${(s.distance_from_sea_m/1000).toFixed(1)}km<br>`
        : '';
      return L.marker([s.lat, s.lng], {
        icon: L.divIcon({
          html: `<div style="background:${color};color:#fff;padding:3px 7px;border-radius:5px;font-size:13px;font-weight:bold;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.4)">${elevLabel}</div>`,
          iconSize: null, className: ''
        })
      }).addTo(map)
        .bindPopup(`<b>${s.name}</b><br>${popupElev}${s.capacity > 0 ? `受け入れ人数: ${s.capacity}人<br>` : ''}${s.address}`);
    });
}

// ===== バッジ生成 =====
function elevBadge(elev) {
  if (elev === null) return `<span class="badge">標高 不明</span>`;
  if (tsunamiHeightM === 0) return `<span class="badge elev-safe">標高 ${elev}m</span>`;
  if (elev >= tsunamiHeightM + 5) return `<span class="badge elev-safe">標高 ${elev}m ✓ 安全</span>`;
  if (elev >= tsunamiHeightM)     return `<span class="badge elev-caution">標高 ${elev}m △ 要確認</span>`;
  return `<span class="badge elev-danger">標高 ${elev}m ⚠ 低い</span>`;
}

function timeBadge(min, profile) {
  const label = profile === 'foot' ? '🏃 ジョギング' : '🚗 車';
  const over  = tsunamiArrivalMin > 0 && min > tsunamiArrivalMin;
  const warn  = over ? ' ⚠ 津波到達前に間に合わない可能性' : '';
  const cls   = over ? 'badge time-danger' : 'badge time-ok';
  return `<span class="${cls}">${label} 約${min}分${warn}</span>`;
}

const cardClass = elev => (elev === null || tsunamiHeightM === 0) ? '' :
  elev >= tsunamiHeightM + 5 ? 'safe' : elev >= tsunamiHeightM ? 'caution' : '';

// ===== 結果レンダリング =====
function renderResults(results, userLat, userLng) {
  const cards = results.map((s, i) => {
    const est = s.route.is_estimated ? '<span class="badge est-badge">概算</span>' : '';
    const rank = i === 0 ? '🥇 第1候補' : i === 1 ? '🥈 第2候補' : '🥉 第3候補';
    return `
    <div class="shelter-card ${cardClass(s.elevation_m)}">
      <div class="shelter-rank">${rank}</div>
      <div class="shelter-name" data-name="${s.name}">${s.name}</div>
      <div class="time-row">
        ${timeBadge(s.route.duration_min, 'foot')}
        <span class="badge dist-badge">📏 距離 ${s.route.distance_m}m</span>
        ${est}
      </div>
      <div class="info-row">
        ${elevBadge(s.elevation_m)}
        ${s.distance_from_sea_m !== null ? `<span class="badge">🌊 海岸から ${(s.distance_from_sea_m / 1000).toFixed(1)}km</span>` : ''}
        ${s.capacity > 0 ? `<span class="badge">👥 ${s.capacity}人</span>` : ''}
      </div>
      <div class="shelter-addr">${s.address}</div>
      <button class="route-btn" onclick="showRoute('foot',${userLat},${userLng},${s.lat},${s.lng})">
        ルートを地図に表示
      </button>
    </div>`;
  }).join('');

  const adviceHtml = `
    <div class="search-ai-box">
      <div class="search-ai-title">⚠️ 避難の際のご注意</div>
      <div class="search-ai-line">🏃 最寄りの避難所へ迷わず速やかに移動してください。</div>
      <div class="search-ai-line">🚗 車での避難は渋滞が発生しやすく、到達時間に大きなばらつきが生じる可能性があります。高台・内陸方向を目指してください。</div>
      <div class="search-ai-line">🌉 大津波警報発令時は橋が封鎖される場合があります。橋を渡る経路を避難ルートとしている場合は、別ルートも事前に確認しておきましょう。</div>
      <div class="search-ai-line">📻 実際の避難行動は、行政・防災無線の指示に必ず従ってください。</div>
    </div>`;

  document.getElementById('results').style.display = 'block';
  document.getElementById('walking-list').innerHTML = cards + adviceHtml;
}

// ===== ルート表示 =====
async function showRoute(profile, fromLat, fromLng, toLat, toLng) {
  if (routeLayer) { routeLayer.remove(); routeLayer = null; }
  const { geometry } = await getRoute(profile, fromLat, fromLng, toLat, toLng);
  const color = profile === 'foot' ? '#2277ff' : '#ff7700';

  routeLayer = geometry
    ? L.geoJSON(geometry, { style: { color, weight: 5, opacity: 0.85 } }).addTo(map)
    : L.polyline([[fromLat, fromLng], [toLat, toLng]], { color, weight: 4, dashArray: '10,8', opacity: 0.8 }).addTo(map);

  map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });
  document.getElementById('map').scrollIntoView({ behavior: 'smooth' });
}

// ===== 徒歩・車の圏内サークル（到達時間連動）=====
function showRadiusCircles(lat, lng) {
  radiusCircles.forEach(c => c.remove());
  radiusCircles = [];

  const carRadius  = CAR_RADIUS_M[tsunamiArrivalMin] ?? 0; // 10分=3.5km, 15分=4.2km, 20分=7km
  const walkRadius = tsunamiArrivalMin * 80;               // 80m/分（10分=800m, 15分=1.2km, 20分=1.6km）

  if (carRadius > 0) {
    radiusCircles.push(L.circle([lat, lng], {
      pane: 'radiusPane',
      radius: carRadius,
      color: '#f59e0b',
      fillColor: '#f59e0b',
      fillOpacity: 0.05,
      weight: 2,
      dashArray: '6 4',
    }).addTo(map).bindPopup(
      `<b>🚗 車 ${tsunamiArrivalMin}分圏内</b><br>` +
      `半径 約${(carRadius / 1000).toFixed(1)}km<br>` +
      `点線の範囲内の避難所へは<br>車で${tsunamiArrivalMin}分以内に到達できます。`
    ));
  }

  if (walkRadius > 0) {
    radiusCircles.push(L.circle([lat, lng], {
      pane: 'radiusPane',
      radius: walkRadius,
      color: '#38bdf8',
      fillColor: '#38bdf8',
      fillOpacity: 0.08,
      weight: 2,
    }).addTo(map).bindPopup(
      `<b>🏃 ジョギング ${tsunamiArrivalMin}分圏内</b><br>` +
      `半径 約${(walkRadius / 1000).toFixed(1)}km<br>` +
      `青い線の範囲内の避難所へは<br>ジョギングで${tsunamiArrivalMin}分以内に到達できます。`
    ));
  }
}

// ===== 全避難所マーカー表示 =====
function showAllSheltersOnMap() {
  if (allShelterLayer) allShelterLayer.remove();

  allShelterLayer = L.layerGroup();

  // SHELTERS_DATA から標高・海岸距離を名前で引けるマップを作成
  const elevMap = {};
  for (const f of SHELTERS_DATA.features) {
    elevMap[f.properties.name] = {
      elevation_m:         f.properties.elevation_m,
      distance_from_sea_m: f.properties.distance_from_sea_m,
    };
  }

  const colorMap = {
    kinkyuu: '#38bdf8', // 指定緊急避難場所 → 水色
    hinanjo: '#34d399', // 指定避難所 → 緑
  };

  let shownCount = 0;
  for (const s of ALL_SHELTERS) {
    const primaryType = s.types[0];
    if (!colorMap[primaryType]) continue; // 福祉・臨時・その他は非表示
    shownCount++;

    const color = colorMap[primaryType];
    const typeLabel = {
      kinkyuu: '指定緊急避難場所',
      hinanjo: '指定避難所',
    }[primaryType] || '';

    const disasters = s.disasters.length ? s.disasters.join('・') : '—';
    const elev = elevMap[s.name];
    const elevLine = elev
      ? `標高: ${elev.elevation_m}m　海岸から: ${(elev.distance_from_sea_m / 1000).toFixed(1)}km<br>`
      : '';
    const capacityLine = s.capacity > 0 ? `受け入れ人数: ${s.capacity}人<br>` : '';

    L.circleMarker([s.lat, s.lng], {
      radius: 8,
      color: color,
      fillColor: color,
      fillOpacity: 0.75,
      weight: 1.5,
      opacity: 0.9,
    })
      .bindPopup(
        `<b>${s.name}</b><br>` +
        `<span style="color:#888">${typeLabel}</span><br>` +
        `${s.address}<br>` +
        elevLine +
        capacityLine +
        `対応災害: ${disasters}`
      )
      .addTo(allShelterLayer);
  }

  // EXTRA_SHELTERS（釧路町・白糠町）を追加
  if (typeof EXTRA_SHELTERS !== 'undefined') {
    for (const s of EXTRA_SHELTERS) {
      const primaryType = s.types[0];
      if (!colorMap[primaryType]) continue;
      shownCount++;

      const color = colorMap[primaryType];
      const typeLabel = {
        kinkyuu: '指定緊急避難場所',
        hinanjo: '指定避難所',
      }[primaryType] || '';

      const disasters = s.disasters.length ? s.disasters.join('・') : '—';
      const capacityLine = s.capacity > 0 ? `受け入れ人数: ${s.capacity}人<br>` : '';
      const townLabel = s.town ? `<span style="color:#aaa">${s.town}</span><br>` : '';

      const elevLine = s.elevation_m != null ? `標高: ${s.elevation_m}m<br>` : '';
      L.circleMarker([s.lat, s.lng], {
        radius: 8,
        color: color,
        fillColor: color,
        fillOpacity: 0.75,
        weight: 1.5,
        opacity: 0.9,
      })
        .bindPopup(
          `<b>${s.name}</b><br>` +
          townLabel +
          `<span style="color:#888">${typeLabel}</span><br>` +
          `${s.address}<br>` +
          elevLine +
          capacityLine +
          `対応災害: ${disasters}`
        )
        .addTo(allShelterLayer);
    }
  }

  if (allSheltersVisible) allShelterLayer.addTo(map);
  document.getElementById('shelter-count-label').textContent = `${shownCount}件`;
}

// ===== 地図凡例 =====
function addMapLegend() {
  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = () => {
    const div = L.DomUtil.create('div', 'map-legend');
    div.innerHTML = [
      '<b style="font-size:10px">避難所種別</b>',
      '<br><span class="map-legend-dot" style="background:#38bdf8"></span>指定緊急避難場所',
      '<br><span class="map-legend-dot" style="background:#34d399"></span>指定避難所',
      '<hr style="border-color:rgba(255,255,255,0.15);margin:4px 0">',
      '<b style="font-size:10px">浸水深（想定）</b>',
      '<br><span class="map-legend-dot" style="background:rgba(190,20,170,0.9)"></span>20m〜',
      '<br><span class="map-legend-dot" style="background:rgba(220,30,100,0.9)"></span>10〜20m',
      '<br><span class="map-legend-dot" style="background:rgba(255,80,80,0.9)"></span>5〜10m',
      '<br><span class="map-legend-dot" style="background:rgba(255,140,110,0.9)"></span>3〜5m',
      '<br><span class="map-legend-dot" style="background:rgba(255,190,140,0.9)"></span>0.5〜3m',
      '<br><span class="map-legend-dot" style="background:rgba(255,250,160,0.9)"></span>〜0.5m',
    ].join('');
    return div;
  };
  legend.addTo(map);
}

// ===== 全避難所トグル =====
function toggleAllShelters() {
  allSheltersVisible = !allSheltersVisible;
  const btn = document.getElementById('toggle-all-btn');
  if (allSheltersVisible) {
    allShelterLayer.addTo(map);
    btn.textContent = '🗺 全避難所を表示中';
    btn.classList.remove('btn-off');
  } else {
    allShelterLayer.remove();
    btn.textContent = '🗺 全避難所を非表示';
    btn.classList.add('btn-off');
  }
}

// ===== ローディング =====
const showLoading = show =>
  (document.getElementById('loading').style.display = show ? 'flex' : 'none');
