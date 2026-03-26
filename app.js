// ===== 状態 =====
let map, userMarker, routeLayer = null;
let shelters = [];
let currentLat = null, currentLng = null;
let kinkyuuLayer = null;
let hinanjoLayer = null;
let shelterFilter = 'kinkyuu'; // 初期: 緊急避難場所のみ
let radiusCircles = [];
// ===== 管理者パネル =====
let shelterStatusData = {};  // { [name]: { status, supplies, memo, updatedAt } }
let isAdminLoggedIn   = false;
let adminMap          = null;
let adminMapLayer     = null;
let adminSelectedTown = '釧路市';

const STATUS_LABELS  = { open: '空き', half: '混雑（50%）', full: '満室' };
const STATUS_COLORS  = { open: '#34d399', half: '#fbbf24', full: '#f87171' };
const STATUS_STROKE  = { open: '#059669', half: '#d97706', full: '#dc2626' };
const STATUS_EMOJI   = { open: '⬜',     half: '🟡',       full: '🔴'    };
const STATUS_CHAR    = { open: '空',     half: '混',       full: '満'    }; // マーカー内文字

// DOM-safe な ID を日本語名から生成
function simpleHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
  }
  return 'sh' + h.toString(36);
}

// 管理状況のポップアップ追記 HTML
function shelterStatusPopup(name) {
  const sd = shelterStatusData[name];
  if (!sd) return '';
  const col = sd.status ? STATUS_STROKE[sd.status] : '#94a3b8';
  const emoji = sd.status ? STATUS_EMOJI[sd.status] : '';
  const label = sd.status ? STATUS_LABELS[sd.status] : '';
  let html = `<hr style="border-color:rgba(255,255,255,0.15);margin:4px 0">`;
  if (label) html += `<span style="color:${col};font-weight:700">${emoji} ${label}</span><br>`;
  if (sd.supplies) html += `<span style="font-size:12px">🛒 ${sd.supplies}</span><br>`;
  if (sd.memo)     html += `<span style="font-size:12px">📝 ${sd.memo}</span><br>`;
  if (sd.updatedAt) {
    const d = new Date(sd.updatedAt);
    const ts = isNaN(d) ? '' : d.toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
    if (ts) html += `<span style="font-size:11px;color:#888">更新: ${ts}</span>`;
  }
  return html;
}

let tsunamiHeightM   = 0;  // シナリオ: 津波高さ（m）
let tsunamiArrivalMin = 0; // シナリオ: 到達時間（分）
let tideOffset = 0;        // 潮位補正: -1=干潮, 0=平均, +1=満潮

// 潮位補正済みの実効津波高さ（tsunamiHeightM=0のときは常に0）
function effectiveTsunamiH() {
  return tsunamiHeightM > 0 ? tsunamiHeightM + tideOffset : 0;
}
let floodLayer = null;     // 浸水シミュレーションレイヤー
let kinkyuuNames = new Set(); // 指定緊急避難場所の名前セット

// 車圏内半径テーブル（分 → メートル）
const CAR_RADIUS_M = { 0: 0, 10: 3500, 15: 4200, 20: 7000 };

// 津波10m以上で地図・検索から除外する避難所名（低標高・沿岸立地）
const TSUNAMI_HIDE_NAMES = new Set([
  'マリントポス', '釧路高等技術専門学院', '大楽毛終末処理場',
  '浜町ポンプ場', '宝浜会館', '寿生活館', 'ポリテクセンター',
]);

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

// 河川からの距離に応じたブースト量を返す（補正なし）
// eslint-disable-next-line no-unused-vars
function riverBoost(_lat, _lng) {
  return 0;
}

// ===== 建物密集地区補正 =====
// -2m: 中部南・中部北・愛国地区・美原・芦野地区
const URBAN_DENSE = [
  { latMin: 42.974, latMax: 42.993, lngMin: 144.360, lngMax: 144.415 }, // 中部南
  { latMin: 42.993, latMax: 43.013, lngMin: 144.358, lngMax: 144.418 }, // 中部北
  { latMin: 43.000, latMax: 43.022, lngMin: 144.375, lngMax: 144.415 }, // 愛国西・愛国東地区
  { latMin: 43.012, latMax: 43.036, lngMin: 144.400, lngMax: 144.455 }, // 美原・芦野地区
  { latMin: 43.010, latMax: 43.055, lngMin: 144.318, lngMax: 144.400 }, // 美原地区〜湿原道路エリア
];
// -2m: 柳町公園〜釧路駅の線路沿い地区（堀川町・双葉町・松浦町・新釧路町・中島町・若松町）
const URBAN_LIGHT = [
  { latMin: 42.974, latMax: 42.994, lngMin: 144.320, lngMax: 144.378 },
];

// 市街地補正量を返す（-2m: 2, それ以外: 0）
function urbanReduce(lat, lng) {
  if (URBAN_DENSE.some(a => lat >= a.latMin && lat <= a.latMax && lng >= a.lngMin && lng <= a.lngMax)) return 2;
  if (URBAN_LIGHT.some(a => lat >= a.latMin && lat <= a.latMax && lng >= a.lngMin && lng <= a.lngMax)) return 2;
  return 0;
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
  if (d < 0.5)  return [255, 255, 120,  70]; // 極薄黄（〜0.5m）
  if (d < 3)    return [255, 200,   0, 155]; // 黄（0.5〜3m）
  if (d < 5)    return [255,  90,   0, 175]; // 橙（3〜5m）
  if (d < 10)   return [220,   0,   0, 192]; // 赤（5〜10m）
  if (d < 20)   return [140,   0,  70, 208]; // 深紅（10〜20m）
  return               [ 70,   0, 200, 222]; // 深紫（20m〜）
}

// Leaflet GridLayer を拡張して DEM タイルを処理するカスタムレイヤー
const FloodLayer = L.GridLayer.extend({
  createTile(coords, done) {
    const MAX_NATIVE_ZOOM = 14; // GSI DEM PNG の最大提供ズーム
    const sz = this.getTileSize();
    const canvas = document.createElement('canvas');
    canvas.width  = sz.x;
    canvas.height = sz.y;

    const targetH = effectiveTsunamiH();
    if (targetH <= 0) { done(null, canvas); return canvas; }

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
        const tLatMin = lats[lats.length-1], tLatMax = lats[0];
        const tLngMin = lngs[0],             tLngMax = lngs[lngs.length-1];
        const buf500Lat = 500 / RLAT, buf500Lng = 500 / RLNG;
        const tileHasRiver  = RIVERS.some(r => r.some(([rl,rg]) =>
          rl >= tLatMin-buf500Lat && rl <= tLatMax+buf500Lat &&
          rg >= tLngMin-buf500Lng && rg <= tLngMax+buf500Lng));
        const tileHasUrban  = [...URBAN_DENSE, ...URBAN_LIGHT].some(a =>
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
            const boost  = tileHasRiver ? riverBoost(lat, lng) : 0;
            const reduce = tileHasUrban ? urbanReduce(lat, lng) : 0;
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
  if (effectiveTsunamiH() < 5) return;

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
  updateScenarioChip();
  updateFloodLayer();
  showWarningMarkers();
  showAllSheltersOnMap(); // 津波高さ変更時にマップ上の避難所表示も更新
  if (currentLat !== null) findShelters(currentLat, currentLng);
}

function setArrivalTime(t) {
  tsunamiArrivalMin = t;
  document.querySelectorAll('#time-btns .scenario-btn').forEach(b => {
    b.classList.toggle('active', +b.dataset.val === t);
  });
  updateScenarioChip();
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

  // 指定緊急避難場所の名前セットを構築
  kinkyuuNames = new Set(
    ALL_SHELTERS.filter(s => s.types.includes('kinkyuu')).map(s => s.name)
  );

  document.getElementById('address-input')
    .addEventListener('keydown', e => { if (e.key === 'Enter') searchAddress(); });

  showAllSheltersOnMap();
  addMapLegend();
  loadHospitals();
  initBottomSheet();
  loadShelterStatus();

  // 初回利用時は？ボタンをパルスアニメーション＋吹き出しでアピール
  if (!localStorage.getItem('helpSeen_v3')) {
    const helpBtn = document.getElementById('help-btn');
    const tooltip = document.getElementById('help-tooltip');
    if (helpBtn) helpBtn.classList.add('pulse');
    if (tooltip) {
      tooltip.classList.add('visible');
      // 10秒後に自動的に吹き出しのみ消す（パルスは維持）
      setTimeout(() => { tooltip.classList.remove('visible'); }, 10000);
    }
  }
});

// ===== GPS 取得 =====
function getGPSLocation() {
  document.getElementById('consent-modal').style.display = 'flex';
}

function consentGPS(agreed) {
  document.getElementById('consent-modal').style.display = 'none';
  if (!agreed) return;
  if (!navigator.geolocation) {
    alert('このブラウザはGPSに対応していません。住所を入力してください。');
    return;
  }
  showLoading(true);
  navigator.geolocation.getCurrentPosition(
    pos => setUserLocation(pos.coords.latitude, pos.coords.longitude),
    ()  => { showLoading(false); alert('位置情報の取得に失敗しました。\n\nスマートフォンの場合は「設定 → プライバシー → 位置情報サービス」をオンにしてください。\nブラウザの位置情報アクセスを許可してから再度お試しください。'); },
    { timeout: 15000, maximumAge: 0, enableHighAccuracy: true }
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

// ===== 国土地理院 住所検索API =====
async function tryGSI(query, bounds) {
  try {
    const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(query)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const data = await fetch(url, { signal: ctrl.signal }).then(r => r.json());
    clearTimeout(timer);
    if (!Array.isArray(data) || !data.length) return null;

    // bounds内に絞る
    const inBounds = data.filter(d => {
      if (!d.properties?.title) return false;
      const [lng, lat] = d.geometry.coordinates;
      return lat >= bounds.latMin && lat <= bounds.latMax &&
             lng >= bounds.lngMin && lng <= bounds.lngMax;
    });
    if (!inBounds.length) return null;

    // クエリのキーワードがタイトルに含まれる数 × 100 + タイトル長 でスコアリング
    const tokens = query.replace(/北海道|郡|都|道|府/g, ' ')
      .split(/[市区町村\s]+/).filter(t => t.length >= 2);
    const scored = inBounds.map(d => {
      const title = d.properties.title;
      const matchCount = tokens.filter(t => title.includes(t)).length;
      return { d, score: matchCount * 100 + title.length };
    }).sort((a, b) => b.score - a.score);

    const best = scored[0].d;
    const [lng, lat] = best.geometry.coordinates;
    return { lat, lon: lng, label: best.properties.title };
  } catch { return null; }
}

// ===== Nominatim 検索（フォールバック用）=====
async function tryNominatim(query, bounds) {
  try {
    const viewbox = `${bounds.lngMin},${bounds.latMax},${bounds.lngMax},${bounds.latMin}`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=jp&viewbox=${viewbox}&bounded=1`;
    const data = await fetch(url, { headers: { 'Accept-Language': 'ja' } }).then(r => r.json());
    if (!data.length) return null;
    const candidates = data.filter(d => d.class !== 'boundary' && d.type !== 'administrative');
    // 建物・住居タイプを最優先、次にimportance降順
    const PRIORITY = { building: 3, house: 3, residential: 2, place: 1 };
    candidates.sort((a, b) => {
      const pa = PRIORITY[a.type] || 0, pb = PRIORITY[b.type] || 0;
      if (pa !== pb) return pb - pa;
      return (+b.importance || 0) - (+a.importance || 0);
    });
    const hit = candidates.find(d => {
      const la = +d.lat, lo = +d.lon;
      return la >= bounds.latMin && la <= bounds.latMax &&
             lo >= bounds.lngMin && lo <= bounds.lngMax;
    });
    if (!hit) return null;
    return { ...hit, label: hit.display_name?.split(',')[0] || null };
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
    const addr = normalizeAddress(raw)
      .replace(new RegExp('^(北海道)?' + town.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '')
      .trim();

    // 号なし・番地号なし・番地→番（OSM形式）のバリアントを生成
    const addrNoGo     = addr.replace(/(\d+)号\s*$/, '').trim();
    const addrNoBanchi = addrNoGo.replace(/\d+番地?\s*$/, '').trim();
    // "5番地6号" → "5番6号"（Nominatim/OSMが好む形式）
    const addrBanNo    = addr.replace(/番地(\d)/g, '番$1');
    const addrBanNoNoGo = addrNoGo.replace(/番地(\d)/g, '番$1');

    const gsiQueries = [...new Set([
      prefix + addr,
      prefix + addrNoGo,
      prefix + addrNoBanchi,
    ])];
    const nomQueries = [...new Set([
      prefix + addrBanNo,       // 番号形式（OSMに最も多い）
      prefix + addr,
      prefix + addrBanNoNoGo,
      prefix + addrNoGo,
      prefix + addrNoBanchi,
    ])];

    let hit = null;
    for (const q of gsiQueries) {
      hit = await tryGSI(q, bounds);
      if (hit) break;
    }
    if (!hit) {
      for (const q of nomQueries) {
        hit = await tryNominatim(q, bounds);
        if (hit) break;
      }
    }

    if (!hit) {
      showLoading(false);
      alert(`住所が見つかりませんでした。\n例: 大楽毛〇丁目〇番地〇号`);
      return;
    }

    setUserLocation(+hit.lat, +hit.lon, hit.label);
  } catch {
    showLoading(false);
    alert('住所検索に失敗しました。もう一度お試しください。');
  }
}

// ===== 現在地セット =====
async function setUserLocation(lat, lng, label) {
  currentLat = lat;
  currentLng = lng;
  // 住所検索時はより詳細なズームで表示（確認しやすく）
  map.setView([lat, lng], label ? 16 : 14);

  if (userMarker) userMarker.remove();
  const popupHtml = label
    ? `<b>検索位置</b><br><span style="font-size:11px;color:#aaa">${label}</span>`
    : '<b>現在地</b>';
  userMarker = L.marker([lat, lng], {
    icon: L.divIcon({
      html: '<div style="background:#cc0000;width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 6px rgba(0,0,0,.5)"></div>',
      iconSize: [18, 18], className: ''
    })
  }).addTo(map).bindPopup(popupHtml).openPopup();

  // ゾーンバナー非表示
  document.getElementById('zone-warning').style.display = 'none';

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
  // 指定緊急避難場所のみを候補に（指定避難所は除外）
  // 津波10m以上は危険な低標高避難所を除外
  const hide = effectiveTsunamiH() >= 10;
  const candidates = [...shelters].filter(s =>
    kinkyuuNames.has(s.name) && (!hide || !TSUNAMI_HIDE_NAMES.has(s.name))
  );
  if (typeof EXTRA_SHELTERS !== 'undefined') {
    for (const s of EXTRA_SHELTERS) {
      if (!s.types.includes('kinkyuu')) continue; // 指定緊急避難場所のみ
      if (hide && TSUNAMI_HIDE_NAMES.has(s.name)) continue;
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

  // 第1候補のルートを自動表示（再フェッチなし）
  if (routeLayer) { routeLayer.remove(); routeLayer = null; }
  const first = results[0];
  routeLayer = first.route.geometry
    ? L.geoJSON(first.route.geometry, { style: { color: '#2277ff', weight: 5, opacity: 0.85 } }).addTo(map)
    : L.polyline([[lat, lng], [first.lat, first.lng]], { color: '#2277ff', weight: 4, dashArray: '10,8', opacity: 0.8 }).addTo(map);
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
        ? `標高: ${s.elevation_m}m${s.distance_from_sea_m !== null ? `　海岸から: ${(s.distance_from_sea_m/1000).toFixed(1)}km` : ''}<br>`
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
  const effH = effectiveTsunamiH();
  if (effH === 0) return `<span class="badge elev-safe">標高 ${elev}m</span>`;
  if (elev >= effH + 5) return `<span class="badge elev-safe">標高 ${elev}m ✓ 安全</span>`;
  if (elev >= effH)               return `<span class="badge elev-caution">標高 ${elev}m △ 要確認</span>`;
  return `<span class="badge elev-danger">標高 ${elev}m ⚠ 低い</span>`;
}

function timeBadge(min, profile) {
  const label = profile === 'foot' ? '🏃 ジョギング' : '🚗 車';
  const over  = tsunamiArrivalMin > 0 && min > tsunamiArrivalMin;
  const warn  = over ? ' ⚠ 津波到達前に間に合わない可能性' : '';
  const cls   = over ? 'badge time-danger' : 'badge time-ok';
  return `<span class="${cls}">${label} 約${min}分${warn}</span>`;
}

function walkBadge(distM) {
  const min = Math.ceil(distM / 3000 * 60); // 徒歩3km/h
  const over = tsunamiArrivalMin > 0 && min > tsunamiArrivalMin;
  const warn = over ? ' ⚠ 津波到達前に間に合わない可能性' : '';
  const cls  = over ? 'badge time-danger' : 'badge walk-ok';
  return `<span class="${cls}">🚶 徒歩 約${min}分${warn}</span>`;
}

const cardClass = elev => {
  const effH = effectiveTsunamiH();
  if (elev === null || effH === 0) return '';
  return elev >= effH + 5 ? 'safe' : elev >= effH ? 'caution' : '';
};

function capacityBadge(cap) {
  if (!cap || cap <= 0) return '';
  if (cap >= 500) return `<span class="badge cap-lg">👥 ${cap}人収容（大）</span>`;
  if (cap >= 200) return `<span class="badge cap-md">👥 ${cap}人収容（中）</span>`;
  return `<span class="badge cap-sm">👥 ${cap}人収容（小）</span>`;
}

// ===== 避難所公式サイトURL =====
// 個別施設URL（施設名 → URL）
const SHELTER_URLS = {
  '釧路市民活動センター': 'https://www.city.kushiro.lg.jp/shisei/bunka_sports/1000337.html',
  '釧路市生涯学習センター': 'https://www.city.kushiro.lg.jp/shisei/bunka_sports/manabe/',
  '釧路市中央図書館': 'https://www.lib.city.kushiro.lg.jp/',
  '釧路市立博物館': 'https://www.city.kushiro.lg.jp/museum/',
  '釧路市観光国際交流センター': 'https://www.city.kushiro.lg.jp/shisei/bunka_sports/1000341.html',
};
// 自治体別公式避難所一覧URL（フォールバック）
const CITY_SHELTER_LIST_URL = {
  '釧路市': 'https://www.city.kushiro.lg.jp/kurashi/bousai/1003680/1003686.html',
  '釧路町': 'http://www.town.kushiro.lg.jp/disaster/hinanbasho/place.html',
  '白糠町': 'https://www.town.shiranuka.lg.jp/section/nfml630000001mwx.html',
};

function shelterOfficialLink(s) {
  // 個別URLが既知なら優先
  const directUrl = SHELTER_URLS[s.name];
  if (directUrl) {
    return `<a class="shelter-official-btn" href="${directUrl}" target="_blank" rel="noopener">🔗 施設の公式ページ</a>`;
  }
  // 自治体レベルのフォールバック
  const addr = s.address || '';
  const town = s.town || (addr.startsWith('釧路市') ? '釧路市' : addr.includes('釧路町') ? '釧路町' : addr.includes('白糠町') ? '白糠町' : '');
  const cityUrl = CITY_SHELTER_LIST_URL[town];
  if (cityUrl) {
    return `<a class="shelter-official-btn" href="${cityUrl}" target="_blank" rel="noopener">🔗 ${town}公式・避難所一覧</a>`;
  }
  return '';
}

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
        ${walkBadge(s.route.distance_m)}
        ${timeBadge(s.route.duration_min, 'foot')}
        <span class="badge dist-badge">📏 距離 ${s.route.distance_m}m</span>
        ${est}
      </div>
      <div class="info-row">
        ${elevBadge(s.elevation_m)}
        ${s.distance_from_sea_m !== null ? `<span class="badge">🌊 海岸から ${(s.distance_from_sea_m / 1000).toFixed(1)}km</span>` : ''}
        ${capacityBadge(s.capacity)}
      </div>
      <div class="shelter-addr">${s.address}</div>
      <div class="shelter-link-row">
        ${shelterOfficialLink(s)}
      </div>
      <button class="route-btn" onclick="showRoute('foot',${userLat},${userLng},${s.lat},${s.lng})">
        ルートを地図に表示
      </button>
    </div>`;
  }).join('');

  const adviceHtml = `
    <div class="search-ai-box">
      <div class="search-ai-title">⚠️ 避難の際のご注意</div>
      <div class="search-ai-line">🏃 最寄りの避難所を3箇所出しています。どこに逃げれば良いか、自宅に留まるかはご自身で判断してください。</div>
      <div class="search-ai-line">📻 実際の避難行動は、行政・防災無線の指示に必ず従ってください。</div>
      <div class="search-ai-line">🏠 指定避難所は参考程度に出しています。緊急の場合は、指定緊急避難場所に逃げてください。</div>
      <div class="search-ai-line">🚗 車での避難は渋滞が発生しやすく、到達時間に大きなばらつきが生じる可能性があります。高台・内陸方向を目指してください。</div>
      <div class="search-ai-line">🌉 大津波警報発令時は橋が封鎖される場合があります。橋を渡る経路を避難ルートとしている場合は、別ルートも事前に確認しておいてください。</div>
    </div>`;

  document.getElementById('results').style.display = 'block';
  document.getElementById('walking-list').innerHTML = cards + adviceHtml;
  setBottomSheetHeight(Math.round(window.innerHeight * 0.5));
}

// ===== 検索リセット =====
function resetSearch() {
  document.getElementById('results').style.display = 'none';
  document.getElementById('walking-list').innerHTML = '';
  document.getElementById('address-input').value = '';
  if (routeLayer) { routeLayer.remove(); routeLayer = null; }
  if (userMarker) { userMarker.remove(); userMarker = null; }
  radiusCircles.forEach(c => c.remove());
  radiusCircles = [];
  currentLat = null; currentLng = null;
  setBottomSheetHeight(180);
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
}

// ===== 徒歩・車の圏内サークル（到達時間連動）=====
function showRadiusCircles(lat, lng) {
  radiusCircles.forEach(c => c.remove());
  radiusCircles = [];

  const carRadius     = CAR_RADIUS_M[tsunamiArrivalMin] ?? 0; // 10分=3.5km, 15分=4.2km, 20分=7km
  const walkRadius    = tsunamiArrivalMin * 80;              // ジョギング 80m/分（5km/h）
  const walkSlowRadius = tsunamiArrivalMin * 50;             // 徒歩 50m/分（3km/h）

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
      `<b>🚗 車の到達圏</b><br>半径 約${(carRadius / 1000).toFixed(1)}km`
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
      `<b>🏃 ジョギングの到達圏</b><br>半径 約${(walkRadius / 1000).toFixed(1)}km`
    ));
  }

  if (walkSlowRadius > 0) {
    radiusCircles.push(L.circle([lat, lng], {
      pane: 'radiusPane',
      radius: walkSlowRadius,
      color: '#a78bfa',
      fillColor: '#a78bfa',
      fillOpacity: 0.06,
      weight: 2,
      dashArray: '4 4',
    }).addTo(map).bindPopup(
      `<b>🚶 徒歩の到達圏</b><br>半径 約${(walkSlowRadius / 1000).toFixed(1)}km`
    ));
  }
}

// 避難所マーカーアイコン生成（丸＋漢字1文字）
function makeShelterIcon(bgColor, char) {
  const textColor = char === '空' ? '#ffffff' : char === '混' ? '#fbbf24' : char === '満' ? '#f87171' : 'transparent';
  return L.divIcon({
    className: '',
    html: `<div class="shelter-dot-marker" style="background:${bgColor};color:${textColor}">${char}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

// ===== 全避難所マーカー表示 =====
function showAllSheltersOnMap() {
  if (kinkyuuLayer) kinkyuuLayer.remove();
  if (hinanjoLayer) hinanjoLayer.remove();

  kinkyuuLayer = L.layerGroup();
  hinanjoLayer = L.layerGroup();

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

  const hideInMap = effectiveTsunamiH() >= 10;
  for (const s of ALL_SHELTERS) {
    const primaryType = s.types[0];
    if (!colorMap[primaryType]) continue; // 福祉・臨時・その他は非表示
    if (hideInMap && TSUNAMI_HIDE_NAMES.has(s.name)) continue; // 津波10m+で除外

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

    const targetLayer = primaryType === 'kinkyuu' ? kinkyuuLayer : hinanjoLayer;
    const sd0  = shelterStatusData[s.name];
    const char0 = sd0?.status ? STATUS_CHAR[sd0.status] : '';
    L.marker([s.lat, s.lng], { icon: makeShelterIcon(colorMap[primaryType], char0) })
      .bindPopup(
        `<b>${s.name}</b><br>` +
        `<span style="color:#888">${typeLabel}</span><br>` +
        `${s.address}<br>` +
        elevLine +
        capacityLine +
        `対応災害: ${disasters}` +
        shelterStatusPopup(s.name)
      )
      .addTo(targetLayer);
  }

  // EXTRA_SHELTERS（釧路町・白糠町）を追加
  if (typeof EXTRA_SHELTERS !== 'undefined') {
    for (const s of EXTRA_SHELTERS) {
      const primaryType = s.types[0];
      if (!colorMap[primaryType]) continue;

      const typeLabel = {
        kinkyuu: '指定緊急避難場所',
        hinanjo: '指定避難所',
      }[primaryType] || '';

      const disasters = s.disasters.length ? s.disasters.join('・') : '—';
      const capacityLine = s.capacity > 0 ? `受け入れ人数: ${s.capacity}人<br>` : '';
      const townLabel = s.town ? `<span style="color:#aaa">${s.town}</span><br>` : '';

      const elevLine = s.elevation_m != null ? `標高: ${s.elevation_m}m<br>` : '';
      const targetLayer = primaryType === 'kinkyuu' ? kinkyuuLayer : hinanjoLayer;
      const sd1  = shelterStatusData[s.name];
      const char1 = sd1?.status ? STATUS_CHAR[sd1.status] : '';
      L.marker([s.lat, s.lng], { icon: makeShelterIcon(colorMap[primaryType], char1) })
        .bindPopup(
          `<b>${s.name}</b><br>` +
          townLabel +
          `<span style="color:#888">${typeLabel}</span><br>` +
          `${s.address}<br>` +
          elevLine +
          capacityLine +
          `対応災害: ${disasters}` +
          shelterStatusPopup(s.name)
        )
        .addTo(targetLayer);
    }
  }

  // 現在のフィルターに応じてレイヤーを表示
  if (shelterFilter === 'kinkyuu' || shelterFilter === 'all') kinkyuuLayer.addTo(map);
  if (shelterFilter === 'hinanjo' || shelterFilter === 'all') hinanjoLayer.addTo(map);
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
      '<b style="font-size:10px">空き状況</b>',
      '<br><span class="map-legend-char" style="color:#fff">空</span>空き',
      '<br><span class="map-legend-char" style="color:#fbbf24">混</span>混雑(50%)',
      '<br><span class="map-legend-char" style="color:#f87171">満</span>満室',
      '<hr style="border-color:rgba(255,255,255,0.15);margin:4px 0">',
      '<b style="font-size:10px">浸水深（想定）</b>',
      '<br><span class="map-legend-dot" style="background:rgba(70,0,200,0.92)"></span>20m〜',
      '<br><span class="map-legend-dot" style="background:rgba(140,0,70,0.88)"></span>10〜20m',
      '<br><span class="map-legend-dot" style="background:rgba(220,0,0,0.85)"></span>5〜10m',
      '<br><span class="map-legend-dot" style="background:rgba(255,90,0,0.82)"></span>3〜5m',
      '<br><span class="map-legend-dot" style="background:rgba(255,200,0,0.78)"></span>0.5〜3m',
      '<br><span class="map-legend-dot" style="background:rgba(255,255,120,0.65)"></span>〜0.5m',
    ].join('');
    return div;
  };
  legend.addTo(map);
}

// ===== 避難所フィルター =====
function setShelterFilter(type) {
  shelterFilter = type;
  if (kinkyuuLayer) {
    if (type === 'kinkyuu' || type === 'all') kinkyuuLayer.addTo(map);
    else kinkyuuLayer.remove();
  }
  if (hinanjoLayer) {
    if (type === 'hinanjo' || type === 'all') hinanjoLayer.addTo(map);
    else hinanjoLayer.remove();
  }
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === type);
  });
}

// ===== ローディング =====
const showLoading = show =>
  (document.getElementById('loading').style.display = show ? 'flex' : 'none');

// ===== GSI標高取得ヘルパー =====
async function getGsiElevation(lat, lng) {
  try {
    const resp = await fetch(
      `https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${lng}&lat=${lat}&outtype=JSON`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await resp.json();
    const e = parseFloat(data.elevation);
    return isNaN(e) ? null : Math.round(e);
  } catch { return null; }
}

// ===== 病院公式サイトURL =====
const HOSP_URLS = {
  '市立釧路総合病院':         'https://www.kushiro-cghp.jp/',
  '釧路労災病院':             'https://kushiroh.johas.go.jp/',
  '釧路ろうさい病院':         'https://kushiroh.johas.go.jp/',
  '釧路赤十字病院':           'https://kushiro.jrc.or.jp/',
  '孝仁会記念病院':           'https://www.kojinkai.or.jp/hospital/hp-kojinkaikinen.html',
  '孝仁会リハビリテーション病院': 'https://www.kojinkai.or.jp/hospital/hp-hoshigaura.html',
  '釧路脳神経外科':           'https://www.kojinkai.or.jp/hospital/hp-kushironoushinkeigeka.html',
  '優心病院':                 'https://kushiro-yushin-hospital.jp/',
  '東北海道病院':             'https://www.easthokkaidohospital.com/',
  'みなみ病院':               'https://mhosp.or.jp/',
  '中央病院':                 'https://www.kch.or.jp/',
  '釧路中央病院':             'https://www.kch.or.jp/',
  '三慈会病院':               'https://www.sanjikai.net/',
  '釧路協立病院':             'https://www.dotokin-medwel.jp/',
  '白樺台病院':               'https://www.shirakabadai.jp/',
};

// ===== 施設データ補正テーブル =====
// 病院: 名前 → 総階数（指定なければOSMのbuilding:levelsか4F）
const HOSP_FLOORS = {
  'みなみ病院': 3, '市立釧路総合病院': 8, '中央病院': 6,
  '労災病院': 8, 'ろうさい病院': 8, '釧路労災病院': 8, 'JCHO': 8,
  '赤十字病院': 8, '孝仁会記念病院': 6,
  '孝仁会リハビリテーション病院': 3, '優心病院': 5, '東北海道病院': 5,
  '白樺台病院': 3,
};
// 病院: 旧名 → 新名
const HOSP_RENAME = { '星が浦病院': '孝仁会リハビリテーション病院' };

// テーブルを部分一致で引く（OSMの正式名に前後の文字が付いていても対応）
function lookupPartial(table, name) {
  if (name in table) return table[name];
  const key = Object.keys(table).find(k => name.includes(k) || k.includes(name));
  return key ? table[key] : undefined;
}

// ===== 施設マーカー配置ヘルパー =====
function makeFacilityIcon(emoji) {
  return L.divIcon({
    html: `<div style="width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:17px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,.9))">${emoji}</div>`,
    iconSize: [20, 20], iconAnchor: [10, 10], className: ''
  });
}

// Overpass 取得（主→副エンドポイントにフォールバック）
function elevLine(groundElev, floors) {
  if (groundElev === null) return '';
  const top = groundElev + Math.max(0, floors - 1) * 4;
  return `地面標高: ${groundElev}m　最上階(${floors}F)標高: 約${top}m<br>`;
}

// ===== 病院マーカー（ハードコード）=====
async function loadHospitals() {
  const HOSPITALS = [
    { name: '市立釧路総合病院',           lat: 42.9767052, lng: 144.4032830, floors: 8 },
    { name: '釧路赤十字病院',             lat: 43.0016449, lng: 144.3810529, floors: 8 },
    { name: '釧路ろうさい病院',           lat: 43.0063196, lng: 144.3850986, floors: 8 },
    { name: '孝仁会記念病院',             lat: 43.0282237, lng: 144.3980151, floors: 6 },
    { name: '孝仁会リハビリテーション病院', lat: 43.0160192, lng: 144.3162653, floors: 3 },
    { name: '釧路脳神経外科',             lat: 43.0120290, lng: 144.4012280, floors: 3 },
    { name: '優心病院',                   lat: 43.0094624, lng: 144.2736009, floors: 5 },
    { name: '東北海道病院',               lat: 42.9986470, lng: 144.3750300, floors: 5 },
    { name: 'みなみ病院',                 lat: 42.9788577, lng: 144.4187925, floors: 3 },
    { name: '釧路中央病院',               lat: 42.9854281, lng: 144.3779511, floors: 6 },
    { name: '三慈会病院',                 lat: 42.9785071, lng: 144.3868384, floors: 4 },
    { name: '釧路協立病院',               lat: 43.0085349, lng: 144.3714792, floors: 4 },
    { name: '白樺台病院',                 lat: 42.9601041, lng: 144.4456418, floors: 3 },
  ];

  const icon = makeFacilityIcon('🏥');

  // マーカーをまず即座に配置（標高なし）
  const markers = HOSPITALS.map(({ lat, lng, name, floors }) => {
    const hospUrl = lookupPartial(HOSP_URLS, name);
    const hospLinkHtml = hospUrl
      ? `<a href="${hospUrl}" target="_blank" rel="noopener" style="color:#38bdf8;font-size:12px">🔗 公式サイト</a><br>`
      : '';
    const marker = L.marker([lat, lng], { icon })
      .bindPopup(
        `<b>🏥 ${name}</b><br>` +
        `<span style="color:#f87171;font-weight:600">医療機関（病院）</span><br>` +
        hospLinkHtml
      )
      .addTo(map);
    return { marker, name, floors, hospLinkHtml };
  });

  // 標高を非同期取得してポップアップを更新
  const elevs = await Promise.all(HOSPITALS.map(h => getGsiElevation(h.lat, h.lng)));
  markers.forEach(({ marker, name, floors }, i) => {
    const hospUrl = lookupPartial(HOSP_URLS, name);
    const link = hospUrl
      ? `<a href="${hospUrl}" target="_blank" rel="noopener" style="color:#38bdf8;font-size:12px">🔗 公式サイト</a><br>`
      : '';
    marker.setPopupContent(
      `<b>🏥 ${name}</b><br>` +
      `<span style="color:#f87171;font-weight:600">医療機関（病院）</span><br>` +
      elevLine(elevs[i], floors) +
      link
    );
  });
}

// ===== ナビゲーションドロワー =====
function openDrawer() {
  document.getElementById('nav-drawer').classList.add('open');
  document.getElementById('drawer-overlay').classList.add('open');
}

function closeDrawer() {
  document.getElementById('nav-drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('open');
}

// ===== ページナビゲーション =====
const PAGE_TITLES = {
  howto:    '📖 使い方',
  history:  '📋 更新履歴',
  shelters: '📂 避難所データ',
  privacy:  '🔒 プライバシーポリシー',
  creator:  '👤 製作者情報',
  admin:    '🔐 管理者パネル',
};

function navigateTo(page) {
  closeDrawer();

  // ドロワーのアクティブ状態を更新
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  const infoPage = document.getElementById('info-page');

  if (page === 'map') {
    infoPage.classList.remove('open');
    return;
  }

  // 全セクション非表示 → 対象セクションだけ表示
  document.querySelectorAll('.info-section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  // タイトルセット
  const titleEl = document.getElementById('info-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[page] || '';

  // 管理者ページ: ログイン済みならパネルを表示
  if (page === 'admin' && isAdminLoggedIn) {
    document.getElementById('admin-login-area').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    renderAdminList();
  }

  // ページを開く（スクロールを先頭に戻す）
  const infoBody = document.getElementById('info-body');
  if (infoBody) infoBody.scrollTop = 0;
  infoPage.classList.add('open');
}

// ===== 設定モーダル =====
function openSettings() {
  document.getElementById('settings-modal').classList.add('open');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.remove('open');
}

// ===== シナリオチップ更新 =====
function updateScenarioChip() {
  const effH = effectiveTsunamiH();
  const hLabel = tsunamiHeightM === 0 ? '0m' : `${effH}m`;
  const tLabel = tsunamiArrivalMin === 0 ? '0分' : `${tsunamiArrivalMin}分`;
  const chip = document.getElementById('scenario-chip');
  if (chip) chip.textContent = `🌊${hLabel} ⏱${tLabel}`;
}

// ===== 潮位設定 =====
function setTide(offset) {
  tideOffset = offset;
  document.querySelectorAll('#tide-btns .scenario-btn').forEach(b => {
    b.classList.toggle('active', +b.dataset.val === offset);
  });
  updateScenarioChip();
  updateFloodLayer();
  showWarningMarkers();
  showAllSheltersOnMap();
  if (currentLat !== null) findShelters(currentLat, currentLng);
}

// ===== 使い方ボタン =====
function openHelp() {
  markHelpSeen();
  navigateTo('howto');
}
function markHelpSeen() {
  localStorage.setItem('helpSeen_v3', '1');
  const btn = document.getElementById('help-btn');
  if (btn) btn.classList.remove('pulse');
  const tooltip = document.getElementById('help-tooltip');
  if (tooltip) tooltip.classList.remove('visible');
}

// ===== ボトムシート高さ設定 =====
function setBottomSheetHeight(h) {
  const sheet = document.getElementById('bottom-sheet');
  if (!sheet) return;
  sheet.style.height = h + 'px';
  document.documentElement.style.setProperty('--bs-h', h + 'px');
  // Leaflet に地図コンテナのリサイズを通知
  if (map) setTimeout(() => map.invalidateSize(), 320);
}

// ===== 管理者機能 =====

// パスワードチェック
function checkAdminPassword(input) {
  return input === atob('a3VzaGlyby10c3VuYW1p');
}

function submitAdminLogin() {
  const input = document.getElementById('admin-password-input').value;
  const errEl = document.getElementById('admin-login-error');
  if (checkAdminPassword(input)) {
    isAdminLoggedIn = true;
    document.getElementById('admin-login-area').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    errEl.textContent = '';
    renderAdminList();
  } else {
    errEl.textContent = 'パスワードが正しくありません';
  }
}

// ===== 管理者マップ =====
const ADMIN_AREA_CENTERS = {
  '釧路市': { lat: 42.984, lng: 144.382, zoom: 13 },
  '釧路町': { lat: 43.010, lng: 144.455, zoom: 12 },
  '白糠町': { lat: 42.930, lng: 144.080, zoom: 12 },
  '音別町': { lat: 43.010, lng: 144.020, zoom: 13 },
};

function switchAdminView(view) {
  document.getElementById('admin-list-view').style.display = view === 'list' ? '' : 'none';
  document.getElementById('admin-map-view').style.display  = view === 'map'  ? '' : 'none';
  document.querySelectorAll('.admin-tab').forEach(t => {
    t.classList.toggle('active', t.textContent.includes(view === 'list' ? 'リスト' : 'マップ'));
  });
  if (view === 'map') {
    setTimeout(() => {
      if (!adminMap) {
        adminMap = L.map('admin-map').setView([42.984, 144.382], 13);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 19
        }).addTo(adminMap);
      }
      adminMap.invalidateSize();
      setAdminMapArea(adminSelectedTown);
    }, 100);
  }
}

function setAdminMapArea(town) {
  adminSelectedTown = town;
  document.querySelectorAll('.admin-area-btn').forEach(b =>
    b.classList.toggle('active', b.textContent === town));
  document.getElementById('admin-map-form').innerHTML = '';
  const c = ADMIN_AREA_CENTERS[town] || ADMIN_AREA_CENTERS['釧路市'];
  adminMap.setView([c.lat, c.lng], c.zoom);
  renderAdminMapMarkers(town);
}

function renderAdminMapMarkers(town) {
  if (!adminMap) return;
  if (adminMapLayer) adminMapLayer.remove();
  adminMapLayer = L.layerGroup().addTo(adminMap);
  const list = getAllSheltersForAdmin().filter(s => getShelterTown(s) === town);
  list.forEach(s => {
    const sd   = shelterStatusData[s.name];
    const char = sd?.status ? STATUS_CHAR[sd.status] : '';
    const textColor = char === '空' ? '#fff' : char === '混' ? '#fbbf24' : char === '満' ? '#f87171' : 'transparent';
    const bgColor = s.types[0] === 'kinkyuu' ? '#38bdf8' : '#34d399';
    const icon = L.divIcon({
      className: '',
      html: `<div class="shelter-dot-marker" style="background:${bgColor};color:${textColor}">${char}</div>`,
      iconSize: [24, 24], iconAnchor: [12, 12],
    });
    L.marker([s.lat, s.lng], { icon })
      .bindTooltip(s.name, { permanent: false, direction: 'top', offset: [0, -14] })
      .on('click', () => openAdminMapForm(s.name))
      .addTo(adminMapLayer);
  });
}

function openAdminMapForm(name) {
  const s = getAllSheltersForAdmin().find(x => x.name === name);
  if (!s) return;
  const sd = shelterStatusData[name] || {};
  const st = sd.status || '';
  const id = simpleHash(name);
  const statBtns = ['open','half','full'].map(v =>
    `<button class="admin-status-btn admin-status-btn-${v}${st===v?' active':''}" data-status="${v}"
      onclick="selectAdminStatus(event,'${s.name.replace(/'/g,"\\'")}')">${STATUS_EMOJI[v]} ${STATUS_LABELS[v]}</button>`
  ).join('');
  const typeLabel = s.types[0] === 'kinkyuu' ? '緊急避難場所' : '避難所';
  document.getElementById('admin-map-form').innerHTML = `
    <div class="admin-map-form-header">
      <div>
        <span class="admin-type-tag admin-type-${s.types[0]}">${typeLabel}</span>
        <span class="admin-item-name">${name}</span>
      </div>
      <button class="admin-map-form-close" onclick="document.getElementById('admin-map-form').innerHTML=''">✕</button>
    </div>
    <div class="admin-form-field">
      <label class="admin-label">空き状況</label>
      <div class="admin-status-btns" id="admin-sbtn-${id}">${statBtns}</div>
    </div>
    <div class="admin-form-field">
      <label class="admin-label">必要物資</label>
      <textarea class="admin-textarea" id="admin-sup-${id}" placeholder="例: 飲料水・食料・毛布">${sd.supplies||''}</textarea>
    </div>
    <div class="admin-form-field">
      <label class="admin-label">メモ</label>
      <textarea class="admin-textarea" id="admin-memo-${id}" placeholder="特記事項・連絡先など">${sd.memo||''}</textarea>
    </div>
    <button class="admin-save-btn" onclick="saveAdminItem('${s.name.replace(/'/g,"\\'")}')">💾 保存</button>
    <span class="admin-save-msg" id="admin-msg-${id}"></span>
  `;
}

function logoutAdmin() {
  isAdminLoggedIn = false;
  document.getElementById('admin-login-area').style.display = '';
  document.getElementById('admin-panel').style.display = 'none';
  document.getElementById('admin-password-input').value = '';
  document.getElementById('admin-login-error').textContent = '';
}

// 避難所の市町村を返す
function getShelterTown(s) {
  if (s.town) return s.town;
  const addr = s.address || '';
  if (addr.includes('音別')) return '音別町';
  if (addr.includes('釧路町')) return '釧路町';
  if (addr.includes('白糠町')) return '白糠町';
  return '釧路市';
}

// 全避難所リスト取得（管理用）
function getAllSheltersForAdmin() {
  const list = ALL_SHELTERS.filter(s => s.types[0] === 'kinkyuu' || s.types[0] === 'hinanjo');
  if (typeof EXTRA_SHELTERS !== 'undefined') {
    for (const s of EXTRA_SHELTERS) {
      if ((s.types[0] === 'kinkyuu' || s.types[0] === 'hinanjo') && !list.find(x => x.name === s.name)) {
        list.push(s);
      }
    }
  }
  return list;
}

function renderAdminList() {
  if (!isAdminLoggedIn) return;
  const query      = (document.getElementById('admin-search-input')?.value || '').trim();
  const filterV    = document.getElementById('admin-filter-status')?.value || 'all';
  const filterTown = document.getElementById('admin-filter-town')?.value || 'all';
  const filterType = document.getElementById('admin-filter-type')?.value || 'all';

  let list = getAllSheltersForAdmin();
  if (query)              list = list.filter(s => s.name.includes(query) || (s.address||'').includes(query));
  if (filterTown !== 'all') list = list.filter(s => getShelterTown(s) === filterTown);
  if (filterType !== 'all') list = list.filter(s => s.types[0] === filterType);
  if (filterV === 'none')   list = list.filter(s => !shelterStatusData[s.name]?.status);
  else if (filterV !== 'all') list = list.filter(s => shelterStatusData[s.name]?.status === filterV);

  const container = document.getElementById('admin-shelter-list');
  if (!container) return;

  container.innerHTML = list.map(s => {
    const sd    = shelterStatusData[s.name] || {};
    const st    = sd.status || '';
    const typeL = s.types[0] === 'kinkyuu' ? '緊急' : '避難所';
    const id    = simpleHash(s.name);
    const badge = st
      ? `<span class="admin-badge admin-badge-${st}">${STATUS_EMOJI[st]} ${STATUS_LABELS[st]}</span>`
      : `<span class="admin-badge admin-badge-none">未設定</span>`;
    const statBtns = ['open','half','full'].map(v =>
      `<button class="admin-status-btn admin-status-btn-${v}${st===v?' active':''}" data-status="${v}"
        onclick="selectAdminStatus(event,'${s.name.replace(/'/g,"\\'")}')">${STATUS_EMOJI[v]} ${STATUS_LABELS[v]}</button>`
    ).join('');
    return `
<div class="admin-item" id="admin-item-${id}">
  <div class="admin-item-header" onclick="toggleAdminItem('${s.name.replace(/'/g,"\\'")}')">
    <div class="admin-item-info">
      <span class="admin-type-tag admin-type-${s.types[0]}">${typeL}</span>
      <span class="admin-item-name">${s.name}</span>
    </div>
    <div class="admin-item-right">${badge}<span class="admin-chevron">›</span></div>
  </div>
  <div class="admin-item-form" id="admin-form-${id}">
    <div class="admin-form-field">
      <label class="admin-label">空き状況</label>
      <div class="admin-status-btns" id="admin-sbtn-${id}">${statBtns}</div>
    </div>
    <div class="admin-form-field">
      <label class="admin-label">必要物資</label>
      <textarea class="admin-textarea" id="admin-sup-${id}" placeholder="例: 飲料水・食料・毛布・薬品">${sd.supplies||''}</textarea>
    </div>
    <div class="admin-form-field">
      <label class="admin-label">メモ</label>
      <textarea class="admin-textarea" id="admin-memo-${id}" placeholder="特記事項・連絡先など">${sd.memo||''}</textarea>
    </div>
    <button class="admin-save-btn" onclick="saveAdminItem('${s.name.replace(/'/g,"\\'")}')">💾 保存</button>
    <span class="admin-save-msg" id="admin-msg-${id}"></span>
  </div>
</div>`;
  }).join('');
}

function toggleAdminItem(name) {
  const id   = simpleHash(name);
  const form = document.getElementById('admin-form-' + id);
  if (!form) return;
  const opening = !form.classList.contains('open');
  // 他を閉じる
  document.querySelectorAll('.admin-item-form.open').forEach(f => f.classList.remove('open'));
  document.querySelectorAll('.admin-chevron').forEach(c => c.textContent = '›');
  if (opening) {
    form.classList.add('open');
    const ch = document.querySelector('#admin-item-' + id + ' .admin-chevron');
    if (ch) ch.textContent = '⌄';
  }
}

function selectAdminStatus(e, name) {
  const id   = simpleHash(name);
  const container = document.getElementById('admin-sbtn-' + id);
  if (!container) return;
  const clicked = e.target.closest('.admin-status-btn');
  if (!clicked) return;
  container.querySelectorAll('.admin-status-btn').forEach(b => b.classList.remove('active'));
  clicked.classList.add('active');
}

async function saveAdminItem(name) {
  const id        = simpleHash(name);
  const activeBtn = document.querySelector(`#admin-sbtn-${id} .admin-status-btn.active`);
  const status    = activeBtn ? activeBtn.dataset.status : '';
  const supplies  = (document.getElementById('admin-sup-' + id)?.value || '').trim();
  const memo      = (document.getElementById('admin-memo-' + id)?.value || '').trim();
  const msgEl     = document.getElementById('admin-msg-' + id);

  if (!status && !supplies && !memo) {
    delete shelterStatusData[name];
    await deleteShelterStatusRemote(name);
  } else {
    const data = { status, supplies, memo, updatedAt: new Date().toISOString() };
    shelterStatusData[name] = data;
    await saveShelterStatusRemote(name, data);
  }
  showAllSheltersOnMap();
  if (msgEl) { msgEl.textContent = '✅ 保存しました'; setTimeout(() => { msgEl.textContent = ''; }, 2500); }
  renderAdminList();
  if (adminMap) renderAdminMapMarkers(adminSelectedTown);
}

// ===== Firebase Firestore 連携 =====
// （Firebase が未設定の場合は localStorage のみ動作）

async function loadShelterStatus() {
  // ローカル保存分を先に読み込む（オフライン時のフォールバック）
  try {
    const local = localStorage.getItem('shelterStatusData');
    if (local) shelterStatusData = JSON.parse(local);
  } catch {}

  const db = getFirestoreDB();
  if (!db) { showAllSheltersOnMap(); return; }

  try {
    // 初回全件取得
    const snap = await db.collection('shelterStatus').get();
    snap.forEach(doc => { shelterStatusData[doc.id] = doc.data(); });
    showAllSheltersOnMap();

    // リアルタイム更新
    db.collection('shelterStatus').onSnapshot(snap => {
      snap.docChanges().forEach(ch => {
        if (ch.type === 'removed') delete shelterStatusData[ch.doc.id];
        else shelterStatusData[ch.doc.id] = ch.doc.data();
      });
      showAllSheltersOnMap();
    });
  } catch (e) {
    console.warn('Firestore load failed:', e);
    showAllSheltersOnMap();
  }
}

function getFirestoreDB() {
  try {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
      return firebase.firestore();
    }
  } catch {}
  return null;
}

async function saveShelterStatusRemote(name, data) {
  // ローカル保存
  try { localStorage.setItem('shelterStatusData', JSON.stringify(shelterStatusData)); } catch {}
  // Firestore 保存
  const db = getFirestoreDB();
  if (db) {
    try { await db.collection('shelterStatus').doc(name).set(data); } catch (e) { console.warn(e); }
  }
}

async function deleteShelterStatusRemote(name) {
  try { localStorage.setItem('shelterStatusData', JSON.stringify(shelterStatusData)); } catch {}
  const db = getFirestoreDB();
  if (db) {
    try { await db.collection('shelterStatus').doc(name).delete(); } catch (e) { console.warn(e); }
  }
}

// ===== ボトムシート ドラッグ制御 =====
function initBottomSheet() {
  const sheet  = document.getElementById('bottom-sheet');
  const handle = document.getElementById('bs-handle');
  if (!sheet || !handle) return;

  const snap = (h) => {
    const vh = window.innerHeight;
    const states = [180, Math.round(vh * 0.5), Math.round(vh * 0.9)];
    const nearest = states.reduce((a, b) => Math.abs(b - h) < Math.abs(a - h) ? b : a);
    sheet.style.transition = '';
    setBottomSheetHeight(nearest);
  };

  let startY = 0, startH = 0, dragging = false;

  handle.addEventListener('touchstart', e => {
    dragging = true;
    startY = e.touches[0].clientY;
    startH = sheet.offsetHeight;
    sheet.style.transition = 'none';
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!dragging) return;
    const dy  = startY - e.touches[0].clientY;
    const newH = Math.min(Math.max(startH + dy, 60), window.innerHeight * 0.93);
    sheet.style.height = newH + 'px';
    document.documentElement.style.setProperty('--bs-h', newH + 'px');
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    snap(sheet.offsetHeight);
  });

  // デスクトップ確認用マウスドラッグ
  handle.addEventListener('mousedown', e => {
    dragging = true;
    startY = e.clientY;
    startH = sheet.offsetHeight;
    sheet.style.transition = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dy  = startY - e.clientY;
    const newH = Math.min(Math.max(startH + dy, 60), window.innerHeight * 0.93);
    sheet.style.height = newH + 'px';
    document.documentElement.style.setProperty('--bs-h', newH + 'px');
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    snap(sheet.offsetHeight);
  });
}
